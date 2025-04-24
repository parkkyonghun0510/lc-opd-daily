'use client';

/**
 * SSE Event Cache
 * 
 * This module provides a client-side caching mechanism for SSE events.
 * It stores events in memory and localStorage for persistence across page refreshes.
 */

// Maximum number of events to store in the cache
const MAX_CACHE_SIZE = 100;

// Cache expiration time in milliseconds (1 hour)
const CACHE_EXPIRATION = 60 * 60 * 1000;

// Cache key prefix for localStorage
const CACHE_KEY_PREFIX = 'sse-event-cache:';

/**
 * Cached event structure
 */
export interface CachedEvent {
  id: string;
  type: string;
  data: any;
  timestamp: number;
}

/**
 * SSE Event Cache
 */
export class EventCache {
  private cache: Map<string, CachedEvent[]> = new Map();
  private isInitialized = false;
  
  /**
   * Initialize the cache from localStorage
   */
  initialize() {
    if (typeof window === 'undefined' || this.isInitialized) {
      return;
    }
    
    try {
      // Load cache from localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_KEY_PREFIX)) {
          const eventType = key.substring(CACHE_KEY_PREFIX.length);
          const cachedData = localStorage.getItem(key);
          
          if (cachedData) {
            try {
              const events = JSON.parse(cachedData) as CachedEvent[];
              this.cache.set(eventType, events);
            } catch (error) {
              console.error(`[SSE Cache] Error parsing cached events for ${eventType}:`, error);
              localStorage.removeItem(key);
            }
          }
        }
      }
      
      // Clean up expired events
      this.cleanupExpiredEvents();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('[SSE Cache] Error initializing cache:', error);
    }
  }
  
  /**
   * Add an event to the cache
   */
  addEvent(event: CachedEvent) {
    if (!this.isInitialized) {
      this.initialize();
    }
    
    try {
      // Get existing events for this type
      const events = this.cache.get(event.type) || [];
      
      // Add the new event
      events.unshift(event);
      
      // Limit the cache size
      if (events.length > MAX_CACHE_SIZE) {
        events.length = MAX_CACHE_SIZE;
      }
      
      // Update the cache
      this.cache.set(event.type, events);
      
      // Persist to localStorage
      this.persistToLocalStorage(event.type, events);
    } catch (error) {
      console.error('[SSE Cache] Error adding event to cache:', error);
    }
  }
  
  /**
   * Get events from the cache
   */
  getEvents(type: string, limit = 10): CachedEvent[] {
    if (!this.isInitialized) {
      this.initialize();
    }
    
    try {
      const events = this.cache.get(type) || [];
      return events.slice(0, limit);
    } catch (error) {
      console.error('[SSE Cache] Error getting events from cache:', error);
      return [];
    }
  }
  
  /**
   * Get the most recent event of a specific type
   */
  getLatestEvent(type: string): CachedEvent | null {
    if (!this.isInitialized) {
      this.initialize();
    }
    
    try {
      const events = this.cache.get(type) || [];
      return events.length > 0 ? events[0] : null;
    } catch (error) {
      console.error('[SSE Cache] Error getting latest event from cache:', error);
      return null;
    }
  }
  
  /**
   * Clear events of a specific type
   */
  clearEvents(type: string) {
    if (!this.isInitialized) {
      this.initialize();
    }
    
    try {
      this.cache.delete(type);
      localStorage.removeItem(`${CACHE_KEY_PREFIX}${type}`);
    } catch (error) {
      console.error('[SSE Cache] Error clearing events from cache:', error);
    }
  }
  
  /**
   * Clear all events
   */
  clearAllEvents() {
    if (!this.isInitialized) {
      this.initialize();
    }
    
    try {
      this.cache.clear();
      
      // Remove all SSE cache items from localStorage
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_KEY_PREFIX)) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('[SSE Cache] Error clearing all events from cache:', error);
    }
  }
  
  /**
   * Clean up expired events
   */
  private cleanupExpiredEvents() {
    try {
      const now = Date.now();
      
      // Check each event type
      for (const [type, events] of this.cache.entries()) {
        // Filter out expired events
        const validEvents = events.filter(event => {
          return now - event.timestamp < CACHE_EXPIRATION;
        });
        
        // Update the cache if events were removed
        if (validEvents.length !== events.length) {
          this.cache.set(type, validEvents);
          this.persistToLocalStorage(type, validEvents);
        }
      }
    } catch (error) {
      console.error('[SSE Cache] Error cleaning up expired events:', error);
    }
  }
  
  /**
   * Persist events to localStorage
   */
  private persistToLocalStorage(type: string, events: CachedEvent[]) {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      
      localStorage.setItem(`${CACHE_KEY_PREFIX}${type}`, JSON.stringify(events));
    } catch (error) {
      console.error('[SSE Cache] Error persisting events to localStorage:', error);
    }
  }
}

// Create a singleton instance
export const eventCache = new EventCache();
