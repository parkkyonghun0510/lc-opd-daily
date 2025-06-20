import {
  refreshSession,
  synchronizeUserData,
  handleSessionTimeout,
  updatePreferencesOptimistic,
  hasPermission,
  hasBranchAccess,
} from "@/auth/store/actions";
import { useStore } from "@/auth/store";
import { signIn } from "next-auth/react";

// Mock the store
jest.mock("@/auth/store", () => ({
  useStore: {
    getState: jest.fn(),
  },
}));

// Mock next-auth
jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
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

describe("Store Actions", () => {
  // Mock store state and functions
  const mockStore = {
    // Auth state
    user: {
      id: "1",
      name: "Test User",
      email: "test@example.com",
      role: "USER",
    },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    lastActivity: Date.now(),
    sessionExpiresAt: Date.now() + 30 * 60 * 1000,

    // Profile state
    profile: {
      id: "1",
      name: "Test User",
      email: "test@example.com",
      role: "USER",
      preferences: {
        ui: { theme: "light" },
      },
    },

    // Auth actions
    setLoading: jest.fn(),
    setSessionExpiry: jest.fn(),
    updateLastActivity: jest.fn(),
    logout: jest.fn(),
    isSessionExpired: jest.fn(),
    timeUntilExpiry: jest.fn(),
    inactivityTime: jest.fn(),
    isAdmin: jest.fn(),

    // Profile actions
    fetchProfile: jest.fn(),
    setProfile: jest.fn(),
    updatePreferences: jest.fn(),
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Set up mock store
    (useStore.getState as jest.Mock).mockReturnValue(mockStore);
  });

  describe("refreshSession", () => {
    it("should set loading state when called", async () => {
      // Mock signIn to return success
      (signIn as jest.Mock).mockResolvedValue({ ok: true });

      // Call refreshSession
      await refreshSession();

      // Check that setLoading was called with true
      expect(mockStore.setLoading).toHaveBeenCalledWith(true);
    });

    it("should call signIn with refresh method", async () => {
      // Mock signIn to return success
      (signIn as jest.Mock).mockResolvedValue({ ok: true });

      // Call refreshSession
      await refreshSession();

      // Check that signIn was called with refresh method
      expect(signIn).toHaveBeenCalledWith("refresh", { redirect: false });
    });

    it("should update session expiry and last activity on success", async () => {
      // Mock signIn to return success
      (signIn as jest.Mock).mockResolvedValue({ ok: true });

      // Call refreshSession
      await refreshSession();

      // Check that setSessionExpiry was called
      expect(mockStore.setSessionExpiry).toHaveBeenCalledWith(
        expect.any(Number),
      );

      // Check that updateLastActivity was called
      expect(mockStore.updateLastActivity).toHaveBeenCalled();
    });

    it("should return true on success", async () => {
      // Mock signIn to return success
      (signIn as jest.Mock).mockResolvedValue({ ok: true });

      // Call refreshSession
      const result = await refreshSession();

      // Check that refreshSession returned true
      expect(result).toBe(true);
    });

    it("should handle errors", async () => {
      // Mock signIn to throw error
      (signIn as jest.Mock).mockRejectedValue(new Error("Network error"));

      // Call refreshSession
      const result = await refreshSession();

      // Check that refreshSession returned false
      expect(result).toBe(false);
    });

    it("should set loading state to false when done", async () => {
      // Mock signIn to return success
      (signIn as jest.Mock).mockResolvedValue({ ok: true });

      // Call refreshSession
      await refreshSession();

      // Check that setLoading was called with false
      expect(mockStore.setLoading).toHaveBeenCalledWith(false);
    });
  });

  describe("synchronizeUserData", () => {
    it("should skip if not authenticated", async () => {
      // Set isAuthenticated to false
      (useStore.getState as jest.Mock).mockReturnValue({
        ...mockStore,
        isAuthenticated: false,
      });

      // Call synchronizeUserData
      const result = await synchronizeUserData();

      // Check that synchronizeUserData returned false
      expect(result).toBe(false);

      // Check that setLoading was not called
      expect(mockStore.setLoading).not.toHaveBeenCalled();
    });

    it("should skip if user is null", async () => {
      // Set user to null
      (useStore.getState as jest.Mock).mockReturnValue({
        ...mockStore,
        user: null,
      });

      // Call synchronizeUserData
      const result = await synchronizeUserData();

      // Check that synchronizeUserData returned false
      expect(result).toBe(false);

      // Check that setLoading was not called
      expect(mockStore.setLoading).not.toHaveBeenCalled();
    });

    it("should set loading state when called", async () => {
      // Call synchronizeUserData
      await synchronizeUserData();

      // Check that setLoading was called with true
      expect(mockStore.setLoading).toHaveBeenCalledWith(true);
    });

    it("should fetch profile data", async () => {
      // Call synchronizeUserData
      await synchronizeUserData();

      // Check that fetchProfile was called
      expect(mockStore.fetchProfile).toHaveBeenCalled();
    });

    it("should update last activity", async () => {
      // Call synchronizeUserData
      await synchronizeUserData();

      // Check that updateLastActivity was called
      expect(mockStore.updateLastActivity).toHaveBeenCalled();
    });

    it("should return true on success", async () => {
      // Call synchronizeUserData
      const result = await synchronizeUserData();

      // Check that synchronizeUserData returned true
      expect(result).toBe(true);
    });

    it("should handle errors", async () => {
      // Make fetchProfile throw error
      mockStore.fetchProfile.mockRejectedValue(new Error("Network error"));

      // Call synchronizeUserData
      const result = await synchronizeUserData();

      // Check that synchronizeUserData returned false
      expect(result).toBe(false);
    });

    it("should set loading state to false when done", async () => {
      // Call synchronizeUserData
      await synchronizeUserData();

      // Check that setLoading was called with false
      expect(mockStore.setLoading).toHaveBeenCalledWith(false);
    });
  });

  describe("handleSessionTimeout", () => {
    it("should check if session has expired", async () => {
      // Call handleSessionTimeout
      await handleSessionTimeout();

      // Check that isSessionExpired was called
      expect(mockStore.isSessionExpired).toHaveBeenCalled();
    });

    it("should try to refresh token if available", async () => {
      // Set up mock store with refresh token
      (useStore.getState as jest.Mock).mockReturnValue({
        ...mockStore,
        refreshToken: "test-refresh-token",
        refreshInProgress: false,
      });

      // Call handleSessionTimeout
      await handleSessionTimeout();

      // Check that refreshSession was attempted
      // This is indirectly tested by checking if setLoading was called
      expect(mockStore.setLoading).toHaveBeenCalledWith(true);
    });

    it("should log out user if session has expired", async () => {
      // Make isSessionExpired return true
      mockStore.isSessionExpired.mockReturnValue(true);

      // Call handleSessionTimeout
      await handleSessionTimeout();

      // Check that logout was called
      expect(mockStore.logout).toHaveBeenCalled();
    });

    it("should return true if session has expired", async () => {
      // Make isSessionExpired return true
      mockStore.isSessionExpired.mockReturnValue(true);

      // Call handleSessionTimeout
      const result = await handleSessionTimeout();

      // Check that handleSessionTimeout returned true
      expect(result).toBe(true);
    });

    it("should return false if session has not expired", async () => {
      // Make isSessionExpired return false
      mockStore.isSessionExpired.mockReturnValue(false);

      // Call handleSessionTimeout
      const result = await handleSessionTimeout();

      // Check that handleSessionTimeout returned false
      expect(result).toBe(false);
    });

    it("should not log out user if session has not expired", async () => {
      // Make isSessionExpired return false
      mockStore.isSessionExpired.mockReturnValue(false);

      // Call handleSessionTimeout
      await handleSessionTimeout();

      // Check that logout was not called
      expect(mockStore.logout).not.toHaveBeenCalled();
    });

    it("should handle token refresh errors gracefully", async () => {
      // Set up mock store with refresh token but make refresh fail
      (useStore.getState as jest.Mock).mockReturnValue({
        ...mockStore,
        refreshToken: "test-refresh-token",
        refreshInProgress: false,
        isSessionExpired: jest.fn().mockReturnValue(true),
      });

      // Mock signIn to throw error
      (signIn as jest.Mock).mockRejectedValue(new Error("Network error"));

      // Call handleSessionTimeout
      const result = await handleSessionTimeout();

      // Should still proceed with logout
      expect(mockStore.logout).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe("updatePreferencesOptimistic", () => {
    it("should skip if not authenticated", async () => {
      // Set isAuthenticated to false
      (useStore.getState as jest.Mock).mockReturnValue({
        ...mockStore,
        isAuthenticated: false,
      });

      // Call updatePreferencesOptimistic
      const result = await updatePreferencesOptimistic("ui", { theme: "dark" });

      // Check that updatePreferencesOptimistic returned false
      expect(result).toBe(false);

      // Check that setProfile was not called
      expect(mockStore.setProfile).not.toHaveBeenCalled();
    });

    it("should skip if profile is null", async () => {
      // Set profile to null
      (useStore.getState as jest.Mock).mockReturnValue({
        ...mockStore,
        profile: null,
      });

      // Call updatePreferencesOptimistic
      const result = await updatePreferencesOptimistic("ui", { theme: "dark" });

      // Check that updatePreferencesOptimistic returned false
      expect(result).toBe(false);

      // Check that setProfile was not called
      expect(mockStore.setProfile).not.toHaveBeenCalled();
    });

    it("should optimistically update the UI", async () => {
      // Mock updatePreferences to return success
      mockStore.updatePreferences.mockResolvedValue(true);

      // Call updatePreferencesOptimistic
      await updatePreferencesOptimistic("ui", { theme: "dark" });

      // Check that setProfile was called with updated preferences
      expect(mockStore.setProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences: {
            ui: {
              theme: "dark",
            },
          },
        }),
      );
    });

    it("should call updatePreferences with the correct parameters", async () => {
      // Mock updatePreferences to return success
      mockStore.updatePreferences.mockResolvedValue(true);

      // Call updatePreferencesOptimistic
      await updatePreferencesOptimistic("ui", { theme: "dark" });

      // Check that updatePreferences was called with the correct parameters
      expect(mockStore.updatePreferences).toHaveBeenCalledWith("ui", {
        theme: "dark",
      });
    });

    it("should return true on success", async () => {
      // Mock updatePreferences to return success
      mockStore.updatePreferences.mockResolvedValue(true);

      // Call updatePreferencesOptimistic
      const result = await updatePreferencesOptimistic("ui", { theme: "dark" });

      // Check that updatePreferencesOptimistic returned true
      expect(result).toBe(true);
    });

    it("should rollback on failure", async () => {
      // Mock updatePreferences to return failure
      mockStore.updatePreferences.mockResolvedValue(false);

      // Call updatePreferencesOptimistic
      await updatePreferencesOptimistic("ui", { theme: "dark" });

      // Check that setProfile was called with original preferences
      expect(mockStore.setProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences: {
            ui: {
              theme: "light",
            },
          },
        }),
      );
    });

    it("should return false on failure", async () => {
      // Mock updatePreferences to return failure
      mockStore.updatePreferences.mockResolvedValue(false);

      // Call updatePreferencesOptimistic
      const result = await updatePreferencesOptimistic("ui", { theme: "dark" });

      // Check that updatePreferencesOptimistic returned false
      expect(result).toBe(false);
    });

    it("should handle errors", async () => {
      // Mock updatePreferences to throw error
      mockStore.updatePreferences.mockRejectedValue(new Error("Network error"));

      // Call updatePreferencesOptimistic
      const result = await updatePreferencesOptimistic("ui", { theme: "dark" });

      // Check that updatePreferencesOptimistic returned false
      expect(result).toBe(false);

      // Check that setProfile was called with original preferences
      expect(mockStore.setProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences: {
            ui: {
              theme: "light",
            },
          },
        }),
      );
    });
  });

  describe("hasPermission", () => {
    it("should return true if user has permission", () => {
      // Set user role to ADMIN
      (useStore.getState as jest.Mock).mockReturnValue({
        ...mockStore,
        user: {
          id: "1",
          name: "Admin User",
          email: "admin@example.com",
          role: "ADMIN",
        },
      });

      // Check permissions
      expect(hasPermission("VIEW_REPORTS")).toBe(true);
      expect(hasPermission("CREATE_REPORTS")).toBe(true);
      expect(hasPermission("EDIT_REPORTS")).toBe(true);
      expect(hasPermission("DELETE_REPORTS")).toBe(true);
      expect(hasPermission("APPROVE_REPORTS")).toBe(true);
      expect(hasPermission("MANAGE_USERS")).toBe(true);
      expect(hasPermission("MANAGE_BRANCHES")).toBe(true);
      expect(hasPermission("VIEW_ANALYTICS")).toBe(true);
    });

    it("should return false if user does not have permission", () => {
      // Set user role to USER
      (useStore.getState as jest.Mock).mockReturnValue({
        ...mockStore,
        user: {
          id: "1",
          name: "Regular User",
          email: "user@example.com",
          role: "USER",
        },
      });

      // Check permissions
      expect(hasPermission("VIEW_REPORTS")).toBe(true);
      expect(hasPermission("CREATE_REPORTS")).toBe(true);
      expect(hasPermission("EDIT_REPORTS")).toBe(true);
      expect(hasPermission("APPROVE_REPORTS")).toBe(false);
      expect(hasPermission("MANAGE_USERS")).toBe(false);
      expect(hasPermission("MANAGE_BRANCHES")).toBe(false);
      expect(hasPermission("VIEW_ANALYTICS")).toBe(false);
    });

    it("should return false if user role is not recognized", () => {
      // Set user role to UNKNOWN
      (useStore.getState as jest.Mock).mockReturnValue({
        ...mockStore,
        user: {
          id: "1",
          name: "Unknown User",
          email: "unknown@example.com",
          role: "UNKNOWN",
        },
      });

      // Check permissions
      expect(hasPermission("VIEW_REPORTS")).toBe(false);
    });

    it("should return false if user is null", () => {
      // Set user to null
      (useStore.getState as jest.Mock).mockReturnValue({
        ...mockStore,
        user: null,
      });

      // Check permissions
      expect(hasPermission("VIEW_REPORTS")).toBe(false);
    });
  });

  describe("hasBranchAccess", () => {
    it("should return true if user is admin", () => {
      // Set user role to ADMIN
      (useStore.getState as jest.Mock).mockReturnValue({
        ...mockStore,
        user: {
          id: "1",
          name: "Admin User",
          email: "admin@example.com",
          role: "ADMIN",
        },
        isAdmin: jest.fn().mockReturnValue(true),
      });

      // Check branch access
      expect(hasBranchAccess("branch-1")).toBe(true);
      expect(hasBranchAccess("branch-2")).toBe(true);
    });

    it("should return true if user is assigned to the branch", () => {
      // Set user with branchId
      (useStore.getState as jest.Mock).mockReturnValue({
        ...mockStore,
        user: {
          id: "1",
          name: "Branch User",
          email: "branch@example.com",
          role: "BRANCH_MANAGER",
          branchId: "branch-1",
        },
        isAdmin: jest.fn().mockReturnValue(false),
      });

      // Check branch access
      expect(hasBranchAccess("branch-1")).toBe(true);
      expect(hasBranchAccess("branch-2")).toBe(false);
    });

    it("should return false if user is not assigned to the branch", () => {
      // Set user with different branchId
      (useStore.getState as jest.Mock).mockReturnValue({
        ...mockStore,
        user: {
          id: "1",
          name: "Branch User",
          email: "branch@example.com",
          role: "BRANCH_MANAGER",
          branchId: "branch-1",
        },
        isAdmin: jest.fn().mockReturnValue(false),
      });

      // Check branch access
      expect(hasBranchAccess("branch-2")).toBe(false);
    });

    it("should return false if user has no branch assigned", () => {
      // Set user without branchId
      (useStore.getState as jest.Mock).mockReturnValue({
        ...mockStore,
        user: {
          id: "1",
          name: "No Branch User",
          email: "nobranch@example.com",
          role: "USER",
        },
        isAdmin: jest.fn().mockReturnValue(false),
      });

      // Check branch access
      expect(hasBranchAccess("branch-1")).toBe(false);
    });
  });
});
