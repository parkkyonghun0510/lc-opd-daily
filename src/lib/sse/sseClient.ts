"use client";

import {
  EventType as SSEEventType,
  RealtimeEvent as SSEEvent,
} from "@/auth/store/slices/hybridRealtimeSlice";

/**
 * SSE Client Configuration
 */
export interface SSEClientConfig {
  /**
   * The SSE endpoint URL
   */
  endpoint: string;

  /**
   * User ID for the connection
   */
  userId?: string;

  /**
   * Client type (e.g., 'dashboard', 'notification')
   */
  clientType?: string;

  /**
   * Additional client metadata
   */
  metadata?: Record<string, string>;

  /**
   * Event handlers for specific event types
   */
  eventHandlers?: Partial<Record<SSEEventType, (data: unknown) => void>>;

  /**
   * Whether to automatically reconnect on connection loss
   */
  autoReconnect?: boolean;

  /**
   * Maximum number of reconnection attempts
   */
  maxReconnectAttempts?: number;

  /**
   * Whether to enable debug logging
   */
  debug?: boolean;
}

/**
 * SSE Client Status
 */
export type SSEClientStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

/**
 * SSE Client Class
 *
 * A standardized client for Server-Sent Events (SSE) connections.
 */
export class SSEClient {
  private eventSource: EventSource | null = null;
  private config: SSEClientConfig;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private lastActivity = 0;
  private status: SSEClientStatus = "disconnected";
  private lastEvent: SSEEvent | null = null;
  private error: Error | null = null;

  /**
   * Create a new SSE client
   */
  constructor(config: SSEClientConfig) {
    this.config = {
      autoReconnect: true,
      maxReconnectAttempts: 5,
      debug: false,
      ...config,
    };
  }

  /**
   * Connect to the SSE endpoint
   */
  connect(): void {
    if (this.eventSource) {
      this.log("Already connected");
      return;
    }

    this.status = "connecting";
    this.setupConnection();
  }

  /**
   * Disconnect from the SSE endpoint
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.status = "disconnected";
    this.log("Disconnected from SSE endpoint");
  }

  /**
   * Get the current connection status
   */
  getStatus(): SSEClientStatus {
    return this.status;
  }

  /**
   * Get the last received event
   */
  getLastEvent(): SSEEvent | null {
    return this.lastEvent;
  }

  /**
   * Get the last error
   */
  getError(): Error | null {
    return this.error;
  }

  /**
   * Set up the SSE connection
   */
  private setupConnection(): void {
    try {
      // Build the SSE URL with authentication and metadata
      const url = new URL(this.config.endpoint, window.location.origin);

      // Add user ID if available
      if (this.config.userId) {
        url.searchParams.append("userId", this.config.userId);
      }

      // Add client type if available
      if (this.config.clientType) {
        url.searchParams.append("clientType", this.config.clientType);
      }

      // Add client info
      url.searchParams.append("clientInfo", navigator.userAgent);

      // Add any custom metadata
      if (this.config.metadata) {
        Object.entries(this.config.metadata).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }

      this.log(`Connecting to SSE endpoint: ${url.toString()}`);

      // Create the EventSource
      this.eventSource = new EventSource(url.toString());

      // Connection opened
      this.eventSource.onopen = () => {
        this.log("SSE connection opened");
        this.reconnectAttempts = 0;
        this.status = "connected";
        this.error = null;
        this.lastActivity = Date.now();
      };

      // Generic message handler (for unnamed events)
      this.eventSource.onmessage = (event) => {
        this.log("Received generic SSE message:", event.data);
        try {
          const data = JSON.parse(event.data);
          this.lastActivity = Date.now();

          // Handle as a generic update event
          const eventType = data.type || "message";
          const timestamp = data.timestamp || Date.now();

          this.lastEvent = {
            id: crypto.randomUUID(),
            type: eventType,
            data: data,
            timestamp,
          };

          // Call the appropriate event handler if defined
          const handler = this.config.eventHandlers?.[eventType];
          if (handler) {
            handler(data);
          }
        } catch (err) {
          console.error("Error parsing SSE message:", err);
        }
      };

      // Set up handlers for specific event types
      this.setupEventHandlers();

      // Error handler
      this.eventSource.onerror = (err) => {
        this.log("SSE connection error:", err);
        this.status = "error";
        this.error = new Error("Connection error");

        // Close the connection
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }

        // Attempt to reconnect if enabled
        if (this.config.autoReconnect) {
          this.attemptReconnect();
        }
      };
    } catch (err) {
      console.error("Error setting up SSE connection:", err);
      this.status = "error";
      this.error =
        err instanceof Error
          ? err
          : new Error("Failed to establish connection");
    }
  }

  /**
   * Set up event handlers for specific event types
   */
  private setupEventHandlers(): void {
    if (!this.eventSource || !this.config.eventHandlers) {
      return;
    }

    // Common event types
    const commonEventTypes = [
      "connected",
      "notification",
      "update",
      "ping",
      "dashboardUpdate",
      "systemAlert",
    ];

    // Set up handlers for common event types
    commonEventTypes.forEach((eventType) => {
      this.setupEventHandler(eventType);
    });

    // Set up handlers for any additional event types
    Object.keys(this.config.eventHandlers).forEach((eventType) => {
      if (!commonEventTypes.includes(eventType)) {
        this.setupEventHandler(eventType);
      }
    });
  }

  /**
   * Set up an event handler for a specific event type
   */
  private setupEventHandler(eventType: string): void {
    if (!this.eventSource) {
      return;
    }

    this.eventSource.addEventListener(eventType, (event) => {
      this.log(`Received '${eventType}' event:`, event.data);
      try {
        const data = JSON.parse(event.data);
        this.lastActivity = Date.now();

        const timestamp = data.timestamp || Date.now();
        this.lastEvent = {
          id: crypto.randomUUID(),
          type: eventType,
          data: data,
          timestamp,
        };

        // Call the appropriate event handler if defined
        const handler = this.config.eventHandlers?.[eventType];
        if (handler) {
          handler(data);
        }
      } catch (err) {
        console.error(`Error parsing '${eventType}' event:`, err);
      }
    });
  }

  /**
   * Attempt to reconnect to the SSE endpoint
   */
  private attemptReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const maxAttempts = this.config.maxReconnectAttempts || 5;

    if (this.reconnectAttempts < maxAttempts) {
      // Exponential backoff with jitter
      const delay =
        Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000) +
        Math.random() * 1000;

      this.log(
        `Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts + 1}/${maxAttempts})`,
      );

      this.reconnectTimeout = setTimeout(() => {
        this.reconnectAttempts += 1;
        this.setupConnection();
      }, delay);
    } else {
      this.log("Maximum reconnection attempts reached");

      // After reaching max attempts, try one final reconnection after a longer delay (5 minutes)
      this.reconnectTimeout = setTimeout(
        () => {
          this.log("Attempting final reconnection after cooling period");
          this.reconnectAttempts = 0;
          this.setupConnection();
        },
        5 * 60 * 1000,
      );
    }
  }

  /**
   * Log a message if debug is enabled
   */
  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log("[SSE Client]", ...args);
    }
  }
}

/**
 * Create a new SSE client
 */
export function createSSEClient(config: SSEClientConfig): SSEClient {
  return new SSEClient(config);
}
