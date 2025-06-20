import sseEmitter from "@/lib/sseEmitter";
import {
  DashboardEventType,
  createDashboardUpdate,
} from "@/lib/events/dashboard-events";

/**
 * Broadcasts a dashboard update event to all connected clients.
 * @param type - The type of dashboard event (from DashboardEventTypes)
 * @param data - The data associated with the event (should be relevant to the event type)
 * @returns void
 */
export function broadcastDashboardUpdate(
  type: DashboardEventType,
  data: unknown,
): void {
  try {
    const payload = createDashboardUpdate(type, data);
    console.debug(`[SSE] Broadcasting ${type} with payload:`, payload);
    sseEmitter.emit("dashboardUpdate", payload);
  } catch (error) {
    console.error(
      `[SSE] Error broadcasting dashboard update of type ${type}:`,
      error,
    );
  }
}
