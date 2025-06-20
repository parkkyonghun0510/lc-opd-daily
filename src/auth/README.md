# Authentication System

This directory contains a comprehensive authentication system built with Zustand for state management and NextAuth.js for authentication. The system provides a robust, type-safe, and feature-rich authentication experience for both users and developers.

## Directory Structure

```
src/auth/
├── components/           # Authentication components
│   ├── AuthStatusIndicator.tsx  # User profile dropdown with auth status
│   ├── PermissionGate.tsx       # UI access control based on permissions
│   ├── ProtectedRoute.tsx       # Route protection with role/permission checks
│   ├── SessionActivityTracker.tsx # Tracks user activity and session timeouts
│   └── StoreSynchronizer.tsx    # Syncs auth state with NextAuth
├── hooks/                # Authentication hooks
│   └── useAuth.ts        # Custom hooks for auth, profile, and permissions
├── store/                # Zustand store
│   ├── middleware/       # Store middleware
│   │   └── logger.ts     # Logging middleware for debugging
│   ├── slices/           # Store slices
│   │   ├── authSlice.ts  # Authentication state slice
│   │   └── profileSlice.ts # User profile state slice
│   ├── actions.ts        # Action creators for complex operations
│   └── index.ts          # Combined store with exports
└── utils/                # Authentication utilities
```

## Architecture Overview

This authentication system follows a modern, modular architecture:

1. **NextAuth.js Integration**: Handles the authentication flow with the server
2. **Zustand State Management**: Provides client-side state management with persistence
3. **Sliced Store Pattern**: Organizes state into logical slices for better maintainability
4. **React Hooks API**: Exposes a clean, easy-to-use API for components
5. **Permission-Based Access Control**: Granular control over UI elements and routes

## Core Components

### Store

The authentication store is built with Zustand and uses a sliced pattern for better organization:

- **AuthSlice**: Manages authentication state (user, isAuthenticated, etc.)

  - Handles login/logout flows
  - Tracks session expiry
  - Manages authentication errors
  - Provides role-based access control

- **ProfileSlice**: Manages user profile data
  - Stores user details and preferences
  - Handles profile updates
  - Manages user preferences
  - Provides derived user data (display name, initials, etc.)

### Components

- **AuthStatusIndicator**: Shows the current authentication status in the UI

  - Displays user avatar and name
  - Provides quick access to profile, settings, etc.
  - Shows session expiry information
  - Handles theme switching

- **PermissionGate**: Controls access to UI components based on permissions

  - Supports single or multiple permission checks
  - Can require all or any permissions
  - Provides fallback UI for unauthorized users
  - Handles loading states

- **ProtectedRoute**: Protects routes based on authentication and permissions

  - Redirects unauthenticated users to login
  - Checks for required permissions or roles
  - Supports custom redirect paths
  - Handles loading states

- **SessionActivityTracker**: Manages user session activity

  - Tracks user activity to prevent timeouts
  - Shows warning dialog before session expiry
  - Provides session extension functionality
  - Handles automatic logout

- **StoreSynchronizer**: Keeps authentication state in sync
  - Synchronizes NextAuth session with Zustand store
  - Updates on window focus and network reconnection
  - Handles periodic refresh of user data
  - Manages error states

### Hooks

- **useAuth**: Provides access to authentication state and actions

  - Login/logout functionality
  - Authentication status
  - User information
  - Error handling

- **useUserProfile**: Provides access to user profile data

  - Profile information
  - Profile update functions
  - Preferences management
  - Derived profile data

- **usePermissions**: Provides permission checking utilities
  - Permission verification
  - Role verification
  - Branch access control
  - Shorthand permission helpers

## Integration with NextAuth.js

The authentication system integrates seamlessly with NextAuth.js:

1. **Session Synchronization**: The `StoreSynchronizer` component keeps the NextAuth session and Zustand store in sync
2. **Credential Provider**: Uses NextAuth's credential provider for username/password authentication
3. **JWT Handling**: Manages JWT tokens for secure authentication
4. **Session Callbacks**: Customizes session data with user roles and permissions

## Usage Examples

### Basic Authentication

```tsx
import { useAuth } from "@/auth/hooks/useAuth";

function MyComponent() {
  const { user, isAuthenticated, login, logout, isLoading, error } = useAuth();

  if (isLoading) {
    return <p>Loading...</p>;
  }

  if (!isAuthenticated) {
    return (
      <div>
        <p>Please log in</p>
        {error && <p className="text-red-500">{error}</p>}
        <button onClick={() => login("username", "password")}>Login</button>
      </div>
    );
  }

  return (
    <div>
      <p>Welcome, {user?.name}</p>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}
```

### User Profile Management

```tsx
import { useUserProfile } from "@/auth/hooks/useAuth";

function ProfilePage() {
  const { profile, isLoading, updateProfile, updatePreferences } =
    useUserProfile();

  const handleUpdateProfile = async () => {
    const success = await updateProfile({
      name: "New Name",
      email: "new.email@example.com",
    });

    if (success) {
      // Show success message
    }
  };

  const handleUpdateTheme = async () => {
    await updatePreferences("ui", {
      theme: "dark",
    });
  };

  if (isLoading || !profile) {
    return <p>Loading profile...</p>;
  }

  return (
    <div>
      <h1>Profile: {profile.name}</h1>
      <p>Email: {profile.email}</p>
      <p>Role: {profile.role}</p>
      <p>Branch: {profile.branch?.name || "None"}</p>

      <button onClick={handleUpdateProfile}>Update Profile</button>
      <button onClick={handleUpdateTheme}>Switch to Dark Theme</button>
    </div>
  );
}
```

### Permission Checking

```tsx
import { PermissionGate } from "@/auth/components/PermissionGate";
import { usePermissions } from "@/auth/hooks/useAuth";

function AdminPanel() {
  const { hasPermission, hasRole, can } = usePermissions();

  // Using the hook directly
  if (!hasRole("ADMIN")) {
    return <p>Admin access required</p>;
  }

  // Using the shorthand helper
  const canManageUsers = can("MANAGE_USERS");

  return (
    <div>
      <h1>Admin Panel</h1>

      {/* Using the PermissionGate component */}
      <PermissionGate
        permissions={["MANAGE_USERS"]}
        fallback={<p>You don't have permission to manage users</p>}
      >
        <UserManagement />
      </PermissionGate>

      {/* Multiple permissions with requireAll */}
      <PermissionGate
        permissions={["EDIT_REPORTS", "APPROVE_REPORTS"]}
        requireAll={true}
        fallback={<p>You need both edit and approve permissions</p>}
      >
        <ReportEditor />
      </PermissionGate>

      {/* Branch-specific permissions */}
      <PermissionGate
        permissions={["VIEW_REPORTS"]}
        branchId="branch_123"
        fallback={<p>You don't have access to this branch</p>}
      >
        <BranchReports />
      </PermissionGate>
    </div>
  );
}
```

### Protected Routes

```tsx
import { ProtectedRoute } from "@/auth/components/ProtectedRoute";

function AdminPage() {
  return (
    <ProtectedRoute
      roles={["ADMIN"]}
      redirectTo="/dashboard"
      loadingComponent={<CustomLoadingSpinner />}
    >
      <AdminDashboard />
    </ProtectedRoute>
  );
}

// With permission checks
function ReportsPage() {
  return (
    <ProtectedRoute
      permissions={["VIEW_REPORTS"]}
      requireAll={false} // Any of these permissions is sufficient
    >
      <ReportsDashboard />
    </ProtectedRoute>
  );
}
```

## Advanced Features

### Session Management

The authentication system includes advanced session management features:

- **Session Timeout**: Automatically logs out users after a period of inactivity

  ```tsx
  // In your app layout or providers
  <SessionActivityTracker
    warningTime={25} // Show warning 5 minutes before expiry
    expiryTime={30} // Session expires after 30 minutes
    checkInterval={30} // Check every 30 seconds
  />
  ```

- **Token Refresh**: Automatically refreshes authentication tokens before they expire

  ```tsx
  import { useAuth } from "@/auth/hooks/useAuth";

  // In a component
  const { refreshAuthToken, silentRefresh, needsTokenRefresh } = useAuth();

  // Check if token needs refresh
  if (needsTokenRefresh()) {
    // Refresh token
    await refreshAuthToken();
  }

  // Or use silent refresh which only refreshes if needed
  await silentRefresh();
  ```

- **Session Refresh**: Allows users to refresh their session without logging out

  ```tsx
  import { refreshSession } from "@/auth/store/actions";

  // In a component
  const handleRefreshSession = async () => {
    const success = await refreshSession();
    if (success) {
      // Session refreshed
    }
  };
  ```

- **Session Expiry Warning**: Shows a warning dialog before the session expires

  ```tsx
  // The SessionActivityTracker handles this automatically
  // You can customize the warning dialog by modifying the component
  ```

- **Automatic Token Refresh**: The StoreSynchronizer component automatically refreshes tokens
  ```tsx
  // In your app layout or providers
  <StoreSynchronizer
    syncInterval={300} // Sync every 5 minutes
    syncOnFocus={true}
    syncOnReconnect={true}
  />
  ```

### Real-Time Synchronization

The authentication system includes real-time synchronization features:

- **Store Synchronization**: Synchronizes the store with the server at regular intervals

  ```tsx
  // In your app layout or providers
  <StoreSynchronizer
    syncInterval={300} // Sync every 5 minutes
    syncOnFocus={true}
    syncOnReconnect={true}
  />
  ```

- **Window Focus Synchronization**: Synchronizes the store when the window regains focus
- **Network Reconnection Synchronization**: Synchronizes the store when the network reconnects

### Optimistic Updates

The authentication system includes optimistic update features:

- **Optimistic Profile Updates**: Updates the UI immediately, then syncs with the server

  ```tsx
  import { updatePreferencesOptimistic } from "@/auth/store/actions";

  // In a component
  const handleUpdateTheme = async () => {
    const success = await updatePreferencesOptimistic("ui", {
      theme: "dark",
    });

    // UI is updated immediately, even before the server responds
    // If the server request fails, the UI will roll back automatically
  };
  ```

- **Rollback on Error**: Rolls back optimistic updates if the server request fails

### Analytics Tracking

The authentication system includes analytics tracking features:

- **Event Tracking**: Tracks authentication events like login, logout, session expiry, etc.

  ```tsx
  import { trackAuthEvent, AuthEventType } from "@/auth/utils/analytics";

  // Track a custom authentication event
  trackAuthEvent(AuthEventType.LOGIN_SUCCESS, {
    userId: user.id,
    username: user.email,
    role: user.role,
    details: {
      /* additional data */
    },
  });
  ```

- **Analytics Dashboard**: Visualizes authentication events with charts and graphs

  ```tsx
  import { AuthAnalyticsDashboard } from "@/auth/components/AuthAnalyticsDashboard";

  function AnalyticsPage() {
    return (
      <div>
        <h1>Authentication Analytics</h1>
        <AuthAnalyticsDashboard />
      </div>
    );
  }
  ```

- **Event Log**: Provides a detailed log of authentication events
- **Configurable Providers**: Supports multiple analytics providers (console, localStorage, server)

  ```tsx
  import { configureAnalytics } from "@/auth/utils/analytics";

  // Configure analytics
  configureAnalytics({
    enabled: true,
    debug: process.env.NODE_ENV === "development",
    providers: {
      console: true,
      localStorage: true,
      server: true,
    },
    endpoint: "/api/auth/analytics",
  });
  ```

### Security Enhancements

The authentication system includes security enhancement features:

- **Token Validation**: Validates JWT tokens for authenticity and expiry

  ```tsx
  import { validateToken } from "@/auth/utils/security";

  // Validate a JWT token
  const isValid = validateToken(token);
  ```

- **Refresh Token**: Uses refresh tokens to maintain authentication without requiring re-login

  ```tsx
  import { useAuth } from "@/auth/hooks/useAuth";

  // In a component
  const { refreshAuthToken, isTokenExpired, timeUntilTokenExpiry } = useAuth();

  // Check if token is expired
  if (isTokenExpired()) {
    // Refresh token
    await refreshAuthToken();
  }

  // Get time until token expiry
  const timeLeft = timeUntilTokenExpiry();
  console.log(`Token expires in ${timeLeft / 1000} seconds`);
  ```

- **Browser Fingerprinting**: Validates browser fingerprint for additional security

  ```tsx
  import {
    generateFingerprint,
    validateFingerprint,
  } from "@/auth/utils/security";

  // Generate a browser fingerprint
  const fingerprint = generateFingerprint();

  // Validate a browser fingerprint
  const isValid = validateFingerprint(storedFingerprint);
  ```

- **Brute Force Protection**: Protects against brute force attacks with account lockouts

  ```tsx
  import { trackLoginAttempt, isAccountLocked } from "@/auth/utils/security";

  // Track a login attempt
  const isLocked = trackLoginAttempt(username, success);

  // Check if an account is locked
  const locked = isAccountLocked(username);
  ```

- **Automatic Token Refresh**: Automatically refreshes tokens before they expire

  ```tsx
  // The StoreSynchronizer component handles this automatically
  <StoreSynchronizer
    syncInterval={300} // Sync every 5 minutes
    syncOnFocus={true}
    syncOnReconnect={true}
  />
  ```

- **Configurable Security**: Allows customization of security features

  ```tsx
  import { configureSecurity } from "@/auth/utils/security";

  // Configure security
  configureSecurity({
    enabled: true,
    tokenValidation: true,
    refreshTokenEnabled: true,
    fingerprintValidation: true,
    bruteForceProtection: true,
    maxLoginAttempts: 5,
    lockoutDuration: 15,
    tokenExpiryTime: 60, // minutes
    sessionExpiryTime: 30, // minutes
  });
  ```

### Developer Tools

The authentication system includes developer tools for debugging:

- **State Inspection**: Inspect authentication state, user data, and profile data
- **Action Testing**: Test authentication actions like refresh session, logout, etc.
- **Session Management**: Manage session expiry and timeout for testing
- **Local Storage Inspection**: Inspect and manage authentication data in local storage

```tsx
import { AuthDevTools } from "@/auth/components/AuthDevTools";

// Add to your app layout for development only
function AppLayout({ children }) {
  return (
    <>
      {children}
      {process.env.NODE_ENV === "development" && <AuthDevTools />}
    </>
  );
}
```

## Extending the System

### Adding New Permissions

To add new permissions:

1. Update the `Permission` enum in `src/lib/auth/roles.ts`
2. Update the `hasPermission` function in `src/auth/store/actions.ts`
3. Use the new permissions in your components

### Adding New User Preferences

To add new user preferences:

1. Update the `UserPreferences` interface in `src/app/types.ts`
2. Use the `updatePreferences` function to update the preferences

### Adding New Store Slices

To add new store slices:

1. Create a new slice file in `src/auth/store/slices/`
2. Add the slice to the combined store in `src/auth/store/index.ts`
3. Create a custom hook to access the slice in `src/auth/hooks/useAuth.ts`

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

## Migration Guide

If you're migrating from the old authentication system:

1. Replace imports from `@/hooks/useAuth` with `@/auth/hooks/useAuth`
2. Replace imports from `@/components/auth/` with `@/auth/components/`
3. Update any direct store access to use the new hooks

## Security Considerations

- The system uses JWT tokens for authentication
- Passwords are never stored in the client
- Session expiry is enforced on both client and server
- Permissions are checked on both client and server
- API routes are protected with middleware
