/**
 * Race condition safe Server-Sent Events (SSE) hooks
 * Prevents common race conditions in SSE connection management
 */

import { useCallback, useRef, useEffect } from 'react';
import { useSSE } from './useSSE';
import { HybridRealtimeOptions } from './useHybridRealtime';
import { raceConditionManager } from '@/lib/sync/race-condition-manager';
import { handleError } from '@/lib/errors/error-handler';
import { createNetworkError } from '@/lib/errors/error-classes';
import { NetworkErrorCode } from '@/lib/errors/error-classes';

export function useRaceConditionSafeSSE(options: HybridRealtimeOptions = {}) {
  const sse = useSSE(options);
  const operationRef = useRef<string | null>(null);
  const userId = 'current-user'; // Get from auth context
  const sessionId = 'current-session'; // Get from session context

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      operationRef.current = null;
    };
  }, []);

  const safeReconnect = useCallback(async () => {
    const operationId = `reconnect-${Date.now()}`;
    operationRef.current = operationId;

    try {
      await raceConditionManager.preventDuplicateRequest(
        'sse-reconnect',
        async () => {
          if (operationRef.current !== operationId) {
            throw createNetworkError(NetworkErrorCode.OPERATION_CANCELLED, 'Reconnect operation cancelled');
          }
          await sse.reconnect();
        }
      );
    } catch (error) {
      await handleError(error as Error, {
        userId,
        sessionId,
        timestamp: new Date(),
        additionalData: { operation: 'sse-reconnect', operationId }
      });
      throw error;
    }
  }, [sse, userId, sessionId]);

  const safeCloseConnection = useCallback(async () => {
    const operationId = `close-${Date.now()}`;
    operationRef.current = operationId;

    try {
      await raceConditionManager.preventDuplicateRequest(
        'sse-close',
        async () => {
          if (operationRef.current !== operationId) {
            throw createNetworkError(NetworkErrorCode.OPERATION_CANCELLED, 'Close operation cancelled');
          }
          await sse.closeConnection();
        }
      );
    } catch (error) {
      await handleError(error as Error, {
        userId,
        sessionId,
        timestamp: new Date(),
        additionalData: { operation: 'sse-close', operationId }
      });
      throw error;
    }
  }, [sse, userId, sessionId]);







  return {
    isConnected: sse.isConnected,
    error: sse.error,
    lastEvent: sse.lastEvent,
    reconnect: safeReconnect,
    closeConnection: safeCloseConnection
  };
}

export function useSequentialSSE(options: HybridRealtimeOptions = {}) {
  const sse = useSSE(options);
  const userId = 'current-user';
  const sessionId = 'current-session';

  const sequentialReconnect = useCallback(async () => {
    try {
      await raceConditionManager.ensureSequentialExecution(
        'sse-operations',
        async () => {
          await sse.reconnect();
        }
      );
    } catch (error) {
      await handleError(error as Error, {
        userId,
        sessionId,
        timestamp: new Date(),
        additionalData: { operation: 'sequential-sse-reconnect' }
      });
      throw error;
    }
  }, [sse, userId, sessionId]);

  const sequentialCloseConnection = useCallback(async () => {
    try {
      await raceConditionManager.ensureSequentialExecution(
        'sse-operations',
        async () => {
          await sse.closeConnection();
        }
      );
    } catch (error) {
      await handleError(error as Error, {
        userId,
        sessionId,
        timestamp: new Date(),
        additionalData: { operation: 'sequential-sse-close' }
      });
      throw error;
    }
  }, [sse, userId, sessionId]);

  return {
    isConnected: sse.isConnected,
    error: sse.error,
    lastEvent: sse.lastEvent,
    reconnect: sequentialReconnect,
    closeConnection: sequentialCloseConnection
  };
}

export function useDebouncedSSE(options: HybridRealtimeOptions = {}, delay: number = 300) {
  const sse = useSSE(options);
  const userId = 'current-user';
  const sessionId = 'current-session';
  
  const debouncedReconnect = useCallback(
    raceConditionManager.debounce(
      async () => {
        try {
          await sse.reconnect();
        } catch (error) {
          await handleError(error as Error, {
            userId,
            sessionId,
            timestamp: new Date(),
            additionalData: { operation: 'debounced-sse-reconnect' }
          });
          throw error;
        }
      },
      delay
    ),
    [sse, userId, sessionId, delay]
  );

  const debouncedCloseConnection = useCallback(
    raceConditionManager.debounce(
      async () => {
        try {
          await sse.closeConnection();
        } catch (error) {
          await handleError(error as Error, {
            userId,
            sessionId,
            timestamp: new Date(),
            additionalData: { operation: 'debounced-sse-close' }
          });
          throw error;
        }
      },
      delay
    ),
    [sse, userId, sessionId, delay]
  );

  return {
    isConnected: sse.isConnected,
    error: sse.error,
    lastEvent: sse.lastEvent,
    reconnect: debouncedReconnect,
    closeConnection: debouncedCloseConnection
  };
}

export function useRetryableSSE(options: HybridRealtimeOptions = {}, maxRetries: number = 3) {
  const sse = useSSE(options);
  const userId = 'current-user';
  const sessionId = 'current-session';
  
  const retryableReconnect = useCallback(async (): Promise<void> => {
    return raceConditionManager.withRetry(
      async () => {
        try {
          await sse.reconnect();
        } catch (error) {
          await handleError(error as Error, {
            userId,
            sessionId,
            timestamp: new Date(),
            additionalData: { operation: 'retryable-sse-reconnect' }
          });
          throw error;
        }
      },
      maxRetries,
      1000
    );
  }, [sse, userId, sessionId, maxRetries]);

  const retryableCloseConnection = useCallback(async (): Promise<void> => {
    return raceConditionManager.withRetry(
      async () => {
        try {
          await sse.closeConnection();
        } catch (error) {
          await handleError(error as Error, {
            userId,
            sessionId,
            timestamp: new Date(),
            additionalData: { operation: 'retryable-sse-close' }
          });
          throw error;
        }
      },
      maxRetries,
      1000
    );
  }, [sse, userId, sessionId, maxRetries]);

  return {
    isConnected: sse.isConnected,
    error: sse.error,
    lastEvent: sse.lastEvent,
    reconnect: retryableReconnect,
    closeConnection: retryableCloseConnection
  };
}