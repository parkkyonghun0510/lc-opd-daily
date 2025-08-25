/**
 * Standardized SSE Event Types and Formats
 * 
 * This module defines the standard event types, data structures, and utilities
 * for consistent SSE communication across the application.
 */

// Standard SSE event types
export enum SSEEventType {
  // Connection events
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  DISCONNECTING = 'disconnecting',
  PING = 'ping',
  PONG = 'pong',
  ERROR = 'error',
  
  // Application events
  NOTIFICATION = 'notification',
  DASHBOARD_UPDATE = 'dashboardUpdate',
  REPORT_UPDATE = 'reportUpdate',
  USER_UPDATE = 'userUpdate',
  SYSTEM_ALERT = 'systemAlert',
  
  // Custom events
  CUSTOM = 'custom'
}

// Event priority levels
export enum SSEEventPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Base event interface
export interface SSEEventBase {
  id: string;
  type: SSEEventType | string;
  timestamp: number;
  priority: SSEEventPriority;
  source: string; // Source of the event (e.g., 'server', 'worker', 'admin')
  version: string; // Event format version
}

// Event with data payload
export interface SSEEvent<T = any> extends SSEEventBase {
  data: T;
  metadata?: {
    userId?: string;
    sessionId?: string;
    requestId?: string;
    correlationId?: string;
    tags?: string[];
    [key: string]: any;
  };
}

// Connection event data
export interface ConnectionEventData {
  clientId: string;
  message: string;
  serverInfo?: {
    version: string;
    capabilities: string[];
    pingInterval: number;
  };
  clientInfo?: {
    userAgent?: string;
    ip?: string;
    connectedAt?: string;
    authMethod?: string;
  };
}

// Ping/Pong event data
export interface PingEventData {
  clientId: string;
  timestamp: number;
  serverTime: string;
  connectionDuration?: number;
  sequence?: number;
}

// Notification event data
export interface NotificationEventData {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  icon?: string;
  url?: string;
  actions?: {
    label: string;
    action: string;
    url?: string;
  }[];
  persistent?: boolean;
  expires?: number;
}

// Dashboard update event data
export interface DashboardUpdateEventData {
  updateType: 'stats' | 'reports' | 'users' | 'notifications';
  data: any;
  affectedUsers?: string[];
  affectedRoles?: string[];
}

// Error event data
export interface ErrorEventData {
  code: string;
  message: string;
  details?: any;
  recoverable: boolean;
  retryAfter?: number;
  supportInfo?: {
    contactEmail?: string;
    documentationUrl?: string;
  };
}

// System alert event data
export interface SystemAlertEventData {
  alertType: 'maintenance' | 'security' | 'performance' | 'feature';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  startTime?: string;
  endTime?: string;
  affectedServices?: string[];
  actionRequired?: boolean;
}

/**
 * SSE Event Builder - Utility for creating standardized events
 */
export class SSEEventBuilder {
  private static version = '1.0';
  
  /**
   * Create a standardized SSE event
   */
  static createEvent<T>(
    type: SSEEventType | string,
    data: T,
    options: {
      id?: string;
      priority?: SSEEventPriority;
      source?: string;
      metadata?: SSEEvent['metadata'];
    } = {}
  ): SSEEvent<T> {
    return {
      id: options.id || this.generateEventId(),
      type,
      timestamp: Date.now(),
      priority: options.priority || SSEEventPriority.NORMAL,
      source: options.source || 'server',
      version: this.version,
      data,
      metadata: options.metadata
    };
  }
  
  /**
   * Create a connection event
   */
  static createConnectionEvent(
    clientId: string,
    message: string,
    serverInfo?: ConnectionEventData['serverInfo'],
    clientInfo?: ConnectionEventData['clientInfo']
  ): SSEEvent<ConnectionEventData> {
    return this.createEvent(SSEEventType.CONNECTED, {
      clientId,
      message,
      serverInfo,
      clientInfo
    }, {
      priority: SSEEventPriority.HIGH,
      source: 'server'
    });
  }
  
  /**
   * Create a ping event
   */
  static createPingEvent(
    clientId: string,
    sequence?: number
  ): SSEEvent<PingEventData> {
    return this.createEvent(SSEEventType.PING, {
      clientId,
      timestamp: Date.now(),
      serverTime: new Date().toISOString(),
      sequence
    }, {
      priority: SSEEventPriority.LOW,
      source: 'server'
    });
  }
  
  /**
   * Create a notification event
   */
  static createNotificationEvent(
    notification: NotificationEventData,
    targetUsers?: string[]
  ): SSEEvent<NotificationEventData> {
    return this.createEvent(SSEEventType.NOTIFICATION, notification, {
      priority: notification.type === 'error' ? SSEEventPriority.HIGH : SSEEventPriority.NORMAL,
      source: 'notification-service',
      metadata: {
        userIds: targetUsers
      }
    });
  }
  
  /**
   * Create a dashboard update event
   */
  static createDashboardUpdateEvent(
    updateData: DashboardUpdateEventData
  ): SSEEvent<DashboardUpdateEventData> {
    return this.createEvent(SSEEventType.DASHBOARD_UPDATE, updateData, {
      priority: SSEEventPriority.NORMAL,
      source: 'dashboard-service',
      metadata: {
        userIds: updateData.affectedUsers,
        roles: updateData.affectedRoles
      }
    });
  }
  
  /**
   * Create an error event
   */
  static createErrorEvent(
    error: ErrorEventData
  ): SSEEvent<ErrorEventData> {
    return this.createEvent(SSEEventType.ERROR, error, {
      priority: SSEEventPriority.HIGH,
      source: 'error-handler'
    });
  }
  
  /**
   * Create a system alert event
   */
  static createSystemAlertEvent(
    alert: SystemAlertEventData
  ): SSEEvent<SystemAlertEventData> {
    const priority = alert.severity === 'critical' || alert.severity === 'high' 
      ? SSEEventPriority.CRITICAL 
      : SSEEventPriority.NORMAL;
      
    return this.createEvent(SSEEventType.SYSTEM_ALERT, alert, {
      priority,
      source: 'system-monitor'
    });
  }
  
  /**
   * Generate a unique event ID
   */
  private static generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * SSE Message Formatter - Formats events for transmission
 */
export class SSEMessageFormatter {
  /**
   * Format an SSE event for transmission
   */
  static formatEvent(event: SSEEvent): string {
    let message = '';
    
    // Add event type
    message += `event: ${event.type}\n`;
    
    // Add event ID
    message += `id: ${event.id}\n`;
    
    // Add retry directive for important events
    if (event.priority === SSEEventPriority.HIGH || event.priority === SSEEventPriority.CRITICAL) {
      message += `retry: 1000\n`; // Retry after 1 second
    }
    
    // Add the data
    const eventData = {
      ...event,
      // Include timestamp in ISO format for better readability
      timestampISO: SSEEventUtils.formatTimestamp(event.timestamp)
    };
    
    message += `data: ${JSON.stringify(eventData)}\n\n`;
    
    return message;
  }
  
  /**
   * Format a simple message (for backward compatibility)
   */
  static formatSimpleMessage(
    type: string,
    data: any,
    id?: string
  ): string {
    let message = '';
    
    if (type) {
      message += `event: ${type}\n`;
    }
    
    if (id) {
      message += `id: ${id}\n`;
    }
    
    message += `data: ${JSON.stringify(data)}\n\n`;
    
    return message;
  }
  
  /**
   * Create a heartbeat message
   */
  static createHeartbeat(clientId?: string): string {
    const heartbeatEvent = SSEEventBuilder.createPingEvent(clientId || 'unknown');
    return this.formatEvent(heartbeatEvent);
  }
  
  /**
   * Create an error message
   */
  static createErrorMessage(
    error: string | Error,
    code?: string,
    recoverable: boolean = true
  ): string {
    const errorData: ErrorEventData = {
      code: code || 'UNKNOWN_ERROR',
      message: typeof error === 'string' ? error : error.message,
      details: typeof error === 'object' ? error : undefined,
      recoverable
    };
    
    const errorEvent = SSEEventBuilder.createErrorEvent(errorData);
    return this.formatEvent(errorEvent);
  }
}

/**
 * Utility functions for event validation and processing
 */
export class SSEEventUtils {
  /**
   * Safely format timestamp to ISO string
   */
  static formatTimestamp(timestamp: any): string {
    // Handle null, undefined, or invalid values
    if (timestamp === null || timestamp === undefined) {
      return new Date().toISOString(); // Use current time as fallback
    }
    
    // Try to create a Date object
    const date = new Date(timestamp);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.warn(`[SSE] Invalid timestamp value: ${timestamp}, using current time`);
      return new Date().toISOString(); // Use current time as fallback
    }
    
    return date.toISOString();
  }

  /**
   * Validate an SSE event structure
   */
  static validateEvent(event: any): event is SSEEvent {
    return (
      typeof event === 'object' &&
      typeof event.id === 'string' &&
      typeof event.type === 'string' &&
      typeof event.timestamp === 'number' &&
      typeof event.priority === 'string' &&
      typeof event.source === 'string' &&
      typeof event.version === 'string' &&
      event.data !== undefined
    );
  }
  
  /**
   * Check if an event should be sent to a specific user
   */
  static shouldSendToUser(
    event: SSEEvent,
    userId: string,
    userRole?: string
  ): boolean {
    const metadata = event.metadata;
    
    // If no targeting metadata, send to all
    if (!metadata) return true;
    
    // Check user ID targeting
    if (metadata.userIds && Array.isArray(metadata.userIds)) {
      if (!metadata.userIds.includes(userId)) {
        return false;
      }
    }
    
    // Check role targeting
    if (metadata.roles && Array.isArray(metadata.roles) && userRole) {
      if (!metadata.roles.includes(userRole)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Get event age in milliseconds
   */
  static getEventAge(event: SSEEvent): number {
    return Date.now() - event.timestamp;
  }
  
  /**
   * Check if an event has expired
   */
  static isEventExpired(event: SSEEvent, maxAge: number = 5 * 60 * 1000): boolean {
    return this.getEventAge(event) > maxAge;
  }
  
  /**
   * Filter events by type
   */
  static filterEventsByType(events: SSEEvent[], types: (SSEEventType | string)[]): SSEEvent[] {
    return events.filter(event => types.includes(event.type));
  }
  
  /**
   * Sort events by priority and timestamp
   */
  static sortEventsByPriority(events: SSEEvent[]): SSEEvent[] {
    const priorityOrder = {
      [SSEEventPriority.CRITICAL]: 4,
      [SSEEventPriority.HIGH]: 3,
      [SSEEventPriority.NORMAL]: 2,
      [SSEEventPriority.LOW]: 1
    };
    
    return events.sort((a, b) => {
      // First sort by priority
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by timestamp (newer first)
      return b.timestamp - a.timestamp;
    });
  }
}