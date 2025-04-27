# Migration Guide: Authentication System

This guide will help you migrate from the old authentication system to the new one.

## Overview

The new authentication system is built with Zustand for state management and NextAuth.js for authentication. It provides a more robust, type-safe, and feature-rich authentication experience.

## Key Changes

1. **Directory Structure**: All authentication-related code is now in the `src/auth` directory
2. **Store Pattern**: The store now uses a sliced pattern for better organization
3. **Hooks API**: The API is now exposed through custom hooks
4. **Permission System**: The permission system is now more granular and type-safe
5. **Session Management**: The session management is now more robust with timeout warnings and refresh functionality

## Migration Steps

### 1. Update Imports

Replace imports from the old authentication system with imports from the new one:

```diff
- import { useAuth } from '@/hooks/useAuth';
+ import { useAuth } from '@/auth/hooks/useAuth';

- import { PermissionGate } from '@/components/auth/PermissionGate';
+ import { PermissionGate } from '@/auth/components/PermissionGate';

- import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
+ import { ProtectedRoute } from '@/auth/components/ProtectedRoute';

- import { AuthStatusIndicator } from '@/components/auth/AuthStatusIndicator';
+ import { AuthStatusIndicator } from '@/auth/components/AuthStatusIndicator';
```

### 2. Update Store Access

If you were directly accessing the store, update to use the new hooks:

```diff
- import { useAuthStore } from '@/stores/authStore';
+ import { useAuth } from '@/auth/hooks/useAuth';

- const { user, isAuthenticated } = useAuthStore();
+ const { user, isAuthenticated } = useAuth();
```

### 3. Update Permission Checks

If you were using the old permission system, update to use the new one:

```diff
- import { usePermissionCheck } from '@/hooks/usePermissionCheck';
+ import { usePermissions } from '@/auth/hooks/useAuth';

- const { hasPermission } = usePermissionCheck([Permission.VIEW_REPORTS]);
+ const { hasPermission } = usePermissions();
+ const canViewReports = hasPermission(Permission.VIEW_REPORTS);
```

### 4. Update Role Checks

If you were using the old role system, update to use the new one:

```diff
- import { useRoleCheck } from '@/hooks/usePermissionCheck';
+ import { usePermissions } from '@/auth/hooks/useAuth';

- const { hasRole } = useRoleCheck(UserRole.ADMIN);
+ const { hasRole } = usePermissions();
+ const isAdmin = hasRole(UserRole.ADMIN);
```

### 5. Update Profile Access

If you were using the old profile system, update to use the new one:

```diff
- import { useUserProfile } from '@/stores/userProfileStore';
+ import { useUserProfile } from '@/auth/hooks/useAuth';

- const { profile, updateProfile } = useUserProfile();
+ const { profile, updateProfile } = useUserProfile();
```

### 6. Update Session Management

If you were using the old session management, update to use the new one:

```diff
- import { useSessionTimeout } from '@/hooks/useSessionTimeout';
+ import { useAuth } from '@/auth/hooks/useAuth';

- const { isSessionExpired, refreshSession } = useSessionTimeout();
+ const { isSessionExpired, timeUntilExpiry, isTokenExpired, timeUntilTokenExpiry, refreshAuthToken, silentRefresh, needsTokenRefresh } = useAuth();
+ import { refreshSession } from '@/auth/store/actions';
```

### 7. Update Token Refresh

If you were manually handling token refresh, update to use the new token refresh functionality:

```diff
- import { refreshToken } from '@/utils/auth';
+ import { useAuth } from '@/auth/hooks/useAuth';

- const handleRefreshToken = async () => {
-   await refreshToken();
- };
+ const { refreshAuthToken, silentRefresh, needsTokenRefresh } = useAuth();
+
+ // Check if token needs refresh
+ if (needsTokenRefresh()) {
+   // Refresh token
+   await refreshAuthToken();
+ }
+
+ // Or use silent refresh which only refreshes if needed
+ await silentRefresh();
```

### 8. Update Components

If you were using the old components, update to use the new ones:

```diff
- <AuthSynchronizer />
+ <StoreSynchronizer />

- <SessionTimeoutHandler />
+ <SessionActivityTracker />
```

## Compatibility Layer

For backward compatibility, we've created a compatibility layer that re-exports the new components and hooks with the old names. This allows you to gradually migrate your code without breaking existing functionality.

The compatibility layer includes:

- `src/hooks/useAuth.ts`: Re-exports the new hooks
- `src/components/auth/AuthStatusIndicator.tsx`: Re-exports the new component
- `src/components/auth/PermissionGate.tsx`: Re-exports the new component
- `src/components/auth/ProtectedRoute.tsx`: Re-exports the new component

## Testing

After migrating, make sure to test the following:

1. **Authentication**: Test login, logout, and session management
2. **Permissions**: Test permission-based UI elements
3. **Roles**: Test role-based access control
4. **Profile**: Test profile data and updates
5. **Session**: Test session timeout and refresh

## Troubleshooting

### Common Issues

- **Session not persisting**: Check that the `persist` middleware is configured correctly
- **Permissions not working**: Verify that the user role is correct and the permission is defined
- **Profile data not loading**: Check that the `fetchProfile` function is being called
- **Session timeout not working**: Verify that the `SessionActivityTracker` is mounted

### Debugging

The store includes a logger middleware that logs all state changes to the console. To enable it:

1. Set `NODE_ENV=development`
2. Open the browser console to see the logs

## Need Help?

If you need help migrating to the new authentication system, please contact the development team.

