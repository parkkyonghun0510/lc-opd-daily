import {
  createProfileSlice,
  ProfileSlice,
} from "@/auth/store/slices/profileSlice";
import {
  fetchUserData,
  updateUserProfile,
  updateUserPreferences,
} from "@/app/_actions/user-actions";

// Mock user actions
jest.mock("@/app/_actions/user-actions", () => ({
  fetchUserData: jest.fn(),
  updateUserProfile: jest.fn(),
  updateUserPreferences: jest.fn(),
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

describe("ProfileSlice", () => {
  let store: ProfileSlice;
  let set: jest.Mock;
  let get: jest.Mock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock set and get functions
    set = jest.fn();
    get = jest.fn();

    // Initialize store with mock functions
    store = createProfileSlice(set, get, {});

    // Set up get to return the store
    get.mockImplementation(() => store);
  });

  describe("Initial state", () => {
    it("should have the correct initial state", () => {
      expect(store.profile).toBeNull();
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
      expect(store.lastFetchTime).toBeNull();
    });
  });

  describe("fetchProfile", () => {
    it("should set loading state and clear errors when called", async () => {
      // Mock fetchUserData to return success
      (fetchUserData as jest.Mock).mockResolvedValue({
        status: 200,
        data: {
          id: "1",
          name: "Test User",
          email: "test@example.com",
          role: "USER",
        },
      });

      // Call fetchProfile
      await store.fetchProfile();

      // Check that set was called with loading true and error null
      expect(set).toHaveBeenCalledWith({ isLoading: true, error: null });
    });

    it("should update profile data on successful fetch", async () => {
      // Mock user data
      const userData = {
        id: "1",
        name: "Test User",
        email: "test@example.com",
        role: "USER",
        branchId: "branch-1",
        image: "https://example.com/avatar.jpg",
        preferences: { theme: "dark" },
        branch: { id: "branch-1", name: "Main Branch", code: "MB" },
      };

      // Mock fetchUserData to return success
      (fetchUserData as jest.Mock).mockResolvedValue({
        status: 200,
        data: userData,
      });

      // Call fetchProfile
      await store.fetchProfile();

      // Check that set was called with profile data
      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({
          profile: {
            ...userData,
            lastUpdated: expect.any(Number),
          },
          lastFetchTime: expect.any(Number),
          error: null,
        }),
      );
    });

    it("should handle fetch failure", async () => {
      // Mock fetchUserData to return failure
      (fetchUserData as jest.Mock).mockResolvedValue({
        status: 400,
        error: "Failed to fetch user profile",
      });

      // Call fetchProfile
      await store.fetchProfile();

      // Check that set was called with error message
      expect(set).toHaveBeenCalledWith({
        error: "Failed to fetch user profile",
      });
    });

    it("should handle exceptions", async () => {
      // Mock fetchUserData to throw error
      (fetchUserData as jest.Mock).mockRejectedValue(
        new Error("Network error"),
      );

      // Call fetchProfile
      await store.fetchProfile();

      // Check that set was called with error message
      expect(set).toHaveBeenCalledWith({
        error: "Error fetching user profile",
      });
    });

    it("should set isLoading to false when done", async () => {
      // Mock fetchUserData to return success
      (fetchUserData as jest.Mock).mockResolvedValue({
        status: 200,
        data: {
          id: "1",
          name: "Test User",
          email: "test@example.com",
          role: "USER",
        },
      });

      // Call fetchProfile
      await store.fetchProfile();

      // Check that set was called with isLoading false
      expect(set).toHaveBeenCalledWith({ isLoading: false });
    });
  });

  describe("setProfile", () => {
    it("should update profile data", () => {
      // Create test profile
      const profile = {
        id: "1",
        name: "Test User",
        email: "test@example.com",
        role: "USER",
      };

      // Call setProfile
      store.setProfile(profile);

      // Check that set was called with profile data
      expect(set).toHaveBeenCalledWith({
        profile: {
          ...profile,
          lastUpdated: expect.any(Number),
        },
        lastFetchTime: expect.any(Number),
        error: null,
      });
    });

    it("should clear profile data when null is passed", () => {
      // Call setProfile with null
      store.setProfile(null);

      // Check that set was called with profile null
      expect(set).toHaveBeenCalledWith({
        profile: null,
        lastFetchTime: null,
        error: null,
      });
    });
  });

  describe("updateProfile", () => {
    it("should set loading state and clear errors when called", async () => {
      // Mock updateUserProfile to return success
      (updateUserProfile as jest.Mock).mockResolvedValue({
        status: 200,
        data: {
          id: "1",
          name: "Updated User",
          email: "test@example.com",
          role: "USER",
        },
      });

      // Call updateProfile
      await store.updateProfile({ name: "Updated User" });

      // Check that set was called with loading true and error null
      expect(set).toHaveBeenCalledWith({ isLoading: true, error: null });
    });

    it("should update profile data on successful update", async () => {
      // Mock updated user data
      const updatedData = {
        id: "1",
        name: "Updated User",
        email: "test@example.com",
        role: "USER",
      };

      // Mock updateUserProfile to return success
      (updateUserProfile as jest.Mock).mockResolvedValue({
        status: 200,
        data: updatedData,
      });

      // Set initial profile
      store.profile = {
        id: "1",
        name: "Test User",
        email: "test@example.com",
        role: "USER",
      };

      // Call updateProfile
      const result = await store.updateProfile({ name: "Updated User" });

      // Check that set was called with updated profile data
      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({
          profile: {
            ...store.profile,
            ...updatedData,
            lastUpdated: expect.any(Number),
          },
        }),
      );

      // Check that updateProfile returned true
      expect(result).toBe(true);
    });

    it("should handle update failure", async () => {
      // Mock updateUserProfile to return failure
      (updateUserProfile as jest.Mock).mockResolvedValue({
        status: 400,
        error: "Failed to update profile",
      });

      // Call updateProfile
      const result = await store.updateProfile({ name: "Updated User" });

      // Check that set was called with error message
      expect(set).toHaveBeenCalledWith({
        error: "Failed to update profile",
      });

      // Check that updateProfile returned false
      expect(result).toBe(false);
    });

    it("should handle exceptions", async () => {
      // Mock updateUserProfile to throw error
      (updateUserProfile as jest.Mock).mockRejectedValue(
        new Error("Network error"),
      );

      // Call updateProfile
      const result = await store.updateProfile({ name: "Updated User" });

      // Check that set was called with error message
      expect(set).toHaveBeenCalledWith({
        error: "Error updating profile",
      });

      // Check that updateProfile returned false
      expect(result).toBe(false);
    });

    it("should set isLoading to false when done", async () => {
      // Mock updateUserProfile to return success
      (updateUserProfile as jest.Mock).mockResolvedValue({
        status: 200,
        data: {
          id: "1",
          name: "Updated User",
          email: "test@example.com",
          role: "USER",
        },
      });

      // Call updateProfile
      await store.updateProfile({ name: "Updated User" });

      // Check that set was called with isLoading false
      expect(set).toHaveBeenCalledWith({ isLoading: false });
    });
  });

  describe("updatePreferences", () => {
    it("should set loading state and clear errors when called", async () => {
      // Mock updateUserPreferences to return success
      (updateUserPreferences as jest.Mock).mockResolvedValue({
        status: 200,
        data: {
          preferences: {
            ui: { theme: "dark" },
          },
        },
      });

      // Call updatePreferences
      await store.updatePreferences("ui", { theme: "dark" });

      // Check that set was called with loading true and error null
      expect(set).toHaveBeenCalledWith({ isLoading: true, error: null });
    });

    it("should update preferences on successful update", async () => {
      // Mock updated preferences
      const updatedPreferences = {
        ui: { theme: "dark" },
      };

      // Mock updateUserPreferences to return success
      (updateUserPreferences as jest.Mock).mockResolvedValue({
        status: 200,
        data: {
          preferences: updatedPreferences,
        },
      });

      // Set initial profile with preferences
      store.profile = {
        id: "1",
        name: "Test User",
        email: "test@example.com",
        role: "USER",
        preferences: {
          ui: { theme: "light" },
        },
      };

      // Call updatePreferences
      const result = await store.updatePreferences("ui", { theme: "dark" });

      // Check that set was called with updated preferences
      expect(set).toHaveBeenCalled();

      // Get the last call to set
      const lastCall = set.mock.calls[set.mock.calls.length - 2][0];

      // Check that the profile was updated correctly
      expect(lastCall.profile.preferences.ui.theme).toBe("dark");

      // Check that updatePreferences returned true
      expect(result).toBe(true);
    });

    it("should handle update failure", async () => {
      // Mock updateUserPreferences to return failure
      (updateUserPreferences as jest.Mock).mockResolvedValue({
        status: 400,
        error: "Failed to update preferences",
      });

      // Call updatePreferences
      const result = await store.updatePreferences("ui", { theme: "dark" });

      // Check that set was called with error message
      expect(set).toHaveBeenCalledWith({
        error: "Failed to update preferences",
      });

      // Check that updatePreferences returned false
      expect(result).toBe(false);
    });

    it("should handle exceptions", async () => {
      // Mock updateUserPreferences to throw error
      (updateUserPreferences as jest.Mock).mockRejectedValue(
        new Error("Network error"),
      );

      // Call updatePreferences
      const result = await store.updatePreferences("ui", { theme: "dark" });

      // Check that set was called with error message
      expect(set).toHaveBeenCalledWith({
        error: "Error updating preferences",
      });

      // Check that updatePreferences returned false
      expect(result).toBe(false);
    });

    it("should set isLoading to false when done", async () => {
      // Mock updateUserPreferences to return success
      (updateUserPreferences as jest.Mock).mockResolvedValue({
        status: 200,
        data: {
          preferences: {
            ui: { theme: "dark" },
          },
        },
      });

      // Call updatePreferences
      await store.updatePreferences("ui", { theme: "dark" });

      // Check that set was called with isLoading false
      expect(set).toHaveBeenCalledWith({ isLoading: false });
    });
  });

  describe("clearProfile", () => {
    it("should clear profile data", () => {
      // Set initial profile
      store.profile = {
        id: "1",
        name: "Test User",
        email: "test@example.com",
        role: "USER",
      };
      store.lastFetchTime = Date.now();

      // Call clearProfile
      store.clearProfile();

      // Check that set was called with profile null and lastFetchTime null
      expect(set).toHaveBeenCalledWith({
        profile: null,
        lastFetchTime: null,
      });
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

  describe("setError", () => {
    it("should update the error state", () => {
      // Call setError with error message
      store.setError("Test error");

      // Check that set was called with error message
      expect(set).toHaveBeenCalledWith({ error: "Test error" });

      // Call setError with null
      store.setError(null);

      // Check that set was called with error null
      expect(set).toHaveBeenCalledWith({ error: null });
    });
  });

  describe("selectors", () => {
    describe("needsRefresh", () => {
      it("should return true if lastFetchTime is null", () => {
        // Set lastFetchTime to null
        store.lastFetchTime = null;

        // Check needsRefresh
        expect(store.needsRefresh()).toBe(true);
      });

      it("should return true if lastFetchTime is more than 5 minutes ago", () => {
        // Set lastFetchTime to more than 5 minutes ago
        store.lastFetchTime = Date.now() - 6 * 60 * 1000;

        // Check needsRefresh
        expect(store.needsRefresh()).toBe(true);
      });

      it("should return false if lastFetchTime is less than 5 minutes ago", () => {
        // Set lastFetchTime to less than 5 minutes ago
        store.lastFetchTime = Date.now() - 4 * 60 * 1000;

        // Check needsRefresh
        expect(store.needsRefresh()).toBe(false);
      });
    });

    describe("displayName", () => {
      it("should return name if available", () => {
        // Set profile with name
        store.profile = {
          id: "1",
          name: "Test User",
          email: "test@example.com",
          role: "USER",
        };

        // Check displayName
        expect(store.displayName()).toBe("Test User");
      });

      it("should return email username if name is not available", () => {
        // Set profile without name
        store.profile = {
          id: "1",
          name: "",
          email: "test@example.com",
          role: "USER",
        };

        // Check displayName
        expect(store.displayName()).toBe("test");
      });

      it("should return empty string if profile is null", () => {
        // Set profile to null
        store.profile = null;

        // Check displayName
        expect(store.displayName()).toBe("");
      });
    });

    describe("formattedRole", () => {
      it("should format role correctly", () => {
        // Set profile with role
        store.profile = {
          id: "1",
          name: "Test User",
          email: "test@example.com",
          role: "BRANCH_MANAGER",
        };

        // Check formattedRole
        expect(store.formattedRole()).toBe("Branch Manager");
      });

      it("should return empty string if profile is null", () => {
        // Set profile to null
        store.profile = null;

        // Check formattedRole
        expect(store.formattedRole()).toBe("");
      });
    });

    describe("initials", () => {
      it("should return initials from name", () => {
        // Set profile with name
        store.profile = {
          id: "1",
          name: "Test User",
          email: "test@example.com",
          role: "USER",
        };

        // Check initials
        expect(store.initials()).toBe("TU");
      });

      it("should return empty string if name is not available", () => {
        // Set profile without name
        store.profile = {
          id: "1",
          name: "",
          email: "test@example.com",
          role: "USER",
        };

        // Check initials
        expect(store.initials()).toBe("");
      });

      it("should return empty string if profile is null", () => {
        // Set profile to null
        store.profile = null;

        // Check initials
        expect(store.initials()).toBe("");
      });
    });

    describe("hasBranch", () => {
      it("should return true if branchId is available", () => {
        // Set profile with branchId
        store.profile = {
          id: "1",
          name: "Test User",
          email: "test@example.com",
          role: "USER",
          branchId: "branch-1",
        };

        // Check hasBranch
        expect(store.hasBranch()).toBe(true);
      });

      it("should return true if branch object is available", () => {
        // Set profile with branch object
        store.profile = {
          id: "1",
          name: "Test User",
          email: "test@example.com",
          role: "USER",
          branch: { id: "branch-1", name: "Main Branch", code: "MB" },
        };

        // Check hasBranch
        expect(store.hasBranch()).toBe(true);
      });

      it("should return false if neither branchId nor branch object is available", () => {
        // Set profile without branch
        store.profile = {
          id: "1",
          name: "Test User",
          email: "test@example.com",
          role: "USER",
        };

        // Check hasBranch
        expect(store.hasBranch()).toBe(false);
      });

      it("should return false if profile is null", () => {
        // Set profile to null
        store.profile = null;

        // Check hasBranch
        expect(store.hasBranch()).toBe(false);
      });
    });

    describe("branchName", () => {
      it("should return branch name if available", () => {
        // Set profile with branch
        store.profile = {
          id: "1",
          name: "Test User",
          email: "test@example.com",
          role: "USER",
          branch: { id: "branch-1", name: "Main Branch", code: "MB" },
        };

        // Check branchName
        expect(store.branchName()).toBe("Main Branch");
      });

      it("should return null if branch is not available", () => {
        // Set profile without branch
        store.profile = {
          id: "1",
          name: "Test User",
          email: "test@example.com",
          role: "USER",
        };

        // Check branchName
        expect(store.branchName()).toBeNull();
      });

      it("should return null if profile is null", () => {
        // Set profile to null
        store.profile = null;

        // Check branchName
        expect(store.branchName()).toBeNull();
      });
    });
  });
});
