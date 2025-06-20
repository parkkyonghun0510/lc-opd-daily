import { StateCreator } from "zustand";
import { UserPreferences } from "@/app/types";
import {
  fetchUserData,
  updateUserProfile,
  updateUserPreferences,
} from "@/app/_actions/user-actions";
import { toast } from "sonner";
// import { trackAuthEvent, AuthEventType } from '@/auth/utils/analytics';

// Define the types for our user profile state
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  branchId?: string | null;
  image?: string;
  preferences?: UserPreferences;
  branch?: {
    id: string;
    name: string;
    code: string;
  };
  lastUpdated?: number;
}

export interface ProfileState {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  lastFetchTime: number | null;
}

export interface ProfileActions {
  fetchProfile: () => Promise<void>;
  setProfile: (profile: UserProfile | null) => void;
  updateProfile: (data: Partial<UserProfile>) => Promise<boolean>;
  updatePreferences: (
    type: keyof UserPreferences,
    preferences: Partial<UserPreferences[typeof type]>,
  ) => Promise<boolean>;
  clearProfile: () => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export interface ProfileSelectors {
  // Derived state
  needsRefresh: () => boolean;
  displayName: () => string;
  formattedRole: () => string;
  initials: () => string;
  hasBranch: () => boolean;
  branchName: () => string | null;
}

export type ProfileSlice = ProfileState & ProfileActions & ProfileSelectors;

// Create the profile slice
export const createProfileSlice: StateCreator<
  ProfileSlice,
  [],
  [],
  ProfileSlice
> = (set, get) => ({
  // State
  profile: null,
  isLoading: false,
  error: null,
  lastFetchTime: null,

  // Actions
  fetchProfile: async () => {
    try {
      set({ isLoading: true, error: null });

      const result = await fetchUserData();

      if (result.status === 200 && result.data) {
        set({
          profile: {
            id: result.data.id,
            name: result.data.name || "",
            email: result.data.email || "",
            role: result.data.role || "",
            branchId: result.data.branch?.id,
            image: result.data.image,
            preferences: result.data.preferences,
            branch: result.data.branch,
            lastUpdated: Date.now(),
          },
          lastFetchTime: Date.now(),
          error: null,
        });
      } else {
        set({ error: result.error || "Failed to fetch user profile" });
        toast.error(result.error || "Failed to fetch user profile");
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      set({ error: "Error fetching user profile" });
      toast.error("Error fetching user profile");
    } finally {
      set({ isLoading: false });
    }
  },

  setProfile: (profile) => {
    set({
      profile: profile
        ? {
            ...profile,
            lastUpdated: Date.now(),
          }
        : null,
      lastFetchTime: profile ? Date.now() : null,
      error: null,
    });
  },

  updateProfile: async (data) => {
    try {
      set({ isLoading: true, error: null });

      const result = await updateUserProfile(data);

      if (result.status === 200 && result.data) {
        // For build, we'll just show a success message without updating the state
        toast.success("Profile updated successfully");
        return true;
      } else {
        set({ error: result.error || "Failed to update profile" });
        toast.error(result.error || "Failed to update profile");
        return false;
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      set({ error: "Error updating profile" });
      toast.error("Error updating profile");
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  updatePreferences: async (type, preferences) => {
    try {
      set({ isLoading: true, error: null });

      const result = await updateUserPreferences({
        [type]: preferences,
      });

      if (result.status === 200 && result.data?.preferences) {
        // For build, we'll just show a success message without updating the state
        toast.success("Preferences updated successfully");
        return true;
      } else {
        set({ error: result.error || "Failed to update preferences" });
        toast.error(result.error || "Failed to update preferences");
        return false;
      }
    } catch (error) {
      console.error("Error updating preferences:", error);
      set({ error: "Error updating preferences" });
      toast.error("Error updating preferences");
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  clearProfile: () => {
    set({ profile: null, lastFetchTime: null });
  },

  setLoading: (isLoading) => {
    set({ isLoading });
  },

  setError: (error) => {
    set({ error });
  },

  // Selectors (derived state)
  needsRefresh: () => {
    const { lastFetchTime } = get();
    if (!lastFetchTime) return true;

    // Refresh if last fetch was more than 5 minutes ago
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return lastFetchTime < fiveMinutesAgo;
  },

  displayName: () => {
    const { profile } = get();
    if (!profile) return "";

    return profile.name || profile.email.split("@")[0];
  },

  formattedRole: () => {
    const { profile } = get();
    if (!profile) return "";

    return profile.role
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  },

  initials: () => {
    const { profile } = get();
    if (!profile || !profile.name) return "";

    return profile.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  },

  hasBranch: () => {
    const { profile } = get();
    return !!profile?.branchId || !!profile?.branch;
  },

  branchName: () => {
    const { profile } = get();
    if (!profile) return null;

    return profile.branch?.name || null;
  },
});
