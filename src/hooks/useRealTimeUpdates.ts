'use client';

import { useState, useEffect, useCallback } from 'react';
import { useHybridRealtime } from '@/hooks/useHybridRealtime';
import { EventType as SSEEventType } from '@/hooks/useHybridRealtime';

/**
 * Options for the useRealTimeUpdates hook
 */
export interface RealTimeUpdatesOptions {
  /**
   * SSE endpoint URL
   */
  sseEndpoint?: string;

  /**
   * Polling endpoint URL (for fallback)
   */
  pollingEndpoint?: string;

  /**
   * Polling interval in milliseconds
   */
  pollingInterval?: number;

  /**
   * Event handlers for specific event types
   */
  eventHandlers?: Record<SSEEventType, (data: any) => void>;

  /**
   * Whether to enable client-side caching of events
   */
  enableCache?: boolean;

  /**
   * Whether to enable debug logging
   */
  debug?: boolean;
}

/**
 * DEPRECATED: Use useHybridRealtime from @/auth/store directly instead.
 *
 * This hook is now a simple wrapper around useHybridRealtime which already
 * handles both SSE and polling with automatic fallback.
 */
export function useRealTimeUpdates(options: RealTimeUpdatesOptions = {}) {
  const {
    sseEndpoint = '/api/sse',
    pollingEndpoint = '/api/polling',
    pollingInterval = 10000,
    eventHandlers = {},
    enableCache = true,
    debug = false
  } = options;

  // Use the hybrid realtime system which handles both SSE and polling
  const {
    isConnected,
    error,
    lastEvent,
    reconnect,
    activeMethod
  } = useHybridRealtime({
    pollingEndpoint,
    pollingInterval,
    eventHandlers,
    debug
  });

  // Map the hybrid realtime state to the expected return format
  return {
    isConnected,
    isLoading: activeMethod === 'polling',
    error,
    lastUpdate: lastEvent,
    updateMethod: activeMethod,
    refresh: reconnect
  };
}
