import { useStore } from './index';
import { toast } from 'sonner';
import { signIn } from 'next-auth/react';
import { trackAuthEvent, AuthEventType } from '@/auth/utils/analytics';
import { UserPreferences } from '@/app/types';

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
      const success = await store.refreshToken();
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
              expiresIn: '30 minutes'
            }
          });
        }

        toast.success('Session refreshed successfully');
        return true;
      }
    }

    // Fallback to NextAuth's refresh mechanism
    await signIn('refresh', { redirect: false });

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
          expiresIn: '30 minutes'
        }
      });
    }

    toast.success('Session refreshed successfully');
    return true;
  } catch (error) {
    console.error('Error refreshing session:', error);
    toast.error('Failed to refresh session');
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
    console.error('Error synchronizing user data:', error);
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
  if (store.isAuthenticated && store.refreshToken && !store.refreshInProgress) {
    try {
      // Use the refreshSession function which handles token refresh
      const success = await refreshSession();
      if (success) {
        // If token refresh was successful, update the session expiry
        const sessionExpiresAt = Date.now() + 30 * 60 * 1000;
        store.setSessionExpiry(sessionExpiresAt);
        store.updateLastActivity();

        toast.success('Your session has been refreshed');
        return false;
      }
    } catch (error) {
      console.error('Error refreshing token during session timeout:', error);
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
          inactivityTime: store.inactivityTime()
        }
      });
    }

    toast.error('Your session has expired. Please log in again.');
    await store.logout('/login?timeout=true');
    return true;
  }

  return false;
};

/**
 * Action creator for updating user preferences with optimistic updates
 */
export const updatePreferencesOptimistic = async (
  type: keyof UserPreferences,
  preferences: Partial<UserPreferences[typeof type]>
) => {
  const store = useStore.getState();

  // Skip if not authenticated or no profile
  if (!store.isAuthenticated || !store.profile) {
    return false;
  }

  // Store the original preferences for rollback
  const originalPreferences = store.profile.preferences?.[type]
    ? { ...store.profile.preferences[type] }
    : {} as Partial<UserPreferences[typeof type]>;

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
          preferences
        }
      });
    }

    return true;
  } catch (error) {
    console.error('Error updating preferences:', error);

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

  // Define permission mappings based on roles
  const rolePermissions: Record<string, string[]> = {
    'ADMIN': ['VIEW_REPORTS', 'CREATE_REPORTS', 'EDIT_REPORTS', 'DELETE_REPORTS', 'APPROVE_REPORTS', 'MANAGE_USERS', 'MANAGE_BRANCHES', 'VIEW_ANALYTICS'],
    'BRANCH_MANAGER': ['VIEW_REPORTS', 'CREATE_REPORTS', 'EDIT_REPORTS', 'APPROVE_REPORTS', 'VIEW_ANALYTICS'],
    'SUPERVISOR': ['VIEW_REPORTS', 'CREATE_REPORTS', 'EDIT_REPORTS', 'VIEW_ANALYTICS'],
    'USER': ['VIEW_REPORTS', 'CREATE_REPORTS', 'EDIT_REPORTS'],
  };

  // Get user role
  const role = store.user?.role || '';

  // Check if the role has the permission
  return rolePermissions[role]?.includes(permission) || false;
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
