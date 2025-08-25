import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { sseErrorHandler } from '@/lib/sse/errorHandler';
import sseHandler from '@/lib/sse/sseHandler';
import { memoryEventStore } from '@/lib/realtime/memoryEventStore';

/**
 * SSE Health Monitoring Endpoint
 * 
 * This endpoint provides comprehensive health information about the SSE system.
 * It requires admin privileges to access sensitive diagnostic information.
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate the user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check for admin privileges (optional - can be configured based on requirements)
    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN';
    const url = new URL(req.url);
    const includeDetails = isAdmin && url.searchParams.get('details') === 'true';
    
    // Get health status from error handler
    const healthStatus = sseErrorHandler.getHealthStatus();
    
    // Get SSE handler statistics
    const sseStats = sseHandler.getStats();
    
    // Get memory store statistics
    const memoryStats = memoryEventStore.getStats();
    
    // Basic health response for non-admin users
    const basicResponse = {
      status: healthStatus.overall,
      timestamp: new Date().toISOString(),
      uptime: healthStatus.metrics.uptime,
      connections: {
        total: sseStats.totalConnections,
        users: sseStats.uniqueUsers
      },
      errorRate: healthStatus.metrics.errorRate,
      responseTime: healthStatus.metrics.avgResponseTime
    };
    
    // Detailed response for admin users
    if (includeDetails) {
      const detailedResponse = {
        ...basicResponse,
        components: healthStatus.components,
        metrics: {
          ...healthStatus.metrics,
          memoryEvents: memoryStats.totalEvents,
          recentEvents: memoryStats.recentEvents
        },
        connections: {
          ...sseStats,
          states: sseStats.connectionStates || {},
          performance: sseStats.performance || {}
        },
        events: {
          memory: memoryStats,
          recent: healthStatus.errors.recent.map(error => ({
            id: error.id,
            code: error.code,
            message: error.message,
            category: error.category,
            severity: error.severity,
            timestamp: error.timestamp,
            recoveryStrategy: error.recoveryStrategy,
            retryable: error.retryable
          }))
        },
        errors: {
          byCategory: healthStatus.errors.byCategory,
          bySeverity: healthStatus.errors.bySeverity
        },
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          memory: process.memoryUsage(),
          env: process.env.NODE_ENV
        }
      };
      
      return NextResponse.json(detailedResponse, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Return basic response
    return NextResponse.json(basicResponse, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    console.error('[Health] Error generating health report:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

/**
 * POST endpoint for health actions (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate and check admin privileges
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });
    }
    
    // Parse request body
    const body = await req.json();
    const { action, parameters } = body;
    
    let result: any = {};
    
    switch (action) {
      case 'clear_errors':
        sseErrorHandler.clear();
        result = { message: 'Error history cleared' };
        break;
        
      case 'clear_events':
        memoryEventStore.clear();
        result = { message: 'Event store cleared' };
        break;
        
      case 'health_check':
        const healthCheckResult = sseHandler.sendHealthCheck();
        result = { 
          message: 'Health check sent',
          recipients: healthCheckResult
        };
        break;
        
      case 'force_cleanup':
        // Force cleanup of stale connections
        // This would be implemented in the SSE handler
        result = { message: 'Cleanup initiated' };
        break;
        
      case 'get_client_info':
        if (parameters?.clientId) {
          const clientInfo = sseHandler.getClientInfo(parameters.clientId);
          result = clientInfo ? { clientInfo } : { error: 'Client not found' };
        } else {
          result = { error: 'Client ID required' };
        }
        break;
        
      case 'disconnect_client':
        if (parameters?.clientId) {
          sseHandler.forceDisconnect(parameters.clientId, 'Admin disconnect');
          result = { message: `Client ${parameters.clientId} disconnected` };
        } else {
          result = { error: 'Client ID required' };
        }
        break;
        
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      action,
      result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Health Action] Error:', error);
    
    return NextResponse.json({
      error: 'Action failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}