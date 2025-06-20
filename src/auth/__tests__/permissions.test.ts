import {
  hasPermission,
  hasBranchAccess,
  debugPermissions,
} from "@/auth/store/actions";
import { useStore } from "@/auth/store";
import { ROLE_PERMISSIONS, UserRole, Permission } from "@/lib/auth/roles";

// Mock the store
jest.mock("@/auth/store", () => ({
  useStore: {
    getState: jest.fn(),
  },
}));

describe("Permission System", () => {
  // Setup mock store state
  const mockUser = {
    id: "user-123",
    name: "Test User",
    email: "test@example.com",
    role: "ADMIN",
    branchId: "branch-123",
  };

  const mockStore = {
    user: mockUser,
    isAuthenticated: true,
    isAdmin: () => mockUser.role === "ADMIN",
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    // Setup default mock implementation
    (useStore.getState as jest.Mock).mockReturnValue(mockStore);
  });

  describe("hasPermission", () => {
    it("should return true for admin with admin permission", () => {
      // Test ACCESS_ADMIN permission for ADMIN role
      const result = hasPermission("ACCESS_ADMIN");
      expect(result).toBe(true);
    });

    it("should return false for non-admin with admin permission", () => {
      // Override the mock to return a non-admin user
      (useStore.getState as jest.Mock).mockReturnValue({
        ...mockStore,
        user: { ...mockUser, role: "USER" },
        isAdmin: () => false,
      });

      const result = hasPermission("ACCESS_ADMIN");
      expect(result).toBe(false);
    });

    it("should return false when user has no role", () => {
      // Override the mock to return a user with no role
      (useStore.getState as jest.Mock).mockReturnValue({
        ...mockStore,
        user: { ...mockUser, role: "" },
        isAdmin: () => false,
      });

      const result = hasPermission("VIEW_REPORTS");
      expect(result).toBe(false);
    });

    it("should return false when user has invalid role", () => {
      // Override the mock to return a user with invalid role
      (useStore.getState as jest.Mock).mockReturnValue({
        ...mockStore,
        user: { ...mockUser, role: "INVALID_ROLE" },
        isAdmin: () => false,
      });

      const result = hasPermission("VIEW_REPORTS");
      expect(result).toBe(false);
    });

    it("should check all roles have their expected permissions", () => {
      // Test each role with its expected permissions
      Object.values(UserRole).forEach((role) => {
        (useStore.getState as jest.Mock).mockReturnValue({
          ...mockStore,
          user: { ...mockUser, role },
          isAdmin: () => role === UserRole.ADMIN,
        });

        // Each role should have all its defined permissions
        ROLE_PERMISSIONS[role].forEach((permission) => {
          const result = hasPermission(permission.toString());
          expect(result).toBe(true);
        });
      });
    });
  });

  describe("hasBranchAccess", () => {
    it("should return true for admin with any branch", () => {
      const result = hasBranchAccess("any-branch-id");
      expect(result).toBe(true);
    });

    it("should return true for user with matching branch", () => {
      // Override the mock to return a non-admin user
      (useStore.getState as jest.Mock).mockReturnValue({
        ...mockStore,
        user: { ...mockUser, role: "USER" },
        isAdmin: () => false,
      });

      const result = hasBranchAccess("branch-123");
      expect(result).toBe(true);
    });

    it("should return false for user with non-matching branch", () => {
      // Override the mock to return a non-admin user
      (useStore.getState as jest.Mock).mockReturnValue({
        ...mockStore,
        user: { ...mockUser, role: "USER" },
        isAdmin: () => false,
      });

      const result = hasBranchAccess("different-branch");
      expect(result).toBe(false);
    });
  });

  describe("debugPermissions", () => {
    // Mock console.log to verify output
    const originalConsoleLog = console.log;
    let consoleOutput: string[] = [];

    beforeEach(() => {
      consoleOutput = [];
      console.log = jest.fn((...args) => {
        consoleOutput.push(args.join(" "));
      });
    });

    afterEach(() => {
      console.log = originalConsoleLog;
    });

    it("should return debug information for authenticated user", () => {
      const result = debugPermissions();

      // Verify console output
      expect(consoleOutput.length).toBeGreaterThan(0);
      expect(consoleOutput[0]).toContain(
        "=== Permission Debug Information ===",
      );

      // Verify return value
      expect(result).toHaveProperty("authenticated", true);
      expect(result).toHaveProperty("user", mockUser);
      expect(result).toHaveProperty("role", "ADMIN");
      expect(result).toHaveProperty("permissions");
      expect(result.permissions.length).toBeGreaterThan(0);
      expect(result).toHaveProperty("hasPermission");
    });

    it("should handle unauthenticated user", () => {
      // Override the mock to return unauthenticated state
      (useStore.getState as jest.Mock).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isAdmin: () => false,
      });

      const result = debugPermissions();

      // Verify console output
      expect(consoleOutput.length).toBeGreaterThan(0);
      expect(consoleOutput[0]).toContain("No authenticated user found");

      // Verify return value
      expect(result).toHaveProperty("authenticated", false);
      expect(result).toHaveProperty("user", null);
      expect(result).toHaveProperty("permissions");
      expect(result.permissions.length).toBe(0);
    });
  });
});
