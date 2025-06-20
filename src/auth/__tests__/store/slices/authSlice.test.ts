import { createAuthSlice, AuthSlice } from "@/auth/store/slices/authSlice";
import { act } from "@testing-library/react";
import { signIn, signOut } from "next-auth/react";

// Mock next-auth
jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

// Mock sonner toast
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock analytics
jest.mock("@/auth/utils/analytics", () => ({
  trackAuthEvent: jest.fn(),
  AuthEventType: {
    LOGIN_SUCCESS: "auth:login_success",
    LOGIN_FAILURE: "auth:login_failure",
    LOGOUT: "auth:logout",
    SESSION_EXPIRED: "auth:session_expired",
    SESSION_EXTENDED: "auth:session_extended",
    PERMISSION_DENIED: "auth:permission_denied",
    PROFILE_UPDATED: "auth:profile_updated",
    PREFERENCES_UPDATED: "auth:preferences_updated",
  },
}));

describe("AuthSlice", () => {
  let store: AuthSlice;
  let set: jest.Mock;
  let get: jest.Mock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock window.location.href
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
    });

    // Create mock set and get functions
    set = jest.fn();
    get = jest.fn();

    // Initialize store with mock functions
    store = createAuthSlice(set, get, {});

    // Set up get to return the store
    get.mockImplementation(() => store);
  });

  describe("Initial state", () => {
    it("should have the correct initial state", () => {
      expect(store.user).toBeNull();
      expect(store.isLoading).toBe(false);
      expect(store.isAuthenticated).toBe(false);
      expect(store.error).toBeNull();
      expect(store.lastActivity).toBeDefined();
      expect(store.sessionExpiresAt).toBeNull();
    });
  });

  describe("login", () => {
    it("should set loading state and clear errors when called", async () => {
      // Mock signIn to return success
      (signIn as jest.Mock).mockResolvedValue({ ok: true });

      // Call login
      await store.login("test@example.com", "password");

      // Check that set was called with loading true and error null
      expect(set).toHaveBeenCalledWith({
        isLoading: true,
        error: null,
        lastActivity: expect.any(Number),
      });
    });

    it("should update state on successful login", async () => {
      // Mock signIn to return success
      (signIn as jest.Mock).mockResolvedValue({ ok: true });

      // Call login
      await store.login("test@example.com", "password");

      // Check that set was called with authenticated true
      expect(set).toHaveBeenCalledWith({
        isAuthenticated: true,
        isLoading: false,
        sessionExpiresAt: expect.any(Number),
      });
    });

    it("should handle login failure", async () => {
      // Mock signIn to return failure
      (signIn as jest.Mock).mockResolvedValue({
        ok: false,
        error: "Invalid credentials",
      });

      // Call login
      const result = await store.login("test@example.com", "wrong-password");

      // Check that set was called with error message
      expect(set).toHaveBeenCalledWith({
        error: "Invalid email or password",
        isLoading: false,
      });

      // Check that login returned false
      expect(result).toBe(false);
    });

    it("should handle specific error messages", async () => {
      // Test different error messages
      const errorTests = [
        {
          error: "No branch assigned",
          expected:
            "Your account has no branch assigned. Please contact your administrator.",
        },
        {
          error: "Account is inactive",
          expected:
            "Your account is inactive. Please contact your administrator.",
        },
        {
          error: "Invalid credentials",
          expected: "Invalid email or password",
        },
      ];

      for (const test of errorTests) {
        // Reset mocks
        jest.clearAllMocks();

        // Mock signIn to return specific error
        (signIn as jest.Mock).mockResolvedValue({
          ok: false,
          error: test.error,
        });

        // Call login
        await store.login("test@example.com", "password");

        // Check that set was called with expected error message
        expect(set).toHaveBeenCalledWith({
          error: test.expected,
          isLoading: false,
        });
      }
    });

    it("should handle exceptions", async () => {
      // Mock signIn to throw error
      (signIn as jest.Mock).mockRejectedValue(new Error("Network error"));

      // Call login
      const result = await store.login("test@example.com", "password");

      // Check that set was called with error message
      expect(set).toHaveBeenCalledWith({
        error: "An error occurred during sign in",
        isLoading: false,
      });

      // Check that login returned false
      expect(result).toBe(false);
    });
  });

  describe("logout", () => {
    it("should set loading state when called", async () => {
      // Call logout
      await store.logout();

      // Check that set was called with loading true
      expect(set).toHaveBeenCalledWith({ isLoading: true });
    });

    it("should clear user data and update state on logout", async () => {
      // Mock user data
      store.user = {
        id: "1",
        name: "Test User",
        email: "test@example.com",
        role: "USER",
      };
      store.isAuthenticated = true;

      // Call logout
      await store.logout();

      // Check that set was called with user null and authenticated false
      expect(set).toHaveBeenCalledWith({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        sessionExpiresAt: null,
      });
    });

    it("should redirect to the specified URL", async () => {
      // Call logout with custom URL
      await store.logout("/custom-login");

      // Check that window.location.href was set
      expect(window.location.href).toBe("/custom-login");
    });

    it("should handle exceptions", async () => {
      // Mock signOut to throw error
      (signOut as jest.Mock).mockRejectedValue(new Error("Network error"));

      // Call logout
      await store.logout();

      // Check that set was called with loading false
      expect(set).toHaveBeenCalledWith({ isLoading: false });
    });
  });

  describe("setUser", () => {
    it("should update user data and authentication state", () => {
      // Create test user
      const user = {
        id: "1",
        name: "Test User",
        email: "test@example.com",
        role: "USER",
      };

      // Call setUser
      store.setUser(user);

      // Check that set was called with user data and authenticated true
      expect(set).toHaveBeenCalledWith({
        user,
        isAuthenticated: true,
        error: null,
        lastActivity: expect.any(Number),
      });
    });

    it("should set session expiry when user is set", () => {
      // Create test user
      const user = {
        id: "1",
        name: "Test User",
        email: "test@example.com",
        role: "USER",
      };

      // Call setUser
      store.setUser(user);

      // Check that set was called with sessionExpiresAt
      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionExpiresAt: expect.any(Number),
        }),
      );
    });

    it("should clear authentication when user is null", () => {
      // Call setUser with null
      store.setUser(null);

      // Check that set was called with user null and authenticated false
      expect(set).toHaveBeenCalledWith({
        user: null,
        isAuthenticated: false,
        error: null,
        lastActivity: expect.any(Number),
      });
    });
  });

  describe("clearError", () => {
    it("should clear the error state", () => {
      // Call clearError
      store.clearError();

      // Check that set was called with error null
      expect(set).toHaveBeenCalledWith({ error: null });
    });
  });

  describe("setLoading", () => {
    it("should update the loading state", () => {
      // Call setLoading with true
      store.setLoading(true);

      // Check that set was called with loading true
      expect(set).toHaveBeenCalledWith({ isLoading: true });

      // Call setLoading with false
      store.setLoading(false);

      // Check that set was called with loading false
      expect(set).toHaveBeenCalledWith({ isLoading: false });
    });
  });

  describe("updateLastActivity", () => {
    it("should update the last activity timestamp", () => {
      // Call updateLastActivity
      store.updateLastActivity();

      // Check that set was called with lastActivity
      expect(set).toHaveBeenCalledWith({ lastActivity: expect.any(Number) });
    });

    it("should extend session expiry if authenticated", () => {
      // Set authenticated to true
      store.isAuthenticated = true;

      // Call updateLastActivity
      store.updateLastActivity();

      // Check that set was called with sessionExpiresAt
      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionExpiresAt: expect.any(Number),
        }),
      );
    });

    it("should not extend session expiry if not authenticated", () => {
      // Set authenticated to false
      store.isAuthenticated = false;

      // Call updateLastActivity
      store.updateLastActivity();

      // Check that set was called with lastActivity only
      expect(set).toHaveBeenCalledWith({ lastActivity: expect.any(Number) });
    });
  });

  describe("setSessionExpiry", () => {
    it("should update the session expiry timestamp", () => {
      // Call setSessionExpiry
      const expiresAt = Date.now() + 30 * 60 * 1000;
      store.setSessionExpiry(expiresAt);

      // Check that set was called with sessionExpiresAt
      expect(set).toHaveBeenCalledWith({ sessionExpiresAt: expiresAt });
    });
  });

  describe("selectors", () => {
    describe("isAdmin", () => {
      it("should return true if user role is ADMIN", () => {
        // Set user with ADMIN role
        store.user = {
          id: "1",
          name: "Admin User",
          email: "admin@example.com",
          role: "ADMIN",
        };

        // Check isAdmin
        expect(store.isAdmin()).toBe(true);
      });

      it("should return false if user role is not ADMIN", () => {
        // Set user with non-ADMIN role
        store.user = {
          id: "1",
          name: "Regular User",
          email: "user@example.com",
          role: "USER",
        };

        // Check isAdmin
        expect(store.isAdmin()).toBe(false);
      });

      it("should return false if user is null", () => {
        // Set user to null
        store.user = null;

        // Check isAdmin
        expect(store.isAdmin()).toBe(false);
      });
    });

    describe("isBranchManager", () => {
      it("should return true if user role is BRANCH_MANAGER", () => {
        // Set user with BRANCH_MANAGER role
        store.user = {
          id: "1",
          name: "Manager",
          email: "manager@example.com",
          role: "BRANCH_MANAGER",
        };

        // Check isBranchManager
        expect(store.isBranchManager()).toBe(true);
      });

      it("should return false if user role is not BRANCH_MANAGER", () => {
        // Set user with non-BRANCH_MANAGER role
        store.user = {
          id: "1",
          name: "Regular User",
          email: "user@example.com",
          role: "USER",
        };

        // Check isBranchManager
        expect(store.isBranchManager()).toBe(false);
      });

      it("should return false if user is null", () => {
        // Set user to null
        store.user = null;

        // Check isBranchManager
        expect(store.isBranchManager()).toBe(false);
      });
    });

    describe("isSessionExpired", () => {
      it("should return true if session has expired", () => {
        // Set session expiry in the past
        store.sessionExpiresAt = Date.now() - 1000;

        // Check isSessionExpired
        expect(store.isSessionExpired()).toBe(true);
      });

      it("should return false if session has not expired", () => {
        // Set session expiry in the future
        store.sessionExpiresAt = Date.now() + 30 * 60 * 1000;

        // Check isSessionExpired
        expect(store.isSessionExpired()).toBe(false);
      });

      it("should return false if sessionExpiresAt is null", () => {
        // Set sessionExpiresAt to null
        store.sessionExpiresAt = null;

        // Check isSessionExpired
        expect(store.isSessionExpired()).toBe(false);
      });
    });

    describe("timeUntilExpiry", () => {
      it("should return time until expiry in milliseconds", () => {
        // Set session expiry in the future
        const timeUntil = 30 * 60 * 1000; // 30 minutes
        store.sessionExpiresAt = Date.now() + timeUntil;

        // Check timeUntilExpiry (allow for small timing differences)
        const result = store.timeUntilExpiry();
        expect(result).toBeGreaterThan(timeUntil - 100);
        expect(result).toBeLessThanOrEqual(timeUntil);
      });

      it("should return 0 if session has expired", () => {
        // Set session expiry in the past
        store.sessionExpiresAt = Date.now() - 1000;

        // Check timeUntilExpiry
        expect(store.timeUntilExpiry()).toBe(0);
      });

      it("should return 0 if sessionExpiresAt is null", () => {
        // Set sessionExpiresAt to null
        store.sessionExpiresAt = null;

        // Check timeUntilExpiry
        expect(store.timeUntilExpiry()).toBe(0);
      });
    });

    describe("inactivityTime", () => {
      it("should return time since last activity in milliseconds", () => {
        // Set last activity in the past
        const timeAgo = 5 * 60 * 1000; // 5 minutes
        store.lastActivity = Date.now() - timeAgo;

        // Check inactivityTime (allow for small timing differences)
        const result = store.inactivityTime();
        expect(result).toBeGreaterThanOrEqual(timeAgo);
        expect(result).toBeLessThan(timeAgo + 100);
      });
    });
  });
});
