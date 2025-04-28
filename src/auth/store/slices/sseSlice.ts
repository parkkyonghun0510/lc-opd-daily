import { StateCreator } from 'zustand';
import { useSession } from 'next-auth/react';
import { eventCache } from '@/lib/sse/eventCache';

// Define the types for our SSE state
export type SSEEventType = string;

export interface SSEEvent {
  type: SSEEventType;
  payload: any;
  timestamp: number;
}

export interface SSEOptions {
  endpoint?: string;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  eventHandlers?: Partial<Record<SSEEventType, (data: any) => void>>;
  clientMetadata?: Record<string, string>;
  debug?: boolean;
  enableCache?: boolean;
}

export interface SSEState {
  isConnected: boolean;
  error: string | null;
  lastEvent: SSEEvent | null;
  eventSource: EventSource | null;
  options: SSEOptions;
  reconnectAttempts: number;
}

export interface SSEActions {
  setOptions: (options: Partial<SSEOptions>) => void;
  connect: (options?: Partial<SSEOptions>) => void;
  disconnect: () => void;
  reconnect: () => void;
  handleEvent: (eventType: SSEEventType, data: any) => void;
  setIsConnected: (isConnected: boolean) => void;
  setError: (error: string | null) => void;
  setLastEvent: (event: SSEEvent | null) => void;
  setEventSource: (eventSource: EventSource | null) => void;
  setReconnectAttempts: (attempts: number) => void;
}

export interface SSESelectors {
  getOptions: () => SSEOptions;
  isConnecting: () => boolean;
}

export type SSESlice = SSEState & SSEActions & SSESelectors;

// Create the SSE slice
export const createSSESlice: StateCreator<SSESlice, [], [], SSESlice> = (set, get) => ({
  // State
  isConnected: false,
  error: null,
  lastEvent: null,
  eventSource: null,
  options: {
    endpoint: '/api/sse',
    autoReconnect: true,
    maxReconnectAttempts: 5,
    eventHandlers: {},
    clientMetadata: {},
    debug: false,
    enableCache: true
  },
  reconnectAttempts: 0,

  // Actions
  setOptions: (options) => {
    set((state) => ({
      options: { ...state.options, ...options }
    }));
  },

  connect: (options) => {
    // Update options if provided
    if (options) {
      get().setOptions(options);
    }

    // Close any existing connection
    get().disconnect();

    try {
      const { endpoint, clientMetadata, debug } = get().options;

      // Log if debug is enabled
      if (debug) {
        console.log('[SSE] Connecting to', endpoint);
      }

      // Build the SSE URL with authentication and metadata
      const url = new URL(endpoint || '/api/sse', window.location.origin);

      // Add client metadata
      url.searchParams.append('clientType', 'browser');
      url.searchParams.append('clientInfo', navigator.userAgent);

      // Add any custom metadata
      Object.entries(clientMetadata || {}).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });

      // Create a new EventSource
      const eventSource = new EventSource(url.toString());
      get().setEventSource(eventSource);

      // Set up event listeners
      eventSource.onopen = () => {
        get().setIsConnected(true);
        get().setError(null);
        get().setReconnectAttempts(0);
        
        if (debug) {
          console.log('[SSE] Connected to', endpoint);
        }
      };

      eventSource.onerror = (event) => {
        get().setIsConnected(false);
        get().setError('Connection error');
        
        if (debug) {
          console.error('[SSE] Connection error:', event);
        }

        // Handle reconnection
        const { autoReconnect, maxReconnectAttempts } = get().options;
        const reconnectAttempts = get().reconnectAttempts;

        if (autoReconnect && reconnectAttempts < (maxReconnectAttempts || 5)) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          
          if (debug) {
            console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1})`);
          }

          setTimeout(() => {
            get().setReconnectAttempts(reconnectAttempts + 1);
            get().connect();
          }, delay);
        }
      };

      // Set up event listeners for specific event types
      const standardEvents = ['connected', 'notification', 'update', 'ping', 'message'];
      
      // Add listeners for standard events
      standardEvents.forEach(eventType => {
        eventSource.addEventListener(eventType, (event: any) => {
          try {
            const data = JSON.parse(event.data);
            get().handleEvent(eventType, data);
          } catch (error) {
            if (debug) {
              console.error(`[SSE] Error parsing ${eventType} event data:`, error);
            }
          }
        });
      });

      // Add listeners for custom events
      const { eventHandlers } = get().options;
      if (eventHandlers) {
        Object.keys(eventHandlers).forEach(eventType => {
          if (!standardEvents.includes(eventType)) {
            eventSource.addEventListener(eventType, (event: any) => {
              try {
                const data = JSON.parse(event.data);
                get().handleEvent(eventType, data);
              } catch (error) {
                if (debug) {
                  console.error(`[SSE] Error parsing ${eventType} event data:`, error);
                }
              }
            });
          }
        });
      }

      // Initialize event cache
      const { enableCache } = get().options;
      if (enableCache) {
        eventCache.initialize();

        // Load cached events for each event type
        if (eventHandlers) {
          Object.keys(eventHandlers).forEach(eventType => {
            const cachedEvent = eventCache.getLatestEvent(eventType);
            if (cachedEvent) {
              if (debug) {
                console.log(`[SSE] Loaded cached event for ${eventType}:`, cachedEvent);
              }

              // Set as last event
              get().setLastEvent({
                type: cachedEvent.type,
                payload: cachedEvent.data,
                timestamp: cachedEvent.timestamp
              });

              // Call the event handler if defined
              if (eventHandlers[eventType]) {
                eventHandlers[eventType]!(cachedEvent.data);
              }
            }
          });
        }
      }
    } catch (error) {
      get().setError('Failed to connect');
      
      if (get().options.debug) {
        console.error('[SSE] Connection setup error:', error);
      }
    }
  },

  disconnect: () => {
    const { eventSource } = get();
    if (eventSource) {
      eventSource.close();
      get().setEventSource(null);
      get().setIsConnected(false);
      
      if (get().options.debug) {
        console.log('[SSE] Disconnected');
      }
    }
  },

  reconnect: () => {
    get().setReconnectAttempts(0);
    get().connect();
  },

  handleEvent: (eventType, data) => {
    const { eventHandlers, debug, enableCache } = get().options;
    const timestamp = Date.now();

    // Create the event object
    const event: SSEEvent = {
      type: eventType,
      payload: data,
      timestamp
    };

    // Set as last event
    get().setLastEvent(event);

    // Call the event handler if defined
    if (eventHandlers && eventHandlers[eventType]) {
      eventHandlers[eventType]!(data);
    }

    // Cache the event if caching is enabled
    if (enableCache) {
      eventCache.addEvent({
        id: data.id || crypto.randomUUID(),
        type: eventType,
        data,
        timestamp
      });
    }

    if (debug) {
      console.log(`[SSE] Received ${eventType} event:`, data);
    }
  },

  setIsConnected: (isConnected) => {
    set({ isConnected });
  },

  setError: (error) => {
    set({ error });
  },

  setLastEvent: (event) => {
    set({ lastEvent: event });
  },

  setEventSource: (eventSource) => {
    set({ eventSource });
  },

  setReconnectAttempts: (reconnectAttempts) => {
    set({ reconnectAttempts });
  },

  // Selectors
  getOptions: () => {
    return get().options;
  },

  isConnecting: () => {
    return get().eventSource !== null && !get().isConnected;
  }
});
