/**
 * Rate Limiter for Real-time Connections
 * 
 * This module provides rate limiting functionality for real-time connections
 * to prevent abuse of the SSE and WebSocket endpoints.
 */

import Redis from 'ioredis';

// Default rate limits
const DEFAULT_LIMITS = {
  // Max 5 connections per user per minute
  USER_CONNECTIONS: { max: 5, window: 60 },
  // Max 10 connections per IP per minute
  IP_CONNECTIONS: { max: 10, window: 60 },
  // Max 100 events per user per minute
  USER_EVENTS: { max: 100, window: 60 },
  // Max 200 events per IP per minute
  IP_EVENTS: { max: 200, window: 60 }
};

class RateLimiter {
  private redis: Redis | null = null;
  private limits: typeof DEFAULT_LIMITS;
  private enabled: boolean = true;
  
  constructor(limits = DEFAULT_LIMITS) {
    this.limits = limits;
    this.initRedis();
  }
  
  /**
   * Initialize Redis client
   */
  private initRedis() {
    try {
      // Check if the required environment variables are present
      const redisUrl = process.env.DRAGONFLY_URL;
      if (!redisUrl) {
        console.warn(
          "[RateLimiter] Redis URL not found (DRAGONFLY_URL). Rate limiting will be disabled."
        );
        this.enabled = false;
        return;
      }
      
      // Initialize Redis client
      this.redis = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 3,
      });
      console.log("[RateLimiter] Redis client initialized");
    } catch (error) {
      console.error("[RateLimiter] Failed to initialize Redis:", error);
      this.redis = null;
      this.enabled = false;
    }
  }
  
  /**
   * Check if a user has exceeded their rate limit
   * 
   * @param userId - User ID
   * @param limitType - Type of limit to check
   * @returns Whether the user has exceeded their rate limit
   */
  async checkUserLimit(userId: string, limitType: keyof typeof DEFAULT_LIMITS): Promise<boolean> {
    if (!this.enabled || !this.redis) {
      return false; // If rate limiting is disabled, always allow
    }
    
    try {
      const limit = this.limits[limitType];
      const key = `ratelimit:${limitType.toLowerCase()}:user:${userId}`;
      
      // Get current count
      const count = await this.redis.get(key);
      
      // If no count exists, set it to 1 with expiry
      if (count === null) {
        await this.redis.setex(key, limit.window, 1);
        return false;
      }
      
      // Check if limit exceeded
      if (parseInt(count as string) >= limit.max) {
        return true;
      }
      
      // Increment count
      await this.redis.incr(key);
      return false;
    } catch (error) {
      console.error(`[RateLimiter] Error checking user limit (${limitType}):`, error);
      return false; // On error, allow the request
    }
  }
  
  /**
   * Check if an IP has exceeded their rate limit
   * 
   * @param ip - IP address
   * @param limitType - Type of limit to check
   * @returns Whether the IP has exceeded their rate limit
   */
  async checkIpLimit(ip: string, limitType: keyof typeof DEFAULT_LIMITS): Promise<boolean> {
    if (!this.enabled || !this.redis) {
      return false; // If rate limiting is disabled, always allow
    }
    
    try {
      const limit = this.limits[limitType];
      const key = `ratelimit:${limitType.toLowerCase()}:ip:${ip}`;
      
      // Get current count
      const count = await this.redis.get(key);
      
      // If no count exists, set it to 1 with expiry
      if (count === null) {
        await this.redis.setex(key, limit.window, 1);
        return false;
      }
      
      // Check if limit exceeded
      if (parseInt(count as string) >= limit.max) {
        return true;
      }
      
      // Increment count
      await this.redis.incr(key);
      return false;
    } catch (error) {
      console.error(`[RateLimiter] Error checking IP limit (${limitType}):`, error);
      return false; // On error, allow the request
    }
  }
  
  /**
   * Reset a user's rate limit
   * 
   * @param userId - User ID
   * @param limitType - Type of limit to reset
   */
  async resetUserLimit(userId: string, limitType: keyof typeof DEFAULT_LIMITS): Promise<void> {
    if (!this.enabled || !this.redis) {
      return;
    }
    
    try {
      const key = `ratelimit:${limitType.toLowerCase()}:user:${userId}`;
      await this.redis.del(key);
    } catch (error) {
      console.error(`[RateLimiter] Error resetting user limit (${limitType}):`, error);
    }
  }
  
  /**
   * Reset an IP's rate limit
   * 
   * @param ip - IP address
   * @param limitType - Type of limit to reset
   */
  async resetIpLimit(ip: string, limitType: keyof typeof DEFAULT_LIMITS): Promise<void> {
    if (!this.enabled || !this.redis) {
      return;
    }
    
    try {
      const key = `ratelimit:${limitType.toLowerCase()}:ip:${ip}`;
      await this.redis.del(key);
    } catch (error) {
      console.error(`[RateLimiter] Error resetting IP limit (${limitType}):`, error);
    }
  }
}

// Create a singleton instance
export const rateLimiter = new RateLimiter();
