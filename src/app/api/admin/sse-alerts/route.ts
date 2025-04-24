import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { sseAlertingSystem } from '@/lib/monitoring/alerting';

/**
 * SSE Alerts API
 * 
 * This endpoint provides information about SSE alerts.
 * It requires admin privileges to access.
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate the user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if the user has admin privileges
    const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin privileges required' }, { status: 403 });
    }
    
    // In a real implementation, this would fetch alerts from a database or cache
    // For now, we'll just trigger a check and return any alerts
    const alerts = await sseAlertingSystem.checkMetricsAndAlert() || [];
    
    // Return the alerts
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      alerts
    });
  } catch (error) {
    console.error('[SSE Alerts] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
