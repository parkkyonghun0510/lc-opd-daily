import { StateCreator } from 'zustand';
import { eventCache } from '@/lib/sse/eventCache';

// Event types
export type EventType = 'notification' | 'dashboardUpdate' | 'systemAlert' | string;

// Event data structure
export interface RealtimeEvent<T = unknown> {
  id: string;
  type: EventType;
  data: T;
  timestamp: number;
}

// Event handler type
export type EventHandler<T = unknown> = (data: T) => void;

// Event handlers map type
export type EventHandlersMap = {
  [key in EventType | '*']?: EventHandler;
};

// Connection method type
export type ConnectionMethod = 'sse' | 'polling' | 'auto';

// Hook options
export interface HybridRealtimeOptions {
  // Endpoints
  sseEndpoint?: string;
  pollingEndpoint?: string;

  // Configuration
  pollingInterval?: number;
  preferredMethod?: ConnectionMethod;
  maxReconnectAttempts?: number;
  reconnectBackoffFactor?: number;
  maxReconnectDelay?: number;

  // Event handlers
  eventHandlers?: EventHandlersMap;

  // Client metadata
  clientMetadata?: Record<string, string>;

  // Debug options
  debug?: boolean;

  // Cache options
  enableCache?: boolean;
  maxCacheSize?: number;
  cacheTTL?: number; // Time to live in milliseconds
}

// Connection status type
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

// State interface
export interface HybridRealtimeState {
  // Public state (exposed in hook API)
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  activeMethod: ConnectionMethod | null;
  lastEvent: RealtimeEvent | null;
  error: string | null;
  options: HybridRealtimeOptions;

  // Internal state (not exposed in hook API)
  eventSource: EventSource | null;
  reconnectAttempts: number;
  lastPollTimestamp: number;
  isPolling: boolean;
  lastReconnectTime: number;
  cachedEvents: Map<EventType, RealtimeEvent[]>;
}

// Actions interface
export interface HybridRealtimeActions {
  // Configuration
  setOptions: (options: Partial<HybridRealtimeOptions>) => void;

  // Connection management
  connect: (options?: Partial<HybridRealtimeOptions>) => void;
  disconnect: () => void;
  reconnect: () => void;
  scheduleReconnect: () => void;

  // Network event handlers
  handleOnline: () => void;
  handleOffline: () => void;

  // SSE specific
  setupSSE: () => boolean;

  // Polling specific
  startPolling: () => void;
  stopPolling: () => void;
  pollForUpdates: () => Promise<void>;

  // Event handling
  processEvent: (event: RealtimeEvent) => void;
  cacheEvent: (event: RealtimeEvent) => void;
  loadCachedEvents: () => void;

  // State setters
  setIsConnected: (isConnected: boolean) => void;
  setActiveMethod: (method: ConnectionMethod | null) => void;
  setLastEvent: (event: RealtimeEvent | null) => void;
  setError: (error: string | null) => void;
  setEventSource: (eventSource: EventSource | null) => void;
  setReconnectAttempts: (attempts: number) => void;
  setLastPollTimestamp: (timestamp: number) => void;
  setIsPolling: (isPolling: boolean) => void;
}

// Selectors interface
export interface HybridRealtimeSelectors {
  getOptions: () => HybridRealtimeOptions;
  isSSESupported: () => boolean;
  getCachedEvents: (eventType: EventType) => RealtimeEvent[];
  getConnectionStatus: () => ConnectionStatus;
  getLastReconnectTime: () => number;
  getReconnectAttempts: () => number;
  getTimeSinceLastEvent: () => number;
  shouldReconnect: () => boolean;
}

// Combined slice type
export type HybridRealtimeSlice = HybridRealtimeState & HybridRealtimeActions & HybridRealtimeSelectors;

// Default options
const DEFAULT_OPTIONS: HybridRealtimeOptions = {
  sseEndpoint: '/api/realtime/sse',
  pollingEndpoint: '/api/realtime/polling',
  pollingInterval: 10000,
  preferredMethod: 'auto',
  maxReconnectAttempts: 5,
  reconnectBackoffFactor: 2,
  maxReconnectDelay: 30000,
  eventHandlers: {},
  clientMetadata: {},
  debug: false,
  enableCache: true,
  maxCacheSize: 100,
  cacheTTL: 24 * 60 * 60 * 1000 // 24 hours
};

// Create the hybrid realtime slice
export const createHybridRealtimeSlice: StateCreator<
  HybridRealtimeSlice,
  [],
  [],
  HybridRealtimeSlice
> = (set, get) => ({
  // Initial state
  connectionStatus: 'disconnected',
  isConnected: false,
  activeMethod: null,
  lastEvent: null,
  error: null,
  options: { ...DEFAULT_OPTIONS },
  eventSource: null,
  reconnectAttempts: 0,
  lastPollTimestamp: 0,
  isPolling: false,
  lastReconnectTime: 0,
  cachedEvents: new Map(),

  // Actions
  setOptions: (options) => {
    set((state) => ({
      options: { ...state.options, ...options }
    }));
  },

  connect: (options) => {
    try {
      // Update connection status
      set({ connectionStatus: 'connecting' });

      // Update options if provided
      if (options) {
        get().setOptions(options);
      }

      // Close any existing connections
      get().disconnect();

      // Load cached events
      get().loadCachedEvents();

      const { preferredMethod, enableCache, debug } = get().options;
      const isSSESupported = get().isSSESupported();

      // Log connection attempt
      if (debug) {
        console.log(`[HybridRealtime] Connecting with preferred method: ${preferredMethod}`);
      }

      // Connect based on preferred method
      if (preferredMethod === 'sse' && isSSESupported) {
        get().setupSSE();
      } else if (preferredMethod === 'polling') {
        get().startPolling();
      } else if (preferredMethod === 'auto') {
        // Try SSE first, fall back to polling if not supported
        if (isSSESupported) {
          const success = get().setupSSE();
          if (!success) {
            get().startPolling();
          }
        } else {
          get().startPolling();
        }
      }

      // Register online/offline event listeners
      if (typeof window !== 'undefined') {
        // Remove existing listeners first to avoid duplicates
        window.removeEventListener('online', get().handleOnline);
        window.removeEventListener('offline', get().handleOffline);

        // Add new listeners
        window.addEventListener('online', get().handleOnline);
        window.addEventListener('offline', get().handleOffline);

        if (debug) {
          console.log('[HybridRealtime] Registered online/offline event listeners');
        }
      }
    } catch (error) {
      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown connection error';
      set({
        connectionStatus: 'error',
        isConnected: false,
        error: errorMessage
      });

      if (get().options.debug) {
        console.error('[HybridRealtime] Connection error:', error);
      }

      // Schedule reconnection
      get().scheduleReconnect();
    }
  },

  disconnect: () => {
    // Close SSE connection
    const { eventSource } = get();
    if (eventSource) {
      eventSource.close();
      get().setEventSource(null);
    }

    // Stop polling
    get().stopPolling();

    // Remove event listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', get().handleOnline);
      window.removeEventListener('offline', get().handleOffline);
    }

    // Update state
    set({
      isConnected: false,
      connectionStatus: 'disconnected',
      activeMethod: null
    });

    if (get().options.debug) {
      console.log('[HybridRealtime] Disconnected');
    }
  },

  handleOnline: () => {
    const { debug } = get().options;

    if (debug) {
      console.log('[HybridRealtime] Network online, reconnecting...');
    }

    // Only reconnect if we're not already connected
    if (!get().isConnected) {
      // Reset reconnect attempts
      set({ reconnectAttempts: 0 });

      // Reconnect
      get().connect();
    }
  },

  handleOffline: () => {
    const { debug } = get().options;

    if (debug) {
      console.log('[HybridRealtime] Network offline, disconnecting...');
    }

    // Update state
    set({
      isConnected: false,
      connectionStatus: 'disconnected',
      activeMethod: null,
      error: 'Network offline'
    });

    // Close connections but don't remove event listeners
    const { eventSource } = get();
    if (eventSource) {
      eventSource.close();
      get().setEventSource(null);
    }

    // Stop polling
    get().stopPolling();
  },

  scheduleReconnect: () => {
    const {
      reconnectAttempts,
      options: {
        maxReconnectAttempts = 5,
        reconnectBackoffFactor = 2,
        maxReconnectDelay = 30000,
        debug = false
      }
    } = get();

    // Check if we've reached the maximum number of reconnect attempts
    if (reconnectAttempts >= maxReconnectAttempts) {
      if (debug) {
        console.log(`[HybridRealtime] Maximum reconnection attempts (${maxReconnectAttempts}) reached`);
      }
      return;
    }

    // Calculate delay with exponential backoff
    const nextAttempt = reconnectAttempts + 1;
    const delay = Math.min(
      1000 * Math.pow(reconnectBackoffFactor, nextAttempt - 1),
      maxReconnectDelay
    );

    if (debug) {
      console.log(`[HybridRealtime] Scheduling reconnect in ${delay}ms (attempt ${nextAttempt}/${maxReconnectAttempts})`);
    }

    // Update state
    set({
      reconnectAttempts: nextAttempt,
      lastReconnectTime: Date.now()
    });

    // Schedule reconnection
    setTimeout(() => {
      // Check if we're still disconnected before attempting to reconnect
      if (!get().isConnected) {
        get().connect();
      }
    }, delay);
  },

  reconnect: () => {
    if (get().options.debug) {
      console.log('[HybridRealtime] Manual reconnect requested');
    }

    // Reset reconnect attempts
    set({
      reconnectAttempts: 0,
      lastReconnectTime: Date.now()
    });

    // Reconnect
    get().connect();
  },

  setupSSE: () => {
    const { sseEndpoint, debug, eventHandlers } = get().options;

    if (!get().isSSESupported()) {
      if (debug) console.log('[HybridRealtime] SSE not supported, falling back to polling');
      return false;
    }

    try {
      // Close existing connection if any
      if (get().eventSource) {
        get().eventSource.close();
        get().setEventSource(null);
      }

      // Create URL with query parameters
      const url = new URL(sseEndpoint || '/api/realtime/sse', window.location.origin);
      url.searchParams.append('clientType', 'hybrid');
      url.searchParams.append('_t', Date.now().toString()); // Cache buster

      // Create new EventSource
      if (debug) console.log('[HybridRealtime] Setting up SSE connection to', url.toString());
      const eventSource = new EventSource(url.toString());
      get().setEventSource(eventSource);

      // Set up event listeners
      eventSource.onopen = () => {
        if (debug) console.log('[HybridRealtime] SSE connection opened');
        get().setIsConnected(true);
        get().setActiveMethod('sse');
        get().setError(null);
        get().setReconnectAttempts(0);
      };

      eventSource.onerror = (err) => {
        if (debug) console.log('[HybridRealtime] SSE connection error:', err);
        eventSource.close();
        get().setEventSource(null);
        get().setIsConnected(false);
        get().setError('SSE connection error');

        // Try to reconnect
        const reconnectAttempts = get().reconnectAttempts + 1;
        get().setReconnectAttempts(reconnectAttempts);

        const maxReconnectAttempts = 5;
        if (reconnectAttempts <= maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
          if (debug) {
            console.log(`[HybridRealtime] Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
          }

          setTimeout(() => {
            const { preferredMethod } = get().options;
            if (preferredMethod === 'sse' || preferredMethod === 'auto') {
              get().setupSSE();
            }
          }, delay);
        } else {
          if (debug) console.log('[HybridRealtime] Maximum reconnection attempts reached, falling back to polling');
          get().setActiveMethod('polling');
          get().startPolling();
        }
      };

      // Listen for specific events
      eventSource.addEventListener('connected', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (debug) console.log('[HybridRealtime] Connected event:', data);
          get().setIsConnected(true);
          get().setActiveMethod('sse');
          get().setError(null);
        } catch (err) {
          if (debug) console.log('[HybridRealtime] Error parsing connected event:', err);
        }
      });

      // Generic event listener for all event types
      const handleEvent = (e: MessageEvent) => {
        try {
          const eventType = e.type as EventType;
          const data = JSON.parse(e.data);

          const event: RealtimeEvent = {
            id: data.id || crypto.randomUUID(),
            type: eventType,
            data,
            timestamp: data.timestamp || Date.now()
          };

          get().processEvent(event);
        } catch (err) {
          if (debug) console.log('[HybridRealtime] Error processing event:', err);
        }
      };

      // Add listeners for common event types
      eventSource.addEventListener('notification', handleEvent);
      eventSource.addEventListener('dashboardUpdate', handleEvent);
      eventSource.addEventListener('systemAlert', handleEvent);

      // Add listeners for custom event types
      if (eventHandlers) {
        Object.keys(eventHandlers).forEach(eventType => {
          if (!['connected', 'notification', 'dashboardUpdate', 'systemAlert', '*'].includes(eventType)) {
            eventSource.addEventListener(eventType, handleEvent);
          }
        });
      }

      return true;
    } catch (err) {
      if (debug) console.log('[HybridRealtime] Error setting up SSE:', err);
      get().setError(err instanceof Error ? err.message : 'Unknown error setting up SSE');
      return false;
    }
  },

  startPolling: () => {
    const { pollingInterval, debug } = get().options;

    // Stop any existing polling
    get().stopPolling();

    // Initial poll
    get().pollForUpdates();

    // Set up interval for regular polling
    const intervalId = setInterval(() => {
      get().pollForUpdates();
    }, pollingInterval || 10000);

    // Store interval ID in window object (since we can't store functions in Zustand state)
    if (typeof window !== 'undefined') {
      (window as any).__hybridRealtimePollingInterval = intervalId;
    }

    get().setIsPolling(true);
    get().setActiveMethod('polling');

    if (debug) {
      console.log(`[HybridRealtime] Started polling every ${pollingInterval}ms`);
    }
  },

  stopPolling: () => {
    // Clear polling interval
    if (typeof window !== 'undefined' && (window as any).__hybridRealtimePollingInterval) {
      clearInterval((window as any).__hybridRealtimePollingInterval);
      (window as any).__hybridRealtimePollingInterval = null;
    }

    get().setIsPolling(false);

    if (get().options.debug) {
      console.log('[HybridRealtime] Stopped polling');
    }
  },

  pollForUpdates: async () => {
    const { pollingEndpoint, debug } = get().options;
    const lastPollTimestamp = get().lastPollTimestamp;

    try {
      // Create URL with query parameters
      const url = new URL(pollingEndpoint || '/api/realtime/polling', window.location.origin);
      url.searchParams.append('since', lastPollTimestamp.toString());
      url.searchParams.append('_t', Date.now().toString()); // Cache buster

      if (debug) console.log('[HybridRealtime] Polling for updates:', url.toString());

      // Fetch updates
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Polling error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (debug) console.log('[HybridRealtime] Polling response:', data);

      // Update last poll timestamp
      get().setLastPollTimestamp(data.timestamp || Date.now());

      // Process events
      if (data.events && Array.isArray(data.events)) {
        data.events.forEach((event: any) => {
          get().processEvent({
            id: event.id || crypto.randomUUID(),
            type: event.type,
            data: event.data,
            timestamp: event.timestamp || Date.now()
          });
        });
      }

      // Update connection state
      get().setIsConnected(true);
      get().setActiveMethod('polling');
      get().setError(null);
    } catch (err) {
      if (debug) console.log('[HybridRealtime] Polling error:', err);
      get().setError(err instanceof Error ? err.message : 'Unknown polling error');
    }
  },

  cacheEvent: (event) => {
    const {
      options: {
        enableCache = true,
        maxCacheSize = 100,
        cacheTTL = 24 * 60 * 60 * 1000, // 24 hours
        debug = false
      },
      cachedEvents
    } = get();

    if (!enableCache) return;

    try {
      // Ensure the event has a proper structure
      const normalizedEvent = {
        id: event.id || crypto.randomUUID(),
        type: event.type,
        data: event.data,
        timestamp: event.timestamp || Date.now()
      };

      // Get existing events for this type
      const events = cachedEvents.get(normalizedEvent.type) || [];

      // Check if this event already exists (by ID)
      const existingIndex = events.findIndex(e => e.id === normalizedEvent.id);

      if (existingIndex >= 0) {
        // Update existing event
        events[existingIndex] = normalizedEvent;
      } else {
        // Add the new event at the beginning (most recent first)
        events.unshift(normalizedEvent);
      }

      // Remove expired events (older than cacheTTL)
      const now = Date.now();
      const filteredEvents = events.filter(e =>
        (now - e.timestamp) < cacheTTL
      );

      // Limit the cache size
      if (filteredEvents.length > maxCacheSize) {
        filteredEvents.length = maxCacheSize;
      }

      // Update the cache
      set(state => ({
        cachedEvents: new Map(state.cachedEvents).set(normalizedEvent.type, filteredEvents)
      }));

      // Persist to localStorage if available
      if (typeof window !== 'undefined') {
        try {
          const cacheKey = `hybrid-realtime-cache-${normalizedEvent.type}`;
          localStorage.setItem(cacheKey, JSON.stringify(filteredEvents));
        } catch (err) {
          if (debug) {
            console.warn('[HybridRealtime] Failed to persist event to localStorage:', err);
          }
        }
      }
    } catch (err) {
      if (debug) {
        console.error('[HybridRealtime] Error caching event:', err);
      }
    }
  },

  loadCachedEvents: () => {
    const {
      options: {
        enableCache = true,
        eventHandlers = {},
        cacheTTL = 24 * 60 * 60 * 1000, // 24 hours
        debug = false
      }
    } = get();

    if (!enableCache || typeof window === 'undefined') return;

    try {
      // Load cached events from localStorage
      const cachedEventTypes = new Set([
        ...Object.keys(eventHandlers),
        'notification',
        'dashboardUpdate',
        'systemAlert'
      ]);

      const newCachedEvents = new Map();
      const now = Date.now();

      cachedEventTypes.forEach(eventType => {
        try {
          const cacheKey = `hybrid-realtime-cache-${eventType}`;
          const cachedData = localStorage.getItem(cacheKey);

          if (cachedData) {
            const events = JSON.parse(cachedData);
            if (Array.isArray(events) && events.length > 0) {
              // Filter out expired events
              const validEvents = events.filter(e =>
                e && e.timestamp && (now - e.timestamp) < cacheTTL
              );

              if (validEvents.length > 0) {
                newCachedEvents.set(eventType, validEvents);

                // Process the most recent event
                const mostRecentEvent = validEvents[0];
                if (mostRecentEvent) {
                  // Ensure the event has a proper structure
                  const normalizedEvent = {
                    id: mostRecentEvent.id || crypto.randomUUID(),
                    type: mostRecentEvent.type || eventType,
                    data: mostRecentEvent.data,
                    timestamp: mostRecentEvent.timestamp || now
                  };

                  // Update last event
                  get().setLastEvent(normalizedEvent);

                  // Call the event handler
                  if (eventHandlers[eventType]) {
                    eventHandlers[eventType](normalizedEvent.data);
                  }

                  if (debug) {
                    console.log(`[HybridRealtime] Loaded cached event for ${eventType}:`, normalizedEvent);
                  }
                }
              } else if (debug) {
                console.log(`[HybridRealtime] All cached events for ${eventType} have expired`);
              }
            }
          }
        } catch (err) {
          if (debug) {
            console.warn(`[HybridRealtime] Error loading cached events for ${eventType}:`, err);
          }
        }
      });

      // Update the cache state
      set({ cachedEvents: newCachedEvents });

    } catch (err) {
      if (debug) {
        console.error('[HybridRealtime] Error loading cached events:', err);
      }
    }
  },

  processEvent: (event) => {
    const { eventHandlers, debug } = get().options;

    if (debug) console.log('[HybridRealtime] Processing event:', event);

    // Ensure the event has a proper structure
    const normalizedEvent = {
      id: event.id || crypto.randomUUID(),
      type: event.type,
      data: event.data,
      timestamp: event.timestamp || Date.now()
    };

    // Update last event
    get().setLastEvent(normalizedEvent);

    // Cache the event
    get().cacheEvent(normalizedEvent);

    // Call the appropriate event handler
    if (eventHandlers && eventHandlers[normalizedEvent.type]) {
      eventHandlers[normalizedEvent.type](normalizedEvent.data);
    }

    // Also call the wildcard handler if it exists
    if (eventHandlers && eventHandlers['*']) {
      eventHandlers['*'](normalizedEvent);
    }

    // Dispatch a DOM event for components to listen for
    if (typeof window !== 'undefined') {
      const domEvent = new CustomEvent(`hybrid-realtime-${normalizedEvent.type}`, {
        detail: normalizedEvent,
        bubbles: true,
        cancelable: true
      });
      window.dispatchEvent(domEvent);

      // Also dispatch a generic event that all components can listen for
      const genericEvent = new CustomEvent('hybrid-realtime-event', {
        detail: normalizedEvent,
        bubbles: true,
        cancelable: true
      });
      window.dispatchEvent(genericEvent);
    }
  },

  // State setters
  setIsConnected: (isConnected) => {
    set({ isConnected });
  },

  setActiveMethod: (activeMethod) => {
    set({ activeMethod });
  },

  setLastEvent: (lastEvent) => {
    set({ lastEvent });
  },

  setError: (error) => {
    set({ error });
  },

  setEventSource: (eventSource) => {
    set({ eventSource });
  },

  setReconnectAttempts: (reconnectAttempts) => {
    set({ reconnectAttempts });
  },

  setLastPollTimestamp: (lastPollTimestamp) => {
    set({ lastPollTimestamp });
  },

  setIsPolling: (isPolling) => {
    set({ isPolling });
  },

  // Selectors
  getOptions: () => {
    return get().options;
  },

  isSSESupported: () => {
    return typeof EventSource !== 'undefined';
  },

  getCachedEvents: (eventType) => {
    return get().cachedEvents.get(eventType) || [];
  },

  getConnectionStatus: () => {
    return get().connectionStatus;
  },

  getLastReconnectTime: () => {
    return get().lastReconnectTime;
  },

  getReconnectAttempts: () => {
    return get().reconnectAttempts;
  },

  getTimeSinceLastEvent: () => {
    const { lastEvent } = get();
    if (!lastEvent) return Infinity;
    return Date.now() - lastEvent.timestamp;
  },

  shouldReconnect: () => {
    const {
      isConnected,
      reconnectAttempts,
      options: { maxReconnectAttempts = 5 }
    } = get();

    return !isConnected && reconnectAttempts < maxReconnectAttempts;
  }
});
