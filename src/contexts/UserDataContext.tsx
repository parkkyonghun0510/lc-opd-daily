"use client";

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { UserData, UserPreferences } from "@/app/types";
import { clearAuthData } from "@/lib/auth/session-utils";

// Import server actions (these will be created as separate server files)
import {
  fetchUserData,
  updateUserProfile,
  updateUserPreferences,
} from "@/app/_actions/user-actions";
import { useDashboardSSE } from "@/hooks/useDashboardSSE"; // Import the SSE hook

// Default preferences - needed for mock data in development
const defaultPreferences: UserPreferences = {
  notifications: {
    reportUpdates: true,
    reportComments: true,
    reportApprovals: true,
  },
  appearance: {
    compactMode: false,
  },
};

interface UserDataContextType {
  userData: UserData | null;
  isLoading: boolean;
  serverError: string | null;
  persistentError: boolean;
  setIsLoading: (loading: boolean) => void;
  refreshUserData: () => Promise<void>;
  updateUserData: (newData: Partial<UserData>) => Promise<void>;
  updatePreferences: (
    type: keyof UserPreferences,
    preferences: Partial<UserPreferences[typeof type]>
  ) => Promise<void>;
  handleClearAuth: () => void;
}

const UserDataContext = createContext<UserDataContextType | undefined>(
  undefined
);

// Add this helper function to fix legacy avatar URLs that point to the production domain in development
export function fixAvatarUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  
  // If we're in development and S3 URLs might not work correctly
  if (process.env.NODE_ENV === 'development') {
    // If it's an S3 URL or a production URL
    if (url.includes('.amazonaws.com/') || url.includes('reports.lchelpdesk.com/uploads/avatars')) {
      // Extract a unique identifier from the URL
      const filename = url.split('/').pop() || 'default';
      // Use our placeholder API
      return `/api/placeholder/avatar?seed=${filename}`;
    }
  }
  
  return url;
}

export function UserDataProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [persistentError, setPersistentError] = useState(false);
  const MAX_RETRIES = 3;

  // Use the SSE hook to listen for real-time updates
  const { lastEventData, isConnected: isSseConnected, error: sseError } = useDashboardSSE();

  // Initial data fetch
  useEffect(() => {
    if (status === "authenticated") {
      // Only refresh data if we don't have it yet or if isLoading is manually set to true
      if ((!userData || isLoading) && retryCount < MAX_RETRIES) {
        refreshUserData()
          .catch(error => {
            console.error("Error in initial data fetch:", error);
            setIsLoading(false);
            setRetryCount(prev => prev + 1);
            setServerError("Server connection error. Please try refreshing the page.");
            
            if (retryCount >= MAX_RETRIES - 1) {
              console.warn("Max retry attempts reached when fetching user data");
              setPersistentError(true);
            }
          });
      }
    } else if (status === "unauthenticated") {
      setUserData(null);
      setIsLoading(false);
      router.push("/login");
    }
  }, [status, router, userData, isLoading, retryCount]);

  // Effect to handle SSE updates
  useEffect(() => {
    if (lastEventData && lastEventData.type === 'dashboardUpdate') {
      const { type: updateType, payload } = lastEventData.payload;
      //console.log('[UserDataContext] Received SSE update:', updateType, payload);

      // Example: Handle specific update types relevant to user data
      if (updateType === 'USER_PROFILE_UPDATED' && payload?.userId === userData?.id) {
        //console.log('[UserDataContext] User profile updated via SSE, refreshing data...');
        refreshUserData().catch(err => console.error("Error refreshing user data after SSE update:", err));
      } else if (updateType === 'USER_PREFERENCES_UPDATED' && payload?.userId === userData?.id) {
        //console.log('[UserDataContext] User preferences updated via SSE, refreshing data...');
        // Optionally update preferences directly if payload contains full data
        // setUserData(prev => prev ? { ...prev, preferences: payload.preferences } : null);
        refreshUserData().catch(err => console.error("Error refreshing user data after SSE update:", err));
      } else if (updateType === 'BRANCH_ASSIGNMENT_CHANGED' && payload?.userId === userData?.id) {
        //console.log('[UserDataContext] Branch assignment changed via SSE, refreshing data...');
        refreshUserData().catch(err => console.error("Error refreshing user data after SSE update:", err));
      }
      // Add more conditions here for other relevant update types

    }
  }, [lastEventData, userData?.id]);

  // Log SSE connection status and errors
  useEffect(() => {
    if (sseError) {
      console.error('[UserDataContext] SSE connection error:', sseError);
      // Optionally handle SSE errors, e.g., show a notification
    }
    //console.log('[UserDataContext] SSE connection status:', isSseConnected ? 'Connected' : 'Disconnected');
  }, [isSseConnected, sseError]);

  // Clear auth data if we have persistent errors
  const handleClearAuth = useCallback(() => {
    clearAuthData();
    window.location.href = "/login?cleared=true";
  }, []);

  const refreshUserData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Add a timeout to the fetch operation to prevent hanging indefinitely
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      let result;
      try {
        result = await fetchUserData();
        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);
        // If it's a network error, create a mock result for development
        if (process.env.NODE_ENV === 'development' && error instanceof TypeError && error.message.includes('fetch')) {
          console.warn('Network error when fetching user data. Using mock data for development.');
          result = {
            status: 200,
            data: {
              id: 'mock-id',
              name: 'Dev User',
              email: 'dev@example.com',
              role: 'ADMIN',
              isActive: true,
              preferences: defaultPreferences || {
                notifications: { reportUpdates: true, reportComments: true, reportApprovals: true },
                appearance: { compactMode: false },
              },
              computedFields: {
                displayName: 'Dev User',
                accessLevel: 'Admin',
                status: 'Active',
              },
              permissions: {
                canAccessAdmin: true,
                canViewAnalytics: true,
                canViewAuditLogs: true,
                canCustomizeDashboard: true,
                canManageSettings: true,
                canViewDashboard: true,
                canManageUsers: true,
                canManageRoles: true,
                canManageBranches: true,
                canViewReports: true,
                canCreateReports: true,
                canEditReports: true,
                canDeleteReports: true,
                canApproveReports: true,
                canExportReports: true,
              }
            }
          };
        } else {
          throw error;
        }
      }

      if (result.status === 200 && result.data) {
        // Check if non-admin user has no branch assigned
        if (!result.data.branch && result.data.role !== "ADMIN") {
          console.error("User has no branch assigned");
          await signOut({ redirect: true, callbackUrl: "/login?error=No+branch+assigned" });
          return;
        }
        
        setUserData(result.data as UserData);
        setServerError(null);
        // Reset retry count on successful fetch
        setRetryCount(0);
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

  // Fix avatar URLs in development environment
  useEffect(() => {
    if (userData && userData.image) {
      const fixedImageUrl = fixAvatarUrl(userData.image);
      if (fixedImageUrl !== userData.image) {
        setUserData(prev => {
          if (!prev) return null;
          return {
            ...prev,
            image: fixedImageUrl
          };
        });
      }
    }
  }, [userData?.image]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    userData,
    isLoading,
    serverError,
    persistentError,
    setIsLoading,
    refreshUserData,
    updateUserData,
    updatePreferences,
    handleClearAuth,
    // Include SSE status if needed by consumers, though typically not directly exposed
    // isSseConnected,
    // sseError,
  }), [userData, isLoading, serverError, persistentError, refreshUserData, updateUserData, updatePreferences, handleClearAuth]);

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
