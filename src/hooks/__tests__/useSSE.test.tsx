import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSSE } from '../useSSE';
import { eventCache } from '@/lib/sse/eventCache';

// Mock dependencies
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated'
  })
}));

vi.mock('@/lib/sse/eventCache', () => ({
  eventCache: {
    initialize: vi.fn(),
    addEvent: vi.fn(),
    getLatestEvent: vi.fn(),
    getEvents: vi.fn(),
    clearEvents: vi.fn(),
    clearAllEvents: vi.fn()
  }
}));

// Mock EventSource
class MockEventSource {
  url: string;
  readyState: number = 0;
  onopen: Function | null = null;
  onmessage: Function | null = null;
  onerror: Function | null = null;
  addEventListener: Mock = vi.fn();
  close: Mock = vi.fn();
  
  constructor(url: string) {
    this.url = url;
  }
}

// Store the original EventSource
const OriginalEventSource = global.EventSource;

describe('useSSE Hook', () => {
  beforeEach(() => {
    // Mock EventSource
    global.EventSource = MockEventSource as any;
    
    // Mock crypto.randomUUID
    global.crypto = {
      ...global.crypto,
      randomUUID: () => 'test-uuid'
    };
    
    // Reset mocks
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    // Restore EventSource
    global.EventSource = OriginalEventSource;
  });
  
  it('should initialize with default options', () => {
    const { result } = renderHook(() => useSSE());
    
    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.lastEvent).toBe(null);
    expect(typeof result.current.reconnect).toBe('function');
    expect(typeof result.current.closeConnection).toBe('function');
  });
  
  it('should connect to the SSE endpoint', () => {
    renderHook(() => useSSE());
    
    // Check that EventSource was created with the correct URL
    expect(MockEventSource).toHaveBeenCalledWith('/api/sse');
  });
  
  it('should use a custom endpoint if provided', () => {
    renderHook(() => useSSE({ endpoint: '/api/custom-sse' }));
    
    // Check that EventSource was created with the custom URL
    expect(MockEventSource).toHaveBeenCalledWith('/api/custom-sse');
  });
  
  it('should set up event listeners', () => {
    renderHook(() => useSSE());
    
    // Check that event listeners were added
    const mockEventSource = MockEventSource.mock.instances[0];
    expect(mockEventSource.addEventListener).toHaveBeenCalledWith('connected', expect.any(Function));
    expect(mockEventSource.addEventListener).toHaveBeenCalledWith('notification', expect.any(Function));
    expect(mockEventSource.addEventListener).toHaveBeenCalledWith('update', expect.any(Function));
    expect(mockEventSource.addEventListener).toHaveBeenCalledWith('ping', expect.any(Function));
  });
  
  it('should handle connection open', () => {
    const { result } = renderHook(() => useSSE());
    
    // Simulate connection open
    const mockEventSource = MockEventSource.mock.instances[0];
    act(() => {
      mockEventSource.onopen && mockEventSource.onopen();
    });
    
    // Check that isConnected was updated
    expect(result.current.isConnected).toBe(true);
  });
  
  it('should handle connection error', () => {
    const { result } = renderHook(() => useSSE());
    
    // Simulate connection error
    const mockEventSource = MockEventSource.mock.instances[0];
    act(() => {
      mockEventSource.onerror && mockEventSource.onerror(new Event('error'));
    });
    
    // Check that isConnected and error were updated
    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBe('Connection error');
  });
  
  it('should handle events', () => {
    const eventHandler = vi.fn();
    const { result } = renderHook(() => useSSE({
      eventHandlers: {
        'test-event': eventHandler
      }
    }));
    
    // Simulate an event
    const mockEventSource = MockEventSource.mock.instances[0];
    const eventListener = mockEventSource.addEventListener.mock.calls.find(
      call => call[0] === 'test-event'
    )[1];
    
    act(() => {
      eventListener({
        data: JSON.stringify({ message: 'Hello, world!' })
      });
    });
    
    // Check that the event handler was called
    expect(eventHandler).toHaveBeenCalledWith({ message: 'Hello, world!' });
    
    // Check that lastEvent was updated
    expect(result.current.lastEvent).toEqual({
      type: 'test-event',
      payload: { message: 'Hello, world!' },
      timestamp: expect.any(Number)
    });
  });
  
  it('should cache events when enableCache is true', () => {
    renderHook(() => useSSE({ enableCache: true }));
    
    // Simulate an event
    const mockEventSource = MockEventSource.mock.instances[0];
    const eventListener = mockEventSource.addEventListener.mock.calls.find(
      call => call[0] === 'notification'
    )[1];
    
    act(() => {
      eventListener({
        data: JSON.stringify({ message: 'Hello, world!' })
      });
    });
    
    // Check that the event was cached
    expect(eventCache.addEvent).toHaveBeenCalledWith({
      id: 'test-uuid',
      type: 'notification',
      data: { message: 'Hello, world!' },
      timestamp: expect.any(Number)
    });
  });
  
  it('should not cache events when enableCache is false', () => {
    renderHook(() => useSSE({ enableCache: false }));
    
    // Simulate an event
    const mockEventSource = MockEventSource.mock.instances[0];
    const eventListener = mockEventSource.addEventListener.mock.calls.find(
      call => call[0] === 'notification'
    )[1];
    
    act(() => {
      eventListener({
        data: JSON.stringify({ message: 'Hello, world!' })
      });
    });
    
    // Check that the event was not cached
    expect(eventCache.addEvent).not.toHaveBeenCalled();
  });
  
  it('should close the connection when unmounted', () => {
    const { unmount } = renderHook(() => useSSE());
    
    // Unmount the hook
    unmount();
    
    // Check that the connection was closed
    const mockEventSource = MockEventSource.mock.instances[0];
    expect(mockEventSource.close).toHaveBeenCalled();
  });
  
  it('should reconnect when the reconnect function is called', () => {
    const { result } = renderHook(() => useSSE());
    
    // Clear the mock to reset the call count
    MockEventSource.mockClear();
    
    // Call the reconnect function
    act(() => {
      result.current.reconnect();
    });
    
    // Check that a new EventSource was created
    expect(MockEventSource).toHaveBeenCalledTimes(1);
  });
});
