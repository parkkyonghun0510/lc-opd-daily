import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { redisEventEmitter } from '@/lib/realtime/redisEventEmitter';
import { MemoryEventStoreUtils } from '@/lib/realtime/memoryEventStore';
import { SSEEventUtils, SSEEvent } from '@/lib/sse/eventTypes';
import { rateLimiter } from '@/lib/rate-limit';

/**
 * Enhanced Polling API for real-time updates
 * 
 * This endpoint provides a robust polling fallback when SSE is not available.
 * Features:
 * - Token-based authentication
 * - Event filtering by user/role
 * - Rate limiting
 * - Standardized event format
 * - Error handling and recovery
 */
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await rateLimiter.applyRateLimit(request, {
      identifier: 'polling',
      limit: 60, // Maximum 60 requests per user/IP
      window: 60 // Within a 60-second window
    });
    
    if (rateLimitResponse) {
      console.log('[Polling] Rate limit exceeded');
      return rateLimitResponse;
    }

    // Authenticate the request
    const token = await getToken({ req: request });
    if (!token || !token.id) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        message: 'Valid authentication required'
      }, { 
        status: 401,
        headers: {
          'WWW-Authenticate': 'Bearer'
        }
      });
    }
    
    const userId = token.id as string;
    const userRole = token.role as string || 'USER';
    
    // Parse query parameters
    const url = new URL(request.url);
    const sinceParam = url.searchParams.get('since');
    const eventTypesParam = url.searchParams.get('types'); // Optional event type filter
    const limitParam = url.searchParams.get('limit');
    const includeExpired = url.searchParams.get('includeExpired') === 'true';
    
    // Parse parameters with validation
    const since = sinceParam ? Math.max(0, parseInt(sinceParam, 10)) : Date.now() - (5 * 60 * 1000); // Default to 5 minutes ago
    const eventTypes = eventTypesParam ? eventTypesParam.split(',').filter(Boolean) : undefined;
    const limit = limitParam ? Math.min(50, Math.max(1, parseInt(limitParam, 10))) : 20; // Default 20, max 50
    
    console.log(`[Polling] Request from user ${userId}: since=${since}, types=${eventTypes?.join(',')}`);
    
    // Get events from the event emitter with fallback to memory store
    let events: any[] = [];
    let eventSource = 'redis';
    
    try {
      events = await redisEventEmitter.getEventsForUser(userId, since);
    } catch (eventError) {
      console.error('[Polling] Error fetching events from Redis:', eventError);
      
      // Fallback to memory store
      try {
        events = MemoryEventStoreUtils.getFormattedEventsForUser(userId, since, userRole);
        eventSource = 'memory';
        console.log(`[Polling] Using memory store fallback: ${events.length} events`);
      } catch (memoryError) {
        console.error('[Polling] Memory store fallback also failed:', memoryError);
        events = [];
        eventSource = 'none';
      }
    }
    
    // Filter and process events
    let filteredEvents = events;
    
    // Filter by event types if specified
    if (eventTypes && eventTypes.length > 0) {
      filteredEvents = filteredEvents.filter(event => 
        eventTypes.includes(event.type)
      );
    }
    
    // Filter out expired events unless explicitly requested
    if (!includeExpired) {
      const maxAge = 30 * 60 * 1000; // 30 minutes
      filteredEvents = filteredEvents.filter(event => {
        if (SSEEventUtils.validateEvent(event)) {
          return !SSEEventUtils.isEventExpired(event, maxAge);
        }
        // For legacy events, check timestamp
        return event.timestamp && (Date.now() - event.timestamp) < maxAge;
      });
    }
    
    // Filter events by user permissions
    filteredEvents = filteredEvents.filter(event => {
      if (SSEEventUtils.validateEvent(event)) {
        return SSEEventUtils.shouldSendToUser(event, userId, userRole);
      }
      // For legacy events, allow all (backward compatibility)
      return true;
    });
    
    // Sort events by priority and timestamp
    if (filteredEvents.some(event => SSEEventUtils.validateEvent(event))) {
      const standardizedEvents = filteredEvents.filter(event => SSEEventUtils.validateEvent(event)) as SSEEvent[];
      const legacyEvents = filteredEvents.filter(event => !SSEEventUtils.validateEvent(event));
      
      // Sort standardized events
      const sortedStandardized = SSEEventUtils.sortEventsByPriority(standardizedEvents);
      
      // Sort legacy events by timestamp
      const sortedLegacy = legacyEvents.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      
      // Combine with standardized events first
      filteredEvents = [...sortedStandardized, ...sortedLegacy];
    } else {
      // All legacy events, sort by timestamp
      filteredEvents.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }
    
    // Apply limit
    filteredEvents = filteredEvents.slice(0, limit);
    
    // Prepare response
    const currentTimestamp = Date.now();
    const responseData = {
      userId,
      timestamp: currentTimestamp,
      since,
      events: filteredEvents,
      meta: {
        totalEvents: events.length,
        filteredEvents: filteredEvents.length,
        eventSource, // 'redis', 'memory', or 'none'
        filters: {
          types: eventTypes,
          includeExpired,
          limit
        },
        nextPollRecommended: currentTimestamp + (10 * 1000), // Recommend next poll in 10 seconds
        serverTime: new Date(currentTimestamp).toISOString()
      }
    };
    
    console.log(`[Polling] Returning ${filteredEvents.length} events to user ${userId}`);
    
    // Return the events with appropriate headers
    return NextResponse.json(responseData, {
      headers: {
        // Prevent caching
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        // Add CORS headers
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        // Add custom headers for debugging
        'X-Events-Count': filteredEvents.length.toString(),
        'X-Server-Time': currentTimestamp.toString(),
        'X-Polling-Version': '2.0'
      }
    });
    
  } catch (error) {
    console.error('[Polling] Unexpected error:', error);
    
    return NextResponse.json({ 
      error: 'Internal Server Error',
      message: 'Failed to fetch updates',
      timestamp: Date.now(),
      details: process.env.NODE_ENV === 'development' ? {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      } : undefined
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-Error-Code': 'POLLING_ERROR'
      }
    });
  }
}
