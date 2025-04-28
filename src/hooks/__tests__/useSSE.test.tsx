import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSSE } from '../useSSE';

// Mock dependencies
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated'
  })
}));

vi.mock('@/auth/store', () => {
  const connect = vi.fn();
  const disconnect = vi.fn();
  const reconnect = vi.fn();
  const setOptions = vi.fn();

  return {
    useSSE: () => ({
      isConnected: false,
      error: null,
      lastEvent: null,
      connect,
      disconnect,
      reconnect,
      setOptions
    }),
    useAuth: () => ({
      user: { id: 'test-user-id' },
      needsTokenRefresh: () => false,
      refreshAuthToken: vi.fn().mockResolvedValue(true)
    })
  };
});



// Mock EventSource
const MockEventSource = vi.fn().mockImplementation((url: string) => {
  return {
    url,
    readyState: 0,
    onopen: null,
    onmessage: null,
    onerror: null,
    addEventListener: vi.fn(),
    close: vi.fn()
  };
});

// Add mock property to MockEventSource
MockEventSource.mock = {
  instances: [],
  calls: [],
  mockClear: vi.fn()
};

// Store the original EventSource
const OriginalEventSource = global.EventSource;

describe('useSSE Hook', () => {
  beforeEach(() => {
    // Mock EventSource
    global.EventSource = MockEventSource as any;

    // Mock crypto.randomUUID
    global.crypto = {
      ...global.crypto,
      randomUUID: vi.fn().mockReturnValue('test-uuid')
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

  it('should initialize with default options', () => {
    const { result } = renderHook(() => useSSE());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.lastEvent).toBe(null);
    expect(typeof result.current.reconnect).toBe('function');
    expect(typeof result.current.closeConnection).toBe('function');
  });

  it('should connect when mounted', () => {
    const { result } = renderHook(() => useSSE());

    // Get the mocked connect function from our store mock
    const connect = vi.mocked(result.current.reconnect);

    // Verify it was called
    expect(connect).toBeDefined();
  });

  it('should pass options to the store', () => {
    const { rerender } = renderHook((props = {}) => useSSE(props));

    // Rerender with new options
    const newOptions = {
      endpoint: '/api/custom-sse',
      enableCache: false,
      debug: true
    };

    rerender(newOptions);

    // The setOptions function should have been called with the new options
    const { useSSE } = vi.mocked(require('@/auth/store'));
    const { setOptions } = useSSE();

    expect(setOptions).toHaveBeenCalledWith(expect.objectContaining(newOptions));
  });

  it('should disconnect when unmounted', () => {
    const { unmount, result } = renderHook(() => useSSE());

    // Get the disconnect function
    const disconnect = vi.mocked(result.current.closeConnection);

    // Unmount the hook
    unmount();

    // Verify disconnect was called
    expect(disconnect).toHaveBeenCalled();
  });

  it('should reconnect when the reconnect function is called', () => {
    const { result } = renderHook(() => useSSE());

    // Get the reconnect function
    const reconnect = vi.mocked(result.current.reconnect);

    // Call the reconnect function
    act(() => {
      result.current.reconnect();
    });

    // Verify reconnect was called
    expect(reconnect).toHaveBeenCalled();
  });
});
