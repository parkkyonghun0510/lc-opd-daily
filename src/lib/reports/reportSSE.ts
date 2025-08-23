import sseHandler from '@/lib/sse/redisSSEHandler';
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
   * Broadcast a report update to all connected clients
   */
  static broadcastReportUpdate(event: ReportUpdateEvent) {
    const updateEvent = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString()
    };

    try {
      // Broadcast to all connected clients (cross-instance when Redis is available)
      sseHandler.broadcastEvent('report-update', updateEvent);
      
      // Also send to specific users if userId is provided
      if (event.userId) {
        sseHandler.sendEventToUser(event.userId, 'report-update', updateEvent);
      }

      // Persist and publish via Redis-backed emitter for polling and durability
      void redisEventEmitter.emit('report-update', updateEvent, event.userId ? { userIds: [event.userId] } : {});

      console.log(`[ReportSSE] Broadcast report update: ${event.type} for report ${event.reportId}`);
    } catch (error) {
      console.error('[ReportSSE] Error broadcasting report update:', error);
    }
  }

  /**
   * Broadcast new report creation
   */
  static broadcastNewReport(reportId: string, branchId?: string, userId?: string, details?: any) {
    this.broadcastReportUpdate({
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
  static broadcastReportUpdateEvent(reportId: string, branchId?: string, userId?: string, details?: any) {
    this.broadcastReportUpdate({
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
  static broadcastReportDeletion(reportId: string, branchId?: string, userId?: string, details?: any) {
    this.broadcastReportUpdate({
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
  static broadcastToBranchUsers(branchId: string, event: ReportUpdateEvent) {
    // This would typically query users with access to the branch
    // For now, we'll broadcast to all users
    this.broadcastReportUpdate({
      ...event,
      branchId
    });
  }
}

export default ReportSSEService;