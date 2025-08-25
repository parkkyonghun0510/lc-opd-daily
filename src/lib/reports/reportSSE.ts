import unifiedSSEHandler from '@/lib/sse/unifiedSSEHandler';
import { redisEventEmitter } from '@/lib/realtime/redisEventEmitter';

export interface ReportUpdateEvent {
  type: 'new' | 'updated' | 'deleted';
  reportId?: string;
  branchId?: string;
  userId?: string;
  timestamp?: string;
  details?: any;
}

/**
 * Broadcast report updates via SSE
 */
export class ReportSSEService {
  /**
   * Get the unified SSE handler
   */
  private static async getHandler() {
    return unifiedSSEHandler;
  }

  /**
   * Broadcast a report update to all connected clients
   */
  static async broadcastReportUpdate(event: ReportUpdateEvent) {
    const updateEvent = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString()
    };

    try {
      const handler = await this.getHandler();
      
      // Broadcast to all connected clients (cross-instance when Redis is available)
      const sentCount = await handler.broadcastEvent('report-update', updateEvent);
      
      // Also send to specific users if userId is provided
      if (event.userId) {
        await handler.sendEventToUser(event.userId, 'report-update', updateEvent);
      }

      // Persist and publish via Redis-backed emitter for polling and durability
      void redisEventEmitter.emit('report-update', updateEvent, event.userId ? { userIds: [event.userId] } : {});

      console.log(`[ReportSSE] Broadcasted report update to ${sentCount} clients: ${event.type} for report ${event.reportId}`);
    } catch (error) {
      console.error('[ReportSSE] Error broadcasting report update:', error);
    }
  }

  /**
   * Broadcast new report creation
   */
  static async broadcastNewReport(reportId: string, branchId?: string, userId?: string, details?: any) {
    await this.broadcastReportUpdate({
      type: 'new',
      reportId,
      branchId,
      userId,
      details
    });
  }

  /**
   * Broadcast report update
   */
  static async broadcastReportUpdateEvent(reportId: string, branchId?: string, userId?: string, details?: any) {
    await this.broadcastReportUpdate({
      type: 'updated',
      reportId,
      branchId,
      userId,
      details
    });
  }

  /**
   * Broadcast report deletion
   */
  static async broadcastReportDeletion(reportId: string, branchId?: string, userId?: string, details?: any) {
    await this.broadcastReportUpdate({
      type: 'deleted',
      reportId,
      branchId,
      userId,
      details
    });
  }

  /**
   * Broadcast to specific users based on branch access
   */
  static async broadcastToBranchUsers(branchId: string, event: ReportUpdateEvent) {
    // This would typically query users with access to the branch
    // For now, we'll broadcast to all users
    await this.broadcastReportUpdate({
      ...event,
      branchId
    });
  }
}

export default ReportSSEService;