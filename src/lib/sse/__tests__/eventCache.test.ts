import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventCache } from '../eventCache';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn((index: number) => {
      return Object.keys(store)[index] || null;
    }),
    length: 0,
    get store() {
      this.length = Object.keys(store).length;
      return store;
    }
  };
})();

describe('EventCache', () => {
  let eventCache: EventCache;
  
  beforeEach(() => {
    // Set up mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });
    
    // Reset localStorage
    mockLocalStorage.clear();
    
    // Create a new EventCache instance
    eventCache = new EventCache();
    
    // Reset mocks
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    // Clean up
    vi.resetAllMocks();
  });
  
  it('should initialize from localStorage', () => {
    // Add some data to localStorage
    const events = [
      {
        id: 'event-1',
        type: 'notification',
        data: { message: 'Hello, world!' },
        timestamp: Date.now()
      }
    ];
    
    mockLocalStorage.setItem('sse-event-cache:notification', JSON.stringify(events));
    
    // Initialize the cache
    eventCache.initialize();
    
    // Check that the data was loaded
    expect(eventCache.getEvents('notification')).toEqual(events);
  });
  
  it('should add an event to the cache', () => {
    // Initialize the cache
    eventCache.initialize();
    
    // Add an event
    const event = {
      id: 'event-1',
      type: 'notification',
      data: { message: 'Hello, world!' },
      timestamp: Date.now()
    };
    
    eventCache.addEvent(event);
    
    // Check that the event was added
    expect(eventCache.getEvents('notification')).toEqual([event]);
    
    // Check that the event was persisted to localStorage
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'sse-event-cache:notification',
      JSON.stringify([event])
    );
  });
  
  it('should limit the cache size', () => {
    // Initialize the cache
    eventCache.initialize();
    
    // Add more events than the maximum cache size
    const events = Array.from({ length: 110 }, (_, i) => ({
      id: `event-${i}`,
      type: 'notification',
      data: { message: `Event ${i}` },
      timestamp: Date.now() - i * 1000
    }));
    
    events.forEach(event => eventCache.addEvent(event));
    
    // Check that the cache was limited to the maximum size
    expect(eventCache.getEvents('notification', 1000).length).toBe(100);
    
    // Check that the most recent events were kept
    expect(eventCache.getEvents('notification', 1)[0].id).toBe('event-109');
  });
  
  it('should get the latest event', () => {
    // Initialize the cache
    eventCache.initialize();
    
    // Add multiple events
    const events = [
      {
        id: 'event-1',
        type: 'notification',
        data: { message: 'First event' },
        timestamp: Date.now() - 1000
      },
      {
        id: 'event-2',
        type: 'notification',
        data: { message: 'Second event' },
        timestamp: Date.now()
      }
    ];
    
    events.forEach(event => eventCache.addEvent(event));
    
    // Check that the latest event is returned
    expect(eventCache.getLatestEvent('notification')).toEqual(events[1]);
  });
  
  it('should clear events of a specific type', () => {
    // Initialize the cache
    eventCache.initialize();
    
    // Add events of different types
    const notificationEvent = {
      id: 'event-1',
      type: 'notification',
      data: { message: 'Notification' },
      timestamp: Date.now()
    };
    
    const updateEvent = {
      id: 'event-2',
      type: 'update',
      data: { message: 'Update' },
      timestamp: Date.now()
    };
    
    eventCache.addEvent(notificationEvent);
    eventCache.addEvent(updateEvent);
    
    // Clear events of one type
    eventCache.clearEvents('notification');
    
    // Check that only the specified type was cleared
    expect(eventCache.getEvents('notification')).toEqual([]);
    expect(eventCache.getEvents('update')).toEqual([updateEvent]);
    
    // Check that localStorage was updated
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('sse-event-cache:notification');
  });
  
  it('should clear all events', () => {
    // Initialize the cache
    eventCache.initialize();
    
    // Add events of different types
    const notificationEvent = {
      id: 'event-1',
      type: 'notification',
      data: { message: 'Notification' },
      timestamp: Date.now()
    };
    
    const updateEvent = {
      id: 'event-2',
      type: 'update',
      data: { message: 'Update' },
      timestamp: Date.now()
    };
    
    eventCache.addEvent(notificationEvent);
    eventCache.addEvent(updateEvent);
    
    // Set up localStorage with cache items
    mockLocalStorage.setItem('sse-event-cache:notification', 'test');
    mockLocalStorage.setItem('sse-event-cache:update', 'test');
    mockLocalStorage.setItem('other-key', 'test');
    
    // Clear all events
    eventCache.clearAllEvents();
    
    // Check that all events were cleared
    expect(eventCache.getEvents('notification')).toEqual([]);
    expect(eventCache.getEvents('update')).toEqual([]);
    
    // Check that only cache items were removed from localStorage
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('sse-event-cache:notification');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('sse-event-cache:update');
    expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('other-key');
  });
});
