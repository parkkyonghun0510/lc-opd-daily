import { useEffect, useState, useRef } from "react";

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

  useEffect(() => {
    setIsConnected(false);
    setError(null);
    // Connect to the new SSE endpoint
    const eventSource = new EventSource("/api/dashboard/sse");
    eventSourceRef.current = eventSource;
    console.log("[SSE] Attempting to connect to /api/dashboard/sse");

    eventSource.onopen = () => {
      console.log("[SSE] Connection established");
      setIsConnected(true);
      setError(null);
    };

    // Listen for the 'connected' event from the server
    eventSource.addEventListener('connected', (event) => {
      console.log("[SSE] Received 'connected' event:", event.data);
      try {
        const parsedData = JSON.parse(event.data);
        // You might want to do something with the connection message
        // setLastEventData({ type: 'connected', payload: parsedData });
      } catch (err) {
        console.error("[SSE] Error parsing 'connected' event data:", err);
      }
    });

    // Listen for 'dashboardUpdate' events
    eventSource.addEventListener('dashboardUpdate', (event) => {
      console.log("[SSE] Received 'dashboardUpdate' event:", event.data);
      try {
        const parsedData = JSON.parse(event.data);
        setLastEventData({ type: 'dashboardUpdate', payload: parsedData });
        setError(null); // Clear previous errors on successful update
      } catch (err) {
        setError("Failed to parse dashboardUpdate event data");
        console.error("[SSE] Error parsing 'dashboardUpdate' event data:", err);
      }
    });

    // Generic message handler (optional, if server sends unnamed events)
    // eventSource.onmessage = (event) => {
    //   console.log("[SSE] Received generic message:", event.data);
    //   // Handle generic messages if needed
    // };

    eventSource.onerror = (err) => {
      console.error("[SSE] Connection error:", err);
      setError("SSE connection failed or was closed.");
      setIsConnected(false);
      // Don't close here immediately, EventSource might retry
      // Check event.target.readyState, if CLOSED, then close
      if (eventSource.readyState === EventSource.CLOSED) {
          console.log("[SSE] Connection definitely closed.");
          eventSource.close();
      } else {
          console.log("[SSE] Connection error, state:", eventSource.readyState);
      }
    };

    return () => {
      if (eventSourceRef.current) {
        console.log("[SSE] Closing connection.");
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, []);

  // Return the connection status and the last received event data
  return { lastEventData, isConnected, error };
};
