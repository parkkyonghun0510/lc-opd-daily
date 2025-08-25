import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { realtimeMonitor } from '@/lib/realtime/monitor';
import unifiedSSEHandler from '@/lib/sse/unifiedSSEHandler';

/**
 * API endpoint for monitoring real-time connections
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const token = await getToken({ req: request });
    if (!token || !token.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user is an admin
    const userRole = token.role as string;
    if (userRole.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Only administrators can access monitoring data' }, { status: 403 });
    }
    
    // Get monitoring data
    const metrics = realtimeMonitor.getMetrics();
    const allInstancesMetrics = await realtimeMonitor.getAllInstancesMetrics();
    const status = await unifiedSSEHandler.getStatus();
    const sseStats = {
      totalClients: status.clientCount,
      handlerType: status.type,
      isReady: status.isReady,
      uptime: status.uptime,
      performance: status.performance
    };
    
    return NextResponse.json({
      metrics,
      allInstancesMetrics,
      sseStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Monitor API] Error:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
