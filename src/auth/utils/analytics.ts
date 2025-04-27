"use client";

/**
 * Authentication Analytics Module
 * 
 * This module provides functions for tracking authentication-related events.
 * It can be configured to send events to various analytics providers.
 */

// Define the event types
export enum AuthEventType {
  LOGIN_SUCCESS = 'auth:login_success',
  LOGIN_FAILURE = 'auth:login_failure',
  LOGOUT = 'auth:logout',
  SESSION_EXPIRED = 'auth:session_expired',
  SESSION_EXTENDED = 'auth:session_extended',
  PERMISSION_DENIED = 'auth:permission_denied',
  PROFILE_UPDATED = 'auth:profile_updated',
  PREFERENCES_UPDATED = 'auth:preferences_updated',
}

// Define the event data interface
export interface AuthEventData {
  userId?: string;
  username?: string;
  timestamp: number;
  userAgent?: string;
  location?: string;
  role?: string;
  error?: string;
  details?: Record<string, any>;
}

// Define the analytics configuration
interface AnalyticsConfig {
  enabled: boolean;
  debug: boolean;
  endpoint?: string;
  providers: {
    console: boolean;
    localStorage: boolean;
    server: boolean;
  };
}

// Default configuration
const defaultConfig: AnalyticsConfig = {
  enabled: process.env.NODE_ENV === 'production',
  debug: process.env.NODE_ENV === 'development',
  providers: {
    console: process.env.NODE_ENV === 'development',
    localStorage: true,
    server: process.env.NODE_ENV === 'production',
  },
};

// Current configuration
let config: AnalyticsConfig = { ...defaultConfig };

/**
 * Configure the analytics module
 * 
 * @param newConfig The new configuration
 */
export function configureAnalytics(newConfig: Partial<AnalyticsConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Track an authentication event
 * 
 * @param eventType The type of event
 * @param data The event data
 */
export async function trackAuthEvent(
  eventType: AuthEventType,
  data: Omit<AuthEventData, 'timestamp'>
): Promise<void> {
  if (!config.enabled) return;

  // Create the event object
  const event = {
    type: eventType,
    data: {
      ...data,
      timestamp: Date.now(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
    },
  };

  // Log to console if enabled
  if (config.providers.console) {
    console.group(`%c Auth Event: ${eventType}`, 'color: #3b82f6; font-weight: bold;');
    console.log('Data:', event.data);
    console.groupEnd();
  }

  // Store in localStorage if enabled
  if (config.providers.localStorage) {
    try {
      const storageKey = 'auth_events';
      const storedEvents = JSON.parse(localStorage.getItem(storageKey) || '[]');
      storedEvents.push(event);
      
      // Keep only the last 50 events
      if (storedEvents.length > 50) {
        storedEvents.shift();
      }
      
      localStorage.setItem(storageKey, JSON.stringify(storedEvents));
    } catch (error) {
      if (config.debug) {
        console.error('Failed to store auth event in localStorage:', error);
      }
    }
  }

  // Send to server if enabled
  if (config.providers.server && config.endpoint) {
    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!response.ok && config.debug) {
        console.error('Failed to send auth event to server:', await response.text());
      }
    } catch (error) {
      if (config.debug) {
        console.error('Failed to send auth event to server:', error);
      }
    }
  }
}

/**
 * Get the stored authentication events from localStorage
 * 
 * @returns The stored events
 */
export function getStoredAuthEvents(): Array<{
  type: AuthEventType;
  data: AuthEventData;
}> {
  if (typeof window === 'undefined') return [];

  try {
    const storageKey = 'auth_events';
    return JSON.parse(localStorage.getItem(storageKey) || '[]');
  } catch (error) {
    if (config.debug) {
      console.error('Failed to get stored auth events:', error);
    }
    return [];
  }
}

/**
 * Clear the stored authentication events from localStorage
 */
export function clearStoredAuthEvents(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem('auth_events');
  } catch (error) {
    if (config.debug) {
      console.error('Failed to clear stored auth events:', error);
    }
  }
}
