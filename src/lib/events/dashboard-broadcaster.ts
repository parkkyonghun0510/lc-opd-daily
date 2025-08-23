import { emitDashboardUpdate } from '@/lib/realtime/redisEventEmitter';
import sseHandler from '@/lib/sse/redisSSEHandler';
import { DashboardEventType, createDashboardUpdate } from '@/lib/events/dashboard-events';

/**
 * Broadcasts a dashboard update event to all connected clients.
 * @param type - The type of dashboard event (from DashboardEventTypes)
 * @param data - The data associated with the event (should be relevant to the event type)
 * @returns void
 */
export function broadcastDashboardUpdate(type: DashboardEventType, data: unknown): void {
  try {
    const payload = createDashboardUpdate(type, data);
    const id = crypto.randomUUID();
    const timestamp = Date.now();
    const eventData = { id, timestamp, ...payload };

    // Broadcast via SSE (Redis-backed when available, falls back to in-memory)
    sseHandler.broadcastEvent('dashboardUpdate', eventData);

    // Persist and publish via Redis-backed emitter for polling and cross-instance durability
    void emitDashboardUpdate(type, data, { id, title: `Dashboard Update: ${type}` });

    console.debug(`[Realtime] Broadcasting ${type} with payload:`, eventData);
  } catch (error) {
    console.error(`[Realtime] Error broadcasting dashboard update of type ${type}:`, error);
  }
}
