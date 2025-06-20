import { useStore } from "./index";
import { toast } from "sonner";
import { signIn } from "next-auth/react";
import { trackAuthEvent, AuthEventType } from "@/auth/utils/analytics";
import { UserPreferences } from "@/app/types";
import { ROLE_PERMISSIONS, UserRole, Permission } from "@/lib/auth/roles";

/**
 * Action creator for refreshing the session
 * This extends the session without requiring a full login
 */
export const refreshSession = async () => {
  const store = useStore.getState();

  try {
    store.setLoading(true);

    // Check if we have a refresh token
    if (store.refreshToken) {
      // Try to use the refresh token first
      const success = await store.refreshAuthToken();
      if (success) {
        // Update the session expiry time (30 minutes from now)
        const sessionExpiresAt = Date.now() + 30 * 60 * 1000;
        store.setSessionExpiry(sessionExpiresAt);
        store.updateLastActivity();

        // Track session extended event
        if (store.user) {
          trackAuthEvent(AuthEventType.SESSION_EXTENDED, {
            userId: store.user.id,
            username: store.user.email,
            role: store.user.role,
            details: {
              expiresAt: sessionExpiresAt,
              expiresIn: "30 minutes",
            },
          });
        }

        toast.success("Session refreshed successfully");
        return true;
      }
    }

    // Fallback to NextAuth's refresh mechanism
    // Get the current URL to use as callbackUrl if needed
    const currentUrl =
      typeof window !== "undefined" ? window.location.href : "/dashboard";

    // Use the current URL as the callbackUrl to ensure we return to the same page
    await signIn("refresh", {
      redirect: false,
      callbackUrl: currentUrl,
    });

    // Update the session expiry time (30 minutes from now)
    const sessionExpiresAt = Date.now() + 30 * 60 * 1000;
    // Update the token expiry time (1 hour from now)
    const tokenExpiresAt = Date.now() + 60 * 60 * 1000;

    store.setSessionExpiry(sessionExpiresAt);
    store.setTokenExpiry(tokenExpiresAt);
    store.updateLastActivity();

    // Track session extended event
    if (store.user) {
      trackAuthEvent(AuthEventType.SESSION_EXTENDED, {
        userId: store.user.id,
        username: store.user.email,
        role: store.user.role,
        details: {
          expiresAt: sessionExpiresAt,
          expiresIn: "30 minutes",
        },
      });
    }

    toast.success("Session refreshed successfully");
    return true;
  } catch (error) {
    console.error("Error refreshing session:", error);
    toast.error("Failed to refresh session");
    return false;
  } finally {
    store.setLoading(false);
  }
};

/**
 * Action creator for synchronizing user data
 * This fetches both authentication and profile data
 */
export const synchronizeUserData = async () => {
  const store = useStore.getState();

  // Skip if not authenticated
  if (!store.isAuthenticated || !store.user) {
    return false;
  }

  try {
    store.setLoading(true);

    // Fetch profile data
    await store.fetchProfile();

    // Update last activity
    store.updateLastActivity();

    return true;
  } catch (error) {
    console.error("Error synchronizing user data:", error);
    return false;
  } finally {
    store.setLoading(false);
  }
};

/**
 * Action creator for handling session timeout
 * This logs the user out if the session has expired
 */
export const handleSessionTimeout = async () => {
  const store = useStore.getState();

  // Try to refresh the token first if we have a refresh token
  if (
    store.isAuthenticated &&
    (await store.refreshAuthToken()) &&
    !store.refreshInProgress
  ) {
    try {
      // Use the refreshSession function which handles token refresh
      const success = await refreshSession();
      if (success) {
        // If token refresh was successful, update the session expiry
        const sessionExpiresAt = Date.now() + 30 * 60 * 1000;
        store.setSessionExpiry(sessionExpiresAt);
        store.updateLastActivity();

        toast.success("Your session has been refreshed");
        return false;
      }
    } catch (error) {
      console.error("Error refreshing token during session timeout:", error);
    }
  }

  // Check if session has expired
  if (store.isAuthenticated && store.isSessionExpired()) {
    // Track session expired event
    if (store.user) {
      trackAuthEvent(AuthEventType.SESSION_EXPIRED, {
        userId: store.user.id,
        username: store.user.email,
        role: store.user.role,
        details: {
          lastActivity: store.lastActivity,
          inactivityTime: store.inactivityTime(),
        },
      });
    }

    // Get the current URL to use as callbackUrl
    const currentUrl =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/dashboard";
    const encodedCallbackUrl = encodeURIComponent(currentUrl);

    toast.error("Your session has expired. Please log in again.");
    await store.logout(`/login?timeout=true&callbackUrl=${encodedCallbackUrl}`);
    return true;
  }

  return false;
};

/**
 * Action creator for updating user preferences with optimistic updates
 */
export const updatePreferencesOptimistic = async (
  type: keyof UserPreferences,
  preferences: Partial<UserPreferences[typeof type]>,
) => {
  const store = useStore.getState();

  // Skip if not authenticated or no profile
  if (!store.isAuthenticated || !store.profile) {
    return false;
  }

  // Store the original preferences for rollback
  const originalPreferences = store.profile.preferences?.[type]
    ? { ...store.profile.preferences[type] }
    : ({} as Partial<UserPreferences[typeof type]>);

  try {
    // Optimistically update the UI
    store.setProfile({
      ...store.profile,
      preferences: {
        notifications: {
          reportUpdates: true,
          reportComments: true,
          reportApprovals: true,
          ...store.profile.preferences?.notifications,
        },
        appearance: {
          compactMode: false,
          ...store.profile.preferences?.appearance,
        },
        [type]: {
          ...store.profile.preferences?.[type],
          ...preferences,
        },
      } as UserPreferences,
    });

    // Make the actual API call
    const success = await store.updatePreferences(type, preferences);

    if (!success) {
      // Rollback on failure
      store.setProfile({
        ...store.profile,
        preferences: {
          notifications: {
            reportUpdates: true,
            reportComments: true,
            reportApprovals: true,
            ...store.profile.preferences?.notifications,
          },
          appearance: {
            compactMode: false,
            ...store.profile.preferences?.appearance,
          },
          [type]: originalPreferences,
        } as UserPreferences,
      });

      return false;
    }

    // Track preferences updated event
    if (store.profile) {
      trackAuthEvent(AuthEventType.PREFERENCES_UPDATED, {
        userId: store.profile.id,
        username: store.profile.email,
        role: store.profile.role,
        details: {
          type,
          preferences,
        },
      });
    }

    return true;
  } catch (error) {
    console.error("Error updating preferences:", error);

    // Rollback on error
    store.setProfile({
      ...store.profile,
      preferences: {
        notifications: {
          reportUpdates: true,
          reportComments: true,
          reportApprovals: true,
          ...store.profile.preferences?.notifications,
        },
        appearance: {
          compactMode: false,
          ...store.profile.preferences?.appearance,
        },
        [type]: originalPreferences,
      } as UserPreferences,
    });

    return false;
  }
};

/**
 * Action creator for checking if the user has a specific permission
 */
export const hasPermission = (permission: string) => {
  const store = useStore.getState();

  // Convert the enum-based permissions to string arrays for easier handling
  const rolePermissions: Record<string, string[]> = {
    ADMIN: ROLE_PERMISSIONS[UserRole.ADMIN].map((p) => p.toString()),
    BRANCH_MANAGER: ROLE_PERMISSIONS[UserRole.BRANCH_MANAGER].map((p) =>
      p.toString(),
    ),
    SUPERVISOR: ROLE_PERMISSIONS[UserRole.SUPERVISOR].map((p) => p.toString()),
    USER: ROLE_PERMISSIONS[UserRole.USER].map((p) => p.toString()),
  };

  // Get user role
  const role = store.user?.role || "";

  // For debugging permission issues
  const debug = false; // Set to true to enable debug logging

  // Check if the role exists
  if (!role) {
    if (debug) console.log(`Permission check failed: No role defined for user`);
    return false;
  }

  // Check if the role is valid
  if (!rolePermissions[role]) {
    if (debug) console.log(`Permission check failed: Unknown role "${role}"`);
    return false;
  }

  // Check if the permission exists in any role (to catch typos)
  const allPermissions = Object.values(rolePermissions).flat();
  if (!allPermissions.includes(permission)) {
    if (debug)
      console.log(
        `Permission check warning: Unknown permission "${permission}"`,
      );
    // Continue with the check anyway, as this might be a new permission
  }

  // Log detailed debug information if enabled
  if (debug) {
    console.log(`Permission check: ${permission} for role ${role}`);
    console.log(`User has role: ${role}`);
    console.log(`Role has permissions:`, rolePermissions[role]);
    console.log(
      `Has permission: ${rolePermissions[role]?.includes(permission)}`,
    );
  }

  // Check if the role has the permission
  return rolePermissions[role].includes(permission);
};

/**
 * Action creator for checking if the user has access to a specific branch
 */
export const hasBranchAccess = (branchId: string) => {
  const store = useStore.getState();

  // Admin has access to all branches
  if (store.isAdmin()) {
    return true;
  }

  // Check if user is assigned to this branch
  return store.user?.branchId === branchId;
};

/**
 * Utility function to debug permission issues
 * This can be called from the browser console to diagnose permission problems
 */
export const debugPermissions = () => {
  const store = useStore.getState();

  if (!store.user) {
    console.log("No authenticated user found");
    return {
      authenticated: false,
      user: null,
      permissions: [],
    };
  }

  const role = store.user.role;

  // Use the same permission mapping as in hasPermission
  const rolePermissions: Record<string, string[]> = {
    ADMIN: ROLE_PERMISSIONS[UserRole.ADMIN].map((p) => p.toString()),
    BRANCH_MANAGER: ROLE_PERMISSIONS[UserRole.BRANCH_MANAGER].map((p) =>
      p.toString(),
    ),
    SUPERVISOR: ROLE_PERMISSIONS[UserRole.SUPERVISOR].map((p) => p.toString()),
    USER: ROLE_PERMISSIONS[UserRole.USER].map((p) => p.toString()),
  };

  const userPermissions = rolePermissions[role] || [];

  console.log("=== Permission Debug Information ===");
  console.log(`User: ${store.user.name} (${store.user.email})`);
  console.log(`Role: ${role}`);
  console.log(`Branch ID: ${store.user.branchId || "None"}`);
  console.log(`Authenticated: ${store.isAuthenticated}`);
  console.log(`Admin: ${store.isAdmin()}`);
  console.log(`Permissions (${userPermissions.length}):`);
  userPermissions.forEach((permission) => {
    console.log(`- ${permission}`);
  });

  return {
    authenticated: store.isAuthenticated,
    user: store.user,
    role,
    permissions: userPermissions,
    hasPermission: (permission: string) => userPermissions.includes(permission),
  };
};
