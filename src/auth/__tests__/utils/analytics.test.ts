import {
  trackAuthEvent,
  getStoredAuthEvents,
  clearStoredAuthEvents,
  configureAnalytics,
  AuthEventType,
} from "@/auth/utils/analytics";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

// Mock fetch
global.fetch = jest.fn();

describe("Analytics Utilities", () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Set up localStorage mock
    Object.defineProperty(window, "localStorage", { value: localStorageMock });

    // Reset localStorage
    localStorageMock.clear();

    // Configure analytics for testing
    configureAnalytics({
      enabled: true,
      debug: false,
      providers: {
        console: false,
        localStorage: true,
        server: false,
      },
    });
  });

  describe("trackAuthEvent", () => {
    it("should store event in localStorage", async () => {
      // Track event
      await trackAuthEvent(AuthEventType.LOGIN_SUCCESS, {
        userId: "1",
        username: "test@example.com",
        role: "USER",
      });

      // Check that localStorage.setItem was called
      expect(localStorageMock.setItem).toHaveBeenCalled();

      // Get the key and value from the call
      const key = localStorageMock.setItem.mock.calls[0][0];
      const value = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);

      // Check that the key is correct
      expect(key).toBe("auth_events");

      // Check that the value is an array with one event
      expect(Array.isArray(value)).toBe(true);
      expect(value.length).toBe(1);

      // Check that the event has the correct type and data
      expect(value[0].type).toBe(AuthEventType.LOGIN_SUCCESS);
      expect(value[0].data.userId).toBe("1");
      expect(value[0].data.username).toBe("test@example.com");
      expect(value[0].data.role).toBe("USER");
      expect(value[0].data.timestamp).toBeDefined();
    });

    it("should append event to existing events", async () => {
      // Set up existing events
      const existingEvents = [
        {
          type: AuthEventType.LOGIN_SUCCESS,
          data: {
            userId: "1",
            username: "test@example.com",
            role: "USER",
            timestamp: Date.now(),
          },
        },
      ];
      localStorageMock.setItem("auth_events", JSON.stringify(existingEvents));

      // Track event
      await trackAuthEvent(AuthEventType.LOGOUT, {
        userId: "1",
        username: "test@example.com",
        role: "USER",
      });

      // Check that localStorage.setItem was called
      expect(localStorageMock.setItem).toHaveBeenCalled();

      // Get the value from the call
      const value = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);

      // Check that the value is an array with two events
      expect(Array.isArray(value)).toBe(true);
      expect(value.length).toBe(2);

      // Check that the events have the correct types
      expect(value[0].type).toBe(AuthEventType.LOGIN_SUCCESS);
      expect(value[1].type).toBe(AuthEventType.LOGOUT);
    });

    it("should limit the number of stored events to 50", async () => {
      // Set up 50 existing events
      const existingEvents = Array.from({ length: 50 }, (_, i) => ({
        type: AuthEventType.LOGIN_SUCCESS,
        data: {
          userId: "1",
          username: "test@example.com",
          role: "USER",
          timestamp: Date.now() - i * 1000,
        },
      }));
      localStorageMock.setItem("auth_events", JSON.stringify(existingEvents));

      // Track event
      await trackAuthEvent(AuthEventType.LOGOUT, {
        userId: "1",
        username: "test@example.com",
        role: "USER",
      });

      // Check that localStorage.setItem was called
      expect(localStorageMock.setItem).toHaveBeenCalled();

      // Get the value from the call
      const value = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);

      // Check that the value is an array with 50 events (oldest one removed)
      expect(Array.isArray(value)).toBe(true);
      expect(value.length).toBe(50);

      // Check that the oldest event was removed and the new event was added
      expect(value[0].type).not.toBe(existingEvents[0].type);
      expect(value[49].type).toBe(AuthEventType.LOGOUT);
    });

    it("should send event to server when server provider is enabled", async () => {
      // Configure analytics with server provider
      configureAnalytics({
        enabled: true,
        debug: false,
        providers: {
          console: false,
          localStorage: true,
          server: true,
        },
        endpoint: "/api/auth/analytics",
      });

      // Mock fetch to return success
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      });

      // Track event
      await trackAuthEvent(AuthEventType.LOGIN_SUCCESS, {
        userId: "1",
        username: "test@example.com",
        role: "USER",
      });

      // Check that fetch was called
      expect(global.fetch).toHaveBeenCalled();

      // Check that fetch was called with the correct URL and data
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/auth/analytics",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: expect.any(String),
        }),
      );

      // Check that the body contains the correct event
      const body = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body,
      );
      expect(body.type).toBe(AuthEventType.LOGIN_SUCCESS);
      expect(body.data.userId).toBe("1");
      expect(body.data.username).toBe("test@example.com");
      expect(body.data.role).toBe("USER");
    });

    it("should not track events when disabled", async () => {
      // Configure analytics with disabled
      configureAnalytics({
        enabled: false,
        debug: false,
        providers: {
          console: false,
          localStorage: true,
          server: false,
        },
      });

      // Track event
      await trackAuthEvent(AuthEventType.LOGIN_SUCCESS, {
        userId: "1",
        username: "test@example.com",
        role: "USER",
      });

      // Check that localStorage.setItem was not called
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  describe("getStoredAuthEvents", () => {
    it("should return empty array when no events are stored", () => {
      // Get stored events
      const events = getStoredAuthEvents();

      // Check that events is an empty array
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(0);
    });

    it("should return stored events", () => {
      // Set up existing events
      const existingEvents = [
        {
          type: AuthEventType.LOGIN_SUCCESS,
          data: {
            userId: "1",
            username: "test@example.com",
            role: "USER",
            timestamp: Date.now(),
          },
        },
        {
          type: AuthEventType.LOGOUT,
          data: {
            userId: "1",
            username: "test@example.com",
            role: "USER",
            timestamp: Date.now(),
          },
        },
      ];
      localStorageMock.setItem("auth_events", JSON.stringify(existingEvents));

      // Get stored events
      const events = getStoredAuthEvents();

      // Check that events is an array with two events
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(2);

      // Check that the events have the correct types
      expect(events[0].type).toBe(AuthEventType.LOGIN_SUCCESS);
      expect(events[1].type).toBe(AuthEventType.LOGOUT);
    });

    it("should handle invalid JSON", () => {
      // Set up invalid JSON
      localStorageMock.setItem("auth_events", "invalid-json");

      // Get stored events
      const events = getStoredAuthEvents();

      // Check that events is an empty array
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(0);
    });
  });

  describe("clearStoredAuthEvents", () => {
    it("should remove events from localStorage", () => {
      // Set up existing events
      const existingEvents = [
        {
          type: AuthEventType.LOGIN_SUCCESS,
          data: {
            userId: "1",
            username: "test@example.com",
            role: "USER",
            timestamp: Date.now(),
          },
        },
      ];
      localStorageMock.setItem("auth_events", JSON.stringify(existingEvents));

      // Clear stored events
      clearStoredAuthEvents();

      // Check that localStorage.removeItem was called
      expect(localStorageMock.removeItem).toHaveBeenCalledWith("auth_events");
    });
  });

  describe("configureAnalytics", () => {
    it("should update configuration", async () => {
      // Configure analytics
      configureAnalytics({
        enabled: true,
        debug: true,
        providers: {
          console: true,
          localStorage: false,
          server: true,
        },
        endpoint: "/api/custom-analytics",
      });

      // Mock console.group and console.log
      const consoleGroupSpy = jest.spyOn(console, "group").mockImplementation();
      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

      // Mock fetch to return success
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      });

      // Track event
      await trackAuthEvent(AuthEventType.LOGIN_SUCCESS, {
        userId: "1",
        username: "test@example.com",
        role: "USER",
      });

      // Check that console.group was called (console provider enabled)
      expect(consoleGroupSpy).toHaveBeenCalled();

      // Check that console.log was called
      expect(consoleLogSpy).toHaveBeenCalled();

      // Check that localStorage.setItem was not called (localStorage provider disabled)
      expect(localStorageMock.setItem).not.toHaveBeenCalled();

      // Check that fetch was called with the custom endpoint
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/custom-analytics",
        expect.any(Object),
      );

      // Restore console spies
      consoleGroupSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });
  });
});
