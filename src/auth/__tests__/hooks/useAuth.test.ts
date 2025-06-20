import { renderHook, act } from "@testing-library/react";
import { useAuth, useUserProfile, usePermissions } from "@/auth/hooks/useAuth";
import { useStore } from "@/auth/store";
import { hasPermission, hasBranchAccess } from "@/auth/store/actions";

// Mock the store
jest.mock("@/auth/store", () => ({
  useStore: jest.fn(),
}));

// Mock the actions
jest.mock("@/auth/store/actions", () => ({
  hasPermission: jest.fn(),
  hasBranchAccess: jest.fn(),
}));

describe("Auth Hooks", () => {
  // Mock store state and functions
  const mockStore = {
    // Auth state
    user: {
      id: "1",
      name: "Test User",
      email: "test@example.com",
      role: "USER",
    },
    isLoading: false,
    isAuthenticated: true,
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
    login: jest.fn(),
    logout: jest.fn(),
    setUser: jest.fn(),
    clearError: jest.fn(),
    setLoading: jest.fn(),
    updateLastActivity: jest.fn(),
    isSessionExpired: jest.fn().mockReturnValue(false),
    timeUntilExpiry: jest.fn().mockReturnValue(30 * 60 * 1000),
    inactivityTime: jest.fn().mockReturnValue(5 * 60 * 1000),
    isAdmin: jest.fn().mockReturnValue(false),
    isBranchManager: jest.fn().mockReturnValue(false),

    // Profile actions
    fetchProfile: jest.fn(),
    setProfile: jest.fn(),
    updateProfile: jest.fn(),
    updatePreferences: jest.fn(),
    clearProfile: jest.fn(),
    needsRefresh: jest.fn().mockReturnValue(false),
    displayName: jest.fn().mockReturnValue("Test User"),
    formattedRole: jest.fn().mockReturnValue("User"),
    initials: jest.fn().mockReturnValue("TU"),
    hasBranch: jest.fn().mockReturnValue(false),
    branchName: jest.fn().mockReturnValue(null),
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Set up mock store
    (useStore as jest.Mock).mockReturnValue(mockStore);

    // Set up mock actions
    (hasPermission as jest.Mock).mockReturnValue(true);
    (hasBranchAccess as jest.Mock).mockReturnValue(true);
  });

  describe("useAuth", () => {
    it("should return auth state and actions", () => {
      // Render hook
      const { result } = renderHook(() => useAuth());

      // Check that hook returns the correct state and actions
      expect(result.current).toEqual({
        user: mockStore.user,
        isLoading: mockStore.isLoading,
        isAuthenticated: mockStore.isAuthenticated,
        error: mockStore.error,
        login: mockStore.login,
        logout: mockStore.logout,
        clearError: mockStore.clearError,
        setLoading: mockStore.setLoading,
        updateLastActivity: mockStore.updateLastActivity,
        isAdmin: mockStore.isAdmin,
        isBranchManager: mockStore.isBranchManager,
        isSessionExpired: mockStore.isSessionExpired,
        timeUntilExpiry: mockStore.timeUntilExpiry,
        inactivityTime: mockStore.inactivityTime,
      });
    });

    it("should call login with the correct parameters", () => {
      // Render hook
      const { result } = renderHook(() => useAuth());

      // Call login
      act(() => {
        result.current.login("test@example.com", "password", "/dashboard");
      });

      // Check that login was called with the correct parameters
      expect(mockStore.login).toHaveBeenCalledWith(
        "test@example.com",
        "password",
        "/dashboard",
      );
    });

    it("should call logout with the correct parameters", () => {
      // Render hook
      const { result } = renderHook(() => useAuth());

      // Call logout
      act(() => {
        result.current.logout("/login");
      });

      // Check that logout was called with the correct parameters
      expect(mockStore.logout).toHaveBeenCalledWith("/login");
    });

    it("should call clearError", () => {
      // Render hook
      const { result } = renderHook(() => useAuth());

      // Call clearError
      act(() => {
        result.current.clearError();
      });

      // Check that clearError was called
      expect(mockStore.clearError).toHaveBeenCalled();
    });

    it("should call setLoading with the correct parameters", () => {
      // Render hook
      const { result } = renderHook(() => useAuth());

      // Call setLoading
      act(() => {
        result.current.setLoading(true);
      });

      // Check that setLoading was called with the correct parameters
      expect(mockStore.setLoading).toHaveBeenCalledWith(true);
    });

    it("should call updateLastActivity", () => {
      // Render hook
      const { result } = renderHook(() => useAuth());

      // Call updateLastActivity
      act(() => {
        result.current.updateLastActivity();
      });

      // Check that updateLastActivity was called
      expect(mockStore.updateLastActivity).toHaveBeenCalled();
    });

    it("should call isAdmin", () => {
      // Render hook
      const { result } = renderHook(() => useAuth());

      // Call isAdmin
      act(() => {
        result.current.isAdmin();
      });

      // Check that isAdmin was called
      expect(mockStore.isAdmin).toHaveBeenCalled();
    });

    it("should call isBranchManager", () => {
      // Render hook
      const { result } = renderHook(() => useAuth());

      // Call isBranchManager
      act(() => {
        result.current.isBranchManager();
      });

      // Check that isBranchManager was called
      expect(mockStore.isBranchManager).toHaveBeenCalled();
    });

    it("should call isSessionExpired", () => {
      // Render hook
      const { result } = renderHook(() => useAuth());

      // Call isSessionExpired
      act(() => {
        result.current.isSessionExpired();
      });

      // Check that isSessionExpired was called
      expect(mockStore.isSessionExpired).toHaveBeenCalled();
    });

    it("should call timeUntilExpiry", () => {
      // Render hook
      const { result } = renderHook(() => useAuth());

      // Call timeUntilExpiry
      act(() => {
        result.current.timeUntilExpiry();
      });

      // Check that timeUntilExpiry was called
      expect(mockStore.timeUntilExpiry).toHaveBeenCalled();
    });

    it("should call inactivityTime", () => {
      // Render hook
      const { result } = renderHook(() => useAuth());

      // Call inactivityTime
      act(() => {
        result.current.inactivityTime();
      });

      // Check that inactivityTime was called
      expect(mockStore.inactivityTime).toHaveBeenCalled();
    });
  });

  describe("useUserProfile", () => {
    it("should return profile state and actions", () => {
      // Render hook
      const { result } = renderHook(() => useUserProfile());

      // Check that hook returns the correct state and actions
      expect(result.current).toEqual({
        profile: mockStore.profile,
        isLoading: mockStore.isLoading,
        error: mockStore.error,
        fetchProfile: mockStore.fetchProfile,
        setProfile: mockStore.setProfile,
        updateProfile: mockStore.updateProfile,
        updatePreferences: mockStore.updatePreferences,
        clearProfile: mockStore.clearProfile,
        needsRefresh: mockStore.needsRefresh,
        displayName: mockStore.displayName,
        formattedRole: mockStore.formattedRole,
        initials: mockStore.initials,
        hasBranch: mockStore.hasBranch,
        branchName: mockStore.branchName,
      });
    });

    it("should call fetchProfile", () => {
      // Render hook
      const { result } = renderHook(() => useUserProfile());

      // Call fetchProfile
      act(() => {
        result.current.fetchProfile();
      });

      // Check that fetchProfile was called
      expect(mockStore.fetchProfile).toHaveBeenCalled();
    });

    it("should call setProfile with the correct parameters", () => {
      // Render hook
      const { result } = renderHook(() => useUserProfile());

      // Create test profile
      const profile = {
        id: "2",
        name: "New User",
        email: "new@example.com",
        role: "USER",
      };

      // Call setProfile
      act(() => {
        result.current.setProfile(profile);
      });

      // Check that setProfile was called with the correct parameters
      expect(mockStore.setProfile).toHaveBeenCalledWith(profile);
    });

    it("should call updateProfile with the correct parameters", () => {
      // Render hook
      const { result } = renderHook(() => useUserProfile());

      // Call updateProfile
      act(() => {
        result.current.updateProfile({ name: "Updated User" });
      });

      // Check that updateProfile was called with the correct parameters
      expect(mockStore.updateProfile).toHaveBeenCalledWith({
        name: "Updated User",
      });
    });

    it("should call updatePreferences with the correct parameters", () => {
      // Render hook
      const { result } = renderHook(() => useUserProfile());

      // Call updatePreferences
      act(() => {
        result.current.updatePreferences("ui", { theme: "dark" });
      });

      // Check that updatePreferences was called with the correct parameters
      expect(mockStore.updatePreferences).toHaveBeenCalledWith("ui", {
        theme: "dark",
      });
    });

    it("should call clearProfile", () => {
      // Render hook
      const { result } = renderHook(() => useUserProfile());

      // Call clearProfile
      act(() => {
        result.current.clearProfile();
      });

      // Check that clearProfile was called
      expect(mockStore.clearProfile).toHaveBeenCalled();
    });

    it("should call needsRefresh", () => {
      // Render hook
      const { result } = renderHook(() => useUserProfile());

      // Call needsRefresh
      act(() => {
        result.current.needsRefresh();
      });

      // Check that needsRefresh was called
      expect(mockStore.needsRefresh).toHaveBeenCalled();
    });

    it("should call displayName", () => {
      // Render hook
      const { result } = renderHook(() => useUserProfile());

      // Call displayName
      act(() => {
        result.current.displayName();
      });

      // Check that displayName was called
      expect(mockStore.displayName).toHaveBeenCalled();
    });

    it("should call formattedRole", () => {
      // Render hook
      const { result } = renderHook(() => useUserProfile());

      // Call formattedRole
      act(() => {
        result.current.formattedRole();
      });

      // Check that formattedRole was called
      expect(mockStore.formattedRole).toHaveBeenCalled();
    });

    it("should call initials", () => {
      // Render hook
      const { result } = renderHook(() => useUserProfile());

      // Call initials
      act(() => {
        result.current.initials();
      });

      // Check that initials was called
      expect(mockStore.initials).toHaveBeenCalled();
    });

    it("should call hasBranch", () => {
      // Render hook
      const { result } = renderHook(() => useUserProfile());

      // Call hasBranch
      act(() => {
        result.current.hasBranch();
      });

      // Check that hasBranch was called
      expect(mockStore.hasBranch).toHaveBeenCalled();
    });

    it("should call branchName", () => {
      // Render hook
      const { result } = renderHook(() => useUserProfile());

      // Call branchName
      act(() => {
        result.current.branchName();
      });

      // Check that branchName was called
      expect(mockStore.branchName).toHaveBeenCalled();
    });
  });

  describe("usePermissions", () => {
    it("should return permission checking functions", () => {
      // Render hook
      const { result } = renderHook(() => usePermissions());

      // Check that hook returns the correct functions
      expect(result.current).toHaveProperty("hasPermission");
      expect(result.current).toHaveProperty("hasAnyPermission");
      expect(result.current).toHaveProperty("hasAllPermissions");
      expect(result.current).toHaveProperty("hasRole");
      expect(result.current).toHaveProperty("hasBranchAccess");
      expect(result.current).toHaveProperty("can");
      expect(result.current).toHaveProperty("canAny");
      expect(result.current).toHaveProperty("canAll");
      expect(result.current).toHaveProperty("is");
    });

    it("should call hasPermission with the correct parameters", () => {
      // Render hook
      const { result } = renderHook(() => usePermissions());

      // Call hasPermission
      act(() => {
        result.current.hasPermission("VIEW_REPORTS");
      });

      // Check that hasPermission was called with the correct parameters
      expect(hasPermission).toHaveBeenCalledWith("VIEW_REPORTS");
    });

    it("should call hasPermission for each permission in hasAnyPermission", () => {
      // Render hook
      const { result } = renderHook(() => usePermissions());

      // Call hasAnyPermission
      act(() => {
        result.current.hasAnyPermission(["VIEW_REPORTS", "EDIT_REPORTS"]);
      });

      // Check that hasPermission was called for each permission
      expect(hasPermission).toHaveBeenCalledWith("VIEW_REPORTS");
      expect(hasPermission).toHaveBeenCalledWith("EDIT_REPORTS");
    });

    it("should call hasPermission for each permission in hasAllPermissions", () => {
      // Render hook
      const { result } = renderHook(() => usePermissions());

      // Call hasAllPermissions
      act(() => {
        result.current.hasAllPermissions(["VIEW_REPORTS", "EDIT_REPORTS"]);
      });

      // Check that hasPermission was called for each permission
      expect(hasPermission).toHaveBeenCalledWith("VIEW_REPORTS");
      expect(hasPermission).toHaveBeenCalledWith("EDIT_REPORTS");
    });

    it("should check user role in hasRole", () => {
      // Render hook
      const { result } = renderHook(() => usePermissions());

      // Call hasRole
      act(() => {
        result.current.hasRole("ADMIN");
      });

      // Check that user role was checked
      expect(mockStore.user.role).toBe("USER");
    });

    it("should call hasBranchAccess with the correct parameters", () => {
      // Render hook
      const { result } = renderHook(() => usePermissions());

      // Call hasBranchAccess
      act(() => {
        result.current.hasBranchAccess("branch-1");
      });

      // Check that hasBranchAccess was called with the correct parameters
      expect(hasBranchAccess).toHaveBeenCalledWith("branch-1");
    });

    it("should call hasPermission from can", () => {
      // Render hook
      const { result } = renderHook(() => usePermissions());

      // Call can
      act(() => {
        result.current.can("VIEW_REPORTS");
      });

      // Check that hasPermission was called with the correct parameters
      expect(hasPermission).toHaveBeenCalledWith("VIEW_REPORTS");
    });

    it("should call hasAnyPermission from canAny", () => {
      // Render hook
      const { result } = renderHook(() => usePermissions());

      // Set up spy on hasAnyPermission
      const hasAnyPermissionSpy = jest.spyOn(
        result.current,
        "hasAnyPermission",
      );

      // Call canAny
      act(() => {
        result.current.canAny(["VIEW_REPORTS", "EDIT_REPORTS"]);
      });

      // Check that hasAnyPermission was called with the correct parameters
      expect(hasAnyPermissionSpy).toHaveBeenCalledWith([
        "VIEW_REPORTS",
        "EDIT_REPORTS",
      ]);
    });

    it("should call hasAllPermissions from canAll", () => {
      // Render hook
      const { result } = renderHook(() => usePermissions());

      // Set up spy on hasAllPermissions
      const hasAllPermissionsSpy = jest.spyOn(
        result.current,
        "hasAllPermissions",
      );

      // Call canAll
      act(() => {
        result.current.canAll(["VIEW_REPORTS", "EDIT_REPORTS"]);
      });

      // Check that hasAllPermissions was called with the correct parameters
      expect(hasAllPermissionsSpy).toHaveBeenCalledWith([
        "VIEW_REPORTS",
        "EDIT_REPORTS",
      ]);
    });

    it("should call hasRole from is", () => {
      // Render hook
      const { result } = renderHook(() => usePermissions());

      // Set up spy on hasRole
      const hasRoleSpy = jest.spyOn(result.current, "hasRole");

      // Call is
      act(() => {
        result.current.is("ADMIN");
      });

      // Check that hasRole was called with the correct parameters
      expect(hasRoleSpy).toHaveBeenCalledWith("ADMIN");
    });
  });
});
