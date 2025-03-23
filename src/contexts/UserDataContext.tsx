"use client";

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { UserData, UserPreferences } from "@/app/types";

// Import server actions (these will be created as separate server files)
import {
  fetchUserData,
  updateUserProfile,
  updateUserPreferences,
} from "@/app/_actions/user-actions";

interface UserDataContextType {
  userData: UserData | null;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  refreshUserData: () => Promise<void>;
  updateUserData: (newData: Partial<UserData>) => Promise<void>;
  updatePreferences: (
    type: keyof UserPreferences,
    preferences: Partial<UserPreferences[typeof type]>
  ) => Promise<void>;
}

const UserDataContext = createContext<UserDataContextType | undefined>(
  undefined
);

export function UserDataProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initial data fetch
  useEffect(() => {
    if (status === "authenticated") {
      // Only refresh data if we don't have it yet or if isLoading is manually set to true
      if (!userData || isLoading) {
        refreshUserData()
          .catch(error => {
            console.error("Error in initial data fetch:", error);
            setIsLoading(false);
          });
      }
    } else if (status === "unauthenticated") {
      setUserData(null);
      setIsLoading(false);
      router.push("/login");
    }
  }, [status, router, userData, isLoading]);

  const refreshUserData = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await fetchUserData();

      if (result.status === 200 && result.data) {
        // Check if non-admin user has no branch assigned
        if (!result.data.branch && result.data.role !== "ADMIN") {
          console.error("User has no branch assigned");
          await signOut({ redirect: true, callbackUrl: "/login?error=No+branch+assigned" });
          return;
        }
        
        setUserData(result.data as UserData);
      } else {
        throw new Error(result.error || "Failed to fetch user data");
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateUserData = useCallback(async (newData: Partial<UserData>) => {
    try {
      setIsLoading(true);
      let result;

      if (newData.preferences) {
        // Update preferences
        result = await updateUserPreferences(newData.preferences);
      } else {
        // Update profile data
        result = await updateUserProfile(newData);
      }

      if (result.status === 200 && result.data) {
        setUserData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            ...result.data,
          } as UserData;
        });
      } else {
        throw new Error(result.error || "Failed to update user data");
      }
    } catch (error) {
      console.error("Error updating user data:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updatePreferences = useCallback(async (
    type: keyof UserPreferences,
    preferences: Partial<UserPreferences[typeof type]>
  ) => {
    try {
      setIsLoading(true);
      const result = await updateUserPreferences({
        [type]: preferences,
      });

      if (result.status === 200 && result.data?.preferences) {
        setUserData((prev) => {
          if (!prev) return prev;
          const updatedPreferences = {
            ...prev.preferences,
            [type]: {
              ...prev.preferences[type],
              ...preferences,
            },
          };
          return {
            ...prev,
            preferences: updatedPreferences,
          } as UserData;
        });
      } else {
        throw new Error(result.error || "Failed to update preferences");
      }
    } catch (error) {
      console.error("Error updating preferences:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    userData,
    isLoading,
    setIsLoading,
    refreshUserData,
    updateUserData,
    updatePreferences,
  }), [userData, isLoading, refreshUserData, updateUserData, updatePreferences]);

  return (
    <UserDataContext.Provider value={contextValue}>
      {children}
    </UserDataContext.Provider>
  );
}

export function useUserData() {
  const context = useContext(UserDataContext);
  if (context === undefined) {
    throw new Error("useUserData must be used within a UserDataProvider");
  }
  return context;
}

// Helper hook for user permissions - with memoization
export function useUserPermissions() {
  const { userData, isLoading } = useUserData();

  // Memoize permissions to prevent recalculation
  return useMemo(() => {
    // Return default permissions while loading or if userData is null
    if (isLoading || !userData) {
      // Return permissive defaults during loading to prevent UI flashing
      return {
        canAccessAdmin: false,
        canViewAnalytics: false,
        canViewAuditLogs: false,
        canCustomizeDashboard: false,
        canManageSettings: false,
        canViewDashboard: true, // Add default dashboard access
        canManageUsers: false,
        canManageRoles: false,
        canManageBranches: false,
        canViewReports: true,
        canCreateReports: true,
        canEditReports: true,
        canDeleteReports: false,
        canApproveReports: false,
        canExportReports: true,
      };
    }

    return {
      ...userData.permissions,
      canViewDashboard: true, // Ensure dashboard access is always available
    };
  }, [isLoading, userData]);
}

// Helper hook for user initials
export function useUserInitials() {
  const { userData, isLoading } = useUserData();

  // Memoize the user initials
  return useMemo(() => {
    // Return default initial while loading or if userData is null
    if (isLoading || !userData) {
      return "U";
    }

    return (
      userData.computedFields?.displayName
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase() || "U"
    );
  }, [isLoading, userData]);
}

// Helper hook for compact mode
export function useCompactMode() {
  const { userData, isLoading } = useUserData();

  // Memoize the compact mode setting
  return useMemo(() => {
    // Return default value while loading or if userData is null
    if (isLoading || !userData) {
      return false;
    }

    return userData.preferences?.appearance?.compactMode ?? false;
  }, [isLoading, userData]);
}
