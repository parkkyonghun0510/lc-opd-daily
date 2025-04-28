# Authentication Hooks

This document provides detailed information about the authentication hooks in the system.

## useAuth

The `useAuth` hook provides access to authentication state and actions.

### Returns

| Property | Type | Description |
|----------|------|-------------|
| `user` | User \| null | The current user object |
| `isAuthenticated` | boolean | Whether the user is authenticated |
| `isLoading` | boolean | Whether authentication is in progress |
| `error` | string \| null | Any authentication error |
| `refreshToken` | string \| null | The refresh token |
| `refreshInProgress` | boolean | Whether a token refresh is in progress |
| `login` | (username: string, password: string, callbackUrl?: string) => Promise<boolean> | Function to log in |
| `logout` | (callbackUrl?: string) => Promise<void> | Function to log out |
| `clearError` | () => void | Function to clear authentication errors |
| `setLoading` | (isLoading: boolean) => void | Function to set loading state |
| `updateLastActivity` | () => void | Function to update last activity timestamp |
| `refreshAuthToken` | () => Promise<boolean> | Function to refresh the authentication token |
| `silentRefresh` | () => Promise<boolean> | Function to silently refresh the token if needed |
| `isAdmin` | () => boolean | Function to check if user is an admin |
| `isBranchManager` | () => boolean | Function to check if user is a branch manager |
| `isSessionExpired` | () => boolean | Function to check if session is expired |
| `isTokenExpired` | () => boolean | Function to check if token is expired |
| `timeUntilExpiry` | () => number | Function to get time until session expiry in milliseconds |
| `timeUntilTokenExpiry` | () => number | Function to get time until token expiry in milliseconds |
| `inactivityTime` | () => number | Function to get inactivity time in milliseconds |
| `needsTokenRefresh` | () => boolean | Function to check if token needs to be refreshed |

### Usage

```tsx
import { useAuth } from '@/auth/hooks/useAuth';

function LoginForm() {
  const { login, isLoading, error } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;

    await login(username, password);
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="text-red-500">{error}</p>}
      <input name="username" type="text" />
      <input name="password" type="password" />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
```

## useUserProfile

The `useUserProfile` hook provides access to user profile data and actions.

### Returns

| Property | Type | Description |
|----------|------|-------------|
| `profile` | UserProfile \| null | The current user profile |
| `isLoading` | boolean | Whether profile data is loading |
| `error` | string \| null | Any profile error |
| `fetchProfile` | () => Promise<void> | Function to fetch profile data |
| `setProfile` | (profile: UserProfile \| null) => void | Function to set profile data |
| `updateProfile` | (data: Partial<UserProfile>) => Promise<boolean> | Function to update profile data |
| `updatePreferences` | (type: keyof UserPreferences, preferences: Partial<UserPreferences[typeof type]>) => Promise<boolean> | Function to update user preferences |
| `clearProfile` | () => void | Function to clear profile data |
| `needsRefresh` | () => boolean | Function to check if profile needs refresh |
| `displayName` | () => string | Function to get display name |
| `formattedRole` | () => string | Function to get formatted role |
| `initials` | () => string | Function to get user initials |
| `hasBranch` | () => boolean | Function to check if user has a branch |
| `branchName` | () => string \| null | Function to get branch name |

### Usage

```tsx
import { useUserProfile } from '@/auth/hooks/useAuth';

function ProfilePage() {
  const {
    profile,
    isLoading,
    updateProfile,
    displayName,
    initials
  } = useUserProfile();

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    const name = e.target.name.value;

    await updateProfile({ name });
  };

  if (isLoading) {
    return <p>Loading profile...</p>;
  }

  return (
    <div>
      <h1>Profile: {displayName()}</h1>
      <div className="avatar">{initials()}</div>

      <form onSubmit={handleUpdateProfile}>
        <input name="name" defaultValue={profile?.name} />
        <button type="submit">Update Profile</button>
      </form>
    </div>
  );
}
```

## usePermissions

The `usePermissions` hook provides permission checking utilities.

### Returns

| Property | Type | Description |
|----------|------|-------------|
| `hasPermission` | (permission: string) => boolean | Function to check if user has a specific permission |
| `hasAnyPermission` | (permissions: string[]) => boolean | Function to check if user has any of the specified permissions |
| `hasAllPermissions` | (permissions: string[]) => boolean | Function to check if user has all of the specified permissions |
| `hasRole` | (role: string \| string[]) => boolean | Function to check if user has a specific role |
| `hasBranchAccess` | (branchId: string) => boolean | Function to check if user has access to a specific branch |
| `can` | (permission: string) => boolean | Shorthand for hasPermission |
| `canAny` | (permissions: string[]) => boolean | Shorthand for hasAnyPermission |
| `canAll` | (permissions: string[]) => boolean | Shorthand for hasAllPermissions |
| `is` | (role: string \| string[]) => boolean | Shorthand for hasRole |

### Usage

```tsx
import { usePermissions } from '@/auth/hooks/useAuth';

function AdminPanel() {
  const { hasPermission, hasRole, can } = usePermissions();

  // Using the hook directly
  if (!hasRole('ADMIN')) {
    return <p>Admin access required</p>;
  }

  // Using the shorthand helper
  const canManageUsers = can('MANAGE_USERS');

  return (
    <div>
      <h1>Admin Panel</h1>

      {canManageUsers && (
        <div>
          <h2>User Management</h2>
          <UserTable />
        </div>
      )}

      {hasPermission('VIEW_ANALYTICS') && (
        <div>
          <h2>Analytics</h2>
          <AnalyticsChart />
        </div>
      )}
    </div>
  );
}
```

## Store Actions

In addition to the hooks, the authentication system provides several action creators for complex operations.

### refreshSession

Refreshes the session without requiring a full login.

```tsx
import { refreshSession } from '@/auth/store/actions';

const handleRefreshSession = async () => {
  const success = await refreshSession();
  if (success) {
    // Session refreshed
  }
};
```

### synchronizeUserData

Synchronizes user data with the server.

```tsx
import { synchronizeUserData } from '@/auth/store/actions';

const handleSyncData = async () => {
  const success = await synchronizeUserData();
  if (success) {
    // Data synchronized
  }
};
```

### handleSessionTimeout

Handles session timeout by logging the user out if the session has expired.

```tsx
import { handleSessionTimeout } from '@/auth/store/actions';

const checkSession = () => {
  const sessionExpired = handleSessionTimeout();
  if (sessionExpired) {
    // User was logged out
  }
};
```

### updatePreferencesOptimistic

Updates user preferences with optimistic updates.

```tsx
import { updatePreferencesOptimistic } from '@/auth/store/actions';

const handleUpdateTheme = async () => {
  const success = await updatePreferencesOptimistic('ui', {
    theme: 'dark'
  });

  // UI is updated immediately, even before the server responds
  // If the server request fails, the UI will roll back automatically
};
```

### hasPermission

Checks if the user has a specific permission.

```tsx
import { hasPermission } from '@/auth/store/actions';

const canViewReports = hasPermission('VIEW_REPORTS');
```

### hasBranchAccess

Checks if the user has access to a specific branch.

```tsx
import { hasBranchAccess } from '@/auth/store/actions';

const canAccessBranch = hasBranchAccess('branch_123');
```
