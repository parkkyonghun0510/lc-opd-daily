"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
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
      refreshUserData();
    } else if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const refreshUserData = async () => {
    try {
      setIsLoading(true);
      const result = await fetchUserData();

      if (result.status === 200 && result.data) {
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
  };

  const updateUserData = async (newData: Partial<UserData>) => {
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
  };

  const updatePreferences = async (
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
  };

  return (
    <UserDataContext.Provider
      value={{
        userData,
        isLoading,
        refreshUserData,
        updateUserData,
        updatePreferences,
      }}
    >
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

// Helper hook for user permissions
export function useUserPermissions() {
  const { userData, isLoading } = useUserData();

  // Return default permissions while loading or if userData is null
  if (isLoading || !userData) {
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
}

// Helper hook for user initials
export function useUserInitials() {
  const { userData, isLoading } = useUserData();

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
}

// Helper hook for compact mode
export function useCompactMode() {
  const { userData, isLoading } = useUserData();

  // Return default value while loading or if userData is null
  if (isLoading || !userData) {
    return false;
  }

  return userData.preferences?.appearance?.compactMode ?? false;
}
