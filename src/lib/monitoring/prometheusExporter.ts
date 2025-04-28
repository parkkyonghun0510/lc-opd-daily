/**
 * Prometheus Metrics Exporter
 * 
 * This module exports SSE metrics in Prometheus format for integration
 * with Prometheus monitoring system.
 */

import { sseMetrics } from '@/lib/sse/sseMetrics';

/**
 * Generate Prometheus metrics from SSE metrics
 */
export function generatePrometheusMetrics(): string {
  const metrics = sseMetrics.getMetrics();
  const lines: string[] = [];
  
  // Add metric headers and values
  
  // Connection metrics
  lines.push('# HELP sse_connections_total Total number of SSE connections since last reset');
  lines.push('# TYPE sse_connections_total counter');
  lines.push(`sse_connections_total ${metrics.connections.total}`);
  
  lines.push('# HELP sse_connections_active Current number of active SSE connections');
  lines.push('# TYPE sse_connections_active gauge');
  lines.push(`sse_connections_active ${metrics.connections.active}`);
  
  lines.push('# HELP sse_connections_peak Peak number of concurrent SSE connections');
  lines.push('# TYPE sse_connections_peak gauge');
  lines.push(`sse_connections_peak ${metrics.connections.peak}`);
  
  // User-specific connection metrics
  lines.push('# HELP sse_connections_by_user Number of active connections per user');
  lines.push('# TYPE sse_connections_by_user gauge');
  for (const [userId, count] of Object.entries(metrics.connections.byUser)) {
    lines.push(`sse_connections_by_user{user_id="${userId}"} ${count}`);
  }
  
  // Event metrics
  lines.push('# HELP sse_events_total Total number of SSE events sent since last reset');
  lines.push('# TYPE sse_events_total counter');
  lines.push(`sse_events_total ${metrics.events.total}`);
  
  // Event type metrics
  lines.push('# HELP sse_events_by_type Number of events sent by type');
  lines.push('# TYPE sse_events_by_type counter');
  for (const [eventType, count] of Object.entries(metrics.events.byType)) {
    lines.push(`sse_events_by_type{event_type="${eventType}"} ${count}`);
  }
  
  // User-specific event metrics
  lines.push('# HELP sse_events_by_user Number of events sent per user');
  lines.push('# TYPE sse_events_by_user counter');
  for (const [userId, count] of Object.entries(metrics.events.byUser)) {
    lines.push(`sse_events_by_user{user_id="${userId}"} ${count}`);
  }
  
  // Error metrics
  lines.push('# HELP sse_errors_total Total number of SSE errors since last reset');
  lines.push('# TYPE sse_errors_total counter');
  lines.push(`sse_errors_total ${metrics.errors.total}`);
  
  // Error type metrics
  lines.push('# HELP sse_errors_by_type Number of errors by type');
  lines.push('# TYPE sse_errors_by_type counter');
  for (const [errorType, count] of Object.entries(metrics.errors.byType)) {
    lines.push(`sse_errors_by_type{error_type="${errorType}"} ${count}`);
  }
  
  // Performance metrics
  lines.push('# HELP sse_event_processing_time_average Average event processing time in milliseconds');
  lines.push('# TYPE sse_event_processing_time_average gauge');
  lines.push(`sse_event_processing_time_average ${metrics.performance.averageEventProcessingTime || 0}`);
  
  lines.push('# HELP sse_event_processing_count Number of events processed for performance measurement');
  lines.push('# TYPE sse_event_processing_count counter');
  lines.push(`sse_event_processing_count ${metrics.performance.eventProcessingCount}`);
  
  // Add timestamp
  lines.push('# HELP sse_metrics_last_reset Timestamp of the last metrics reset');
  lines.push('# TYPE sse_metrics_last_reset gauge');
  lines.push(`sse_metrics_last_reset ${Math.floor(metrics.lastReset / 1000)}`);
  
  return lines.join('\n');
}
