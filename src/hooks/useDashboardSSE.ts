import { useEffect, useState, useRef, useCallback } from "react";

// Define a more generic type or adjust based on expected SSE data
export type SSEData = {
  type: string;
  payload: any; // Adjust this based on the actual data structure you broadcast
  [key: string]: any;
};

export const useDashboardSSE = () => {
  // State to hold the latest received data payload
  const [lastEventData, setLastEventData] = useState<any | null>(null);
  // State to track connection status
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Reconnection settings
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Connection health monitoring
  const lastActivityRef = useRef<number>(Date.now());
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const CONNECTION_TIMEOUT_MS = 60000; // 60 seconds without activity is considered stale

  // Function to create and setup the EventSource
  const setupEventSource = useCallback(() => {
    setIsConnected(false);
    setError(null);

    // Clear any existing reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Connect to the SSE endpoint
    //console.log("[SSE Debug] Initializing connection to /api/dashboard/sse");
    const eventSource = new EventSource("/api/dashboard/sse");
    eventSourceRef.current = eventSource;
    //console.log("[SSE Debug] Attempting to connect to /api/dashboard/sse (attempt #" + (reconnectAttemptsRef.current + 1) + ")");

    // Update last activity timestamp
    lastActivityRef.current = Date.now();

    eventSource.onopen = () => {
      //console.log("[SSE Debug] Connection established");
      reconnectAttemptsRef.current = 0;
      setIsConnected(true);
      setError(null);
      lastActivityRef.current = Date.now();
    };

    // Listen for the 'connected' event from the server
    eventSource.addEventListener('connected', (event) => {
      //console.log("[SSE Debug] Received 'connected' event:", event.data);
      try {
        const parsedData = JSON.parse(event.data);
        // You might want to do something with the connection message
        setLastEventData({ type: 'connected', payload: parsedData });
      } catch (err) {
        console.error("[SSE Debug] Error parsing 'connected' event data:", err);
      }
    });

    // Listen for 'dashboardUpdate' events
    eventSource.addEventListener('dashboardUpdate', (event) => {
      //console.log("[SSE Debug] Received 'dashboardUpdate' event:", event.data);
      try {
        const parsedData = JSON.parse(event.data);
        setLastEventData({ type: 'dashboardUpdate', payload: parsedData });
        setError(null); // Clear previous errors on successful update
      } catch (err) {
        setError("Failed to parse dashboardUpdate event data");
        console.error("[SSE Debug] Error parsing 'dashboardUpdate' event data:", err);
      }
    });

    // Generic message handler for unnamed events
    eventSource.onmessage = (event) => {
      //console.log("[SSE Debug] Received generic message (no event type):", event.data);
      try {
        const parsedData = JSON.parse(event.data);
        //console.log("[SSE Debug] Parsed generic message data:", parsedData);

        // Check if this is an 'update' event from the stream implementation
        if (parsedData.type === 'update') {
          //console.log("[SSE Debug] Detected 'update' event from stream implementation");
          setLastEventData({ type: 'dashboardUpdate', payload: parsedData });
          setError(null);
        }

        // Update activity timestamp for any message
        lastActivityRef.current = Date.now();
      } catch (err) {
        console.error("[SSE Debug] Error parsing generic message data:", err);
      }
    };

    eventSource.onerror = (event) => {
      const timestamp = new Date().toISOString();
      const state = eventSource.readyState;
      const stateMap: Record<number, string> = {
        [EventSource.CONNECTING]: 'CONNECTING',
        [EventSource.OPEN]: 'OPEN',
        [EventSource.CLOSED]: 'CLOSED'
      };

      // Log detailed error information
      console.error(
        `[SSE Debug] [${timestamp}] Connection error\n` +
        `State: ${stateMap[state] || 'UNKNOWN'}\n` +
        `Attempt: ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts}\n` +
        `Last Activity: ${Math.round((Date.now() - lastActivityRef.current) / 1000)}s ago`
      );

      // Set user-friendly error messages with more context
      const errorMessages: Record<number, string> = {
        [EventSource.CONNECTING]: "Having trouble connecting to the server. Retrying...",
        [EventSource.OPEN]: "Connection interrupted. Attempting to restore...",
        [EventSource.CLOSED]: `Connection lost. Attempting to reconnect (Try ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})...`
      };

      setError(errorMessages[state] || "Connection error occurred. Checking connection status...");
      setIsConnected(false);

      // Implement reconnection with exponential backoff
      if (eventSource.readyState === EventSource.CLOSED) {
        //console.log("[SSE Debug] Connection definitely closed.");
        eventSource.close();

        // Attempt to reconnect with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000); // Max 30 seconds
          //console.log(`[SSE Debug] Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            setupEventSource();
          }, delay);
        } else {
          console.error("[SSE Debug] Maximum reconnection attempts reached. Giving up.");
          setError("Maximum reconnection attempts reached. Please refresh the page.");
        }
      } else {
        //console.log("[SSE Debug] Connection error, state:", eventSource.readyState);
      }
    };

    return eventSource;
  }, []);

  // Initialize the connection
  useEffect(() => {
    const eventSource = setupEventSource();

    // Setup health check interval to detect stale connections
    healthCheckIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;

      if (timeSinceLastActivity > CONNECTION_TIMEOUT_MS &&
        eventSourceRef.current &&
        eventSourceRef.current.readyState === EventSource.OPEN) {
        console.warn(`[SSE Debug] Connection appears stale (${Math.round(timeSinceLastActivity / 1000)}s without activity)`);

        // Force reconnection
        if (eventSourceRef.current) {
          //console.log("[SSE Debug] Closing stale connection and reconnecting");
          eventSourceRef.current.close();
          eventSourceRef.current = null;

          // Attempt immediate reconnection
          reconnectTimeoutRef.current = setTimeout(() => {
            setupEventSource();
          }, 1000);
        }
      }
    }, 10000); // Check every 10 seconds

    // Cleanup function
    return () => {
      if (eventSourceRef.current) {
        //console.log("[SSE Debug] Closing connection.");
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }

      setIsConnected(false);
    };
  }, [setupEventSource]);

  // Return the connection status and the last received event data
  return { lastEventData, isConnected, error };
};
