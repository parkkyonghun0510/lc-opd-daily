import Redis from 'ioredis';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed within the window
   */
  limit: number;

  /**
   * Time window in seconds
   */
  window: number;

  /**
   * Identifier for the rate limit (e.g., 'api', 'sse')
   */
  identifier: string;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /**
   * Whether the request is allowed
   */
  success: boolean;

  /**
   * Current count of requests
   */
  count: number;

  /**
   * Maximum number of requests allowed
   */
  limit: number;

  /**
   * Time in seconds until the rate limit resets
   */
  reset: number;
}

/**
 * Rate limiter using Redis
 */
export class RateLimiter {
  private redis: Redis | null = null;

  constructor() {
    // Initialize Redis client if configured
    if (process.env.DRAGONFLY_URL) {
      this.redis = new Redis(process.env.DRAGONFLY_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 3,
      });
    }
  }

  /**
   * Check if a request is rate limited
   */
  async limit(
    req: NextRequest,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    // If Redis is not configured, allow all requests
    if (!this.redis) {
      return {
        success: true,
        count: 0,
        limit: config.limit,
        reset: 0
      };
    }

    // Get IP address from request
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    // Get user ID from query parameter or cookie
    let userId = new URL(req.url).searchParams.get('userId');

    // Create a key for the rate limit
    // Use both IP and user ID if available, or just IP
    const key = `rate-limit:${config.identifier}:${userId ? `user-${userId}` : `ip-${ip}`}`;

    // Get the current count and expiration
    const results = await this.redis.pipeline()
      .incr(key)
      .ttl(key)
      .exec();
    
    const count = results?.[0]?.[1] as number || 0;
    const reset = results?.[1]?.[1] as number || 0;

    // If this is the first request, set the expiration
    if (count === 1) {
      await this.redis.expire(key, config.window);
    }

    // Calculate the reset time
    const resetTime = reset < 0 ? config.window : reset;

    // Check if the request is allowed
    const success = count <= config.limit;

    return {
      success,
      count,
      limit: config.limit,
      reset: resetTime
    };
  }

  /**
   * Apply rate limiting to a request
   */
  async applyRateLimit(
    req: NextRequest,
    config: RateLimitConfig
  ): Promise<NextResponse | null> {
    const result = await this.limit(req, config);

    if (!result.success) {
      // Return a rate limit exceeded response
      return new NextResponse(
        JSON.stringify({
          error: 'Rate limit exceeded',
          limit: result.limit,
          count: result.count,
          reset: result.reset
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': Math.max(0, result.limit - result.count).toString(),
            'X-RateLimit-Reset': result.reset.toString()
          }
        }
      );
    }

    // Request is allowed
    return null;
  }
}

// Create a singleton instance
export const rateLimiter = new RateLimiter();
