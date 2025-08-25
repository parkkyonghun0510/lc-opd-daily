import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { eventEmitter } from '@/lib/realtime/eventEmitter';
import sseHandler from '@/lib/sse/sseHandler';
import { MemoryEventStoreUtils } from '@/lib/realtime/memoryEventStore';
import { SSEEventBuilder, SSEEventType, SSEEventPriority } from '@/lib/sse/eventTypes';

/**
 * Enhanced Test API for sending real-time events
 * 
 * This endpoint allows comprehensive testing of the real-time functionality
 * with support for different event types, targeting, and standardized formats.
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const token = await getToken({ req: request });
    if (!token || !token.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = token.id as string;
    const userRole = token.role as string || 'USER';
    
    // Parse the request body
    const body = await request.json();
    const { 
      type = 'test', 
      message, 
      data = {}, 
      target = 'user',
      targetValue,
      priority = 'normal',
      useStandardFormat = true,
      sendViaSSE = true,
      sendViaMemory = true
    } = body;
    
    // Validate input
    if (!type || typeof type !== 'string') {
      return NextResponse.json({ error: 'Event type is required' }, { status: 400 });
    }
    
    // Prepare event data
    const eventData = {
      message: message || 'Test event',
      ...data,
      timestamp: Date.now(),
      sender: userId,
      testMetadata: {
        sentBy: 'api-test',
        userRole,
        target,
        targetValue
      }
    };
    
    // Determine targeting
    let targetUsers: string[] | undefined;
    let targetRoles: string[] | undefined;
    
    switch (target) {
      case 'user':
        targetUsers = targetValue ? [targetValue] : [userId];
        break;
      case 'role':
        targetRoles = targetValue ? [targetValue] : [userRole];
        break;
      case 'broadcast':
      default:
        // No specific targeting - send to all
        break;
    }
    
    const results: any = {
      eventId: crypto.randomUUID(),
      type,
      target,
      targetValue,
      timestamp: Date.now(),
      results: {}
    };
    
    // Send via SSE if requested
    if (sendViaSSE) {
      try {
        if (useStandardFormat) {
          // Create standardized event
          const standardEvent = SSEEventBuilder.createEvent(
            type,
            eventData,
            {
              id: results.eventId,
              priority: priority as SSEEventPriority,
              source: 'test-api',
              metadata: {
                userIds: targetUsers,
                roles: targetRoles,
                testEvent: true
              }
            }
          );
          
          if (target === 'broadcast') {
            // Broadcast to all connected clients
            const broadcastResult = sseHandler.broadcastEvent(type, eventData, {
              id: results.eventId,
              useStandardFormat: true
            });
            results.results.sseBroadcast = {
              success: true,
              recipients: broadcastResult
            };
          } else if (targetUsers) {
            // Send to specific users
            let totalSent = 0;
            let totalErrors = 0;
            
            for (const targetUserId of targetUsers) {
              const sendResult = sseHandler.sendEventToUser(
                targetUserId,
                type,
                eventData,
                {
                  id: results.eventId,
                  priority: priority as SSEEventPriority,
                  source: 'test-api',
                  useStandardFormat: true
                }
              );
              totalSent += sendResult.sent;
              totalErrors += sendResult.errors;
            }
            
            results.results.sseTargeted = {
              success: true,
              totalSent,
              totalErrors,
              targetUsers
            };
          }
        } else {
          // Use legacy format
          if (target === 'broadcast') {
            const broadcastResult = sseHandler.broadcastEvent(type, eventData, {
              id: results.eventId
            });
            results.results.sseBroadcastLegacy = {
              success: true,
              recipients: broadcastResult
            };
          }
        }
      } catch (sseError) {
        console.error('[Test API] SSE error:', sseError);
        results.results.sseError = {
          success: false,
          error: sseError instanceof Error ? sseError.message : 'Unknown SSE error'
        };
      }
    }
    
    // Send via memory store if requested
    if (sendViaMemory) {
      try {
        const memoryEventId = MemoryEventStoreUtils.addEvent(
          type,
          eventData,
          targetUsers,
          targetRoles
        );
        
        results.results.memoryStore = {
          success: true,
          eventId: memoryEventId
        };
      } catch (memoryError) {
        console.error('[Test API] Memory store error:', memoryError);
        results.results.memoryError = {
          success: false,
          error: memoryError instanceof Error ? memoryError.message : 'Unknown memory store error'
        };
      }
    }
    
    // Also emit via the legacy event emitter for backward compatibility
    try {
      const legacyEventId = eventEmitter.emit(type, eventData, {
        userIds: targetUsers,
        roles: targetRoles
      });
      
      results.results.legacyEmitter = {
        success: true,
        eventId: legacyEventId
      };
    } catch (legacyError) {
      console.error('[Test API] Legacy emitter error:', legacyError);
      results.results.legacyError = {
        success: false,
        error: legacyError instanceof Error ? legacyError.message : 'Unknown legacy emitter error'
      };
    }
    
    // Log the test event
    console.log(`[Test API] Event sent:`, {
      type,
      target,
      targetValue,
      useStandardFormat,
      sendViaSSE,
      sendViaMemory,
      results: Object.keys(results.results)
    });
    
    return NextResponse.json({
      success: true,
      message: 'Test event sent successfully',
      ...results
    });
    
  } catch (error) {
    console.error('[Test API] Error:', error);
    
    return NextResponse.json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }, { status: 500 });
  }
}
      message: `Event sent to ${result} SSE clients`,
      type,
      data: eventData
    });
  } catch (error) {
    console.error('[Test API] Error:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
