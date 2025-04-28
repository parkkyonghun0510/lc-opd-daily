# Authentication Components


This document provides detailed information about the authentication components in the system.

## AuthStatusIndicator

The `AuthStatusIndicator` component shows the current authentication status and provides quick access to user-related actions.

### Props

None

### Usage

```tsx
import { AuthStatusIndicator } from '@/auth/components/AuthStatusIndicator';

function Header() {
  return (
    <header className="flex items-center justify-between p-4">
      <Logo />
      <AuthStatusIndicator />
    </header>
  );
}
```

### Features

- Shows user avatar and name
- Provides quick access to profile, settings, etc.
- Shows session expiry information
- Handles theme switching
- Shows login button when not authenticated

## PermissionGate

The `PermissionGate` component controls access to UI components based on user permissions and roles.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | ReactNode | (required) | The content to render when the user has the required permissions |
| `fallback` | ReactNode | `null` | The content to render when the user doesn't have the required permissions |
| `permissions` | string[] | `[]` | The permissions required to access the content |
| `roles` | string[] | `[]` | The roles required to access the content |
| `requireAll` | boolean | `false` | Whether all permissions are required (true) or any of them (false) |
| `branchId` | string | `undefined` | The branch ID to check access for |
| `showLoading` | boolean | `true` | Whether to show a loading state while checking permissions |
| `loadingComponent` | ReactNode | `<Loader />` | The component to render while checking permissions |

### Usage

```tsx
import { PermissionGate } from '@/auth/components/PermissionGate';

function AdminPanel() {
  return (
    <PermissionGate
      permissions={["MANAGE_USERS"]}
      fallback={<AccessDenied />}
    >
      <UserManagement />
    </PermissionGate>
  );
}
```

### Features

- Supports single or multiple permission checks
- Can require all or any permissions
- Provides fallback UI for unauthorized users
- Handles loading states
- Supports branch-specific permissions

## ProtectedRoute

The `ProtectedRoute` component protects routes based on authentication and permissions.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | ReactNode | (required) | The content to render when the user is authenticated and has the required permissions |
| `permissions` | string[] | `[]` | The permissions required to access the route |
| `roles` | string[] | `[]` | The roles required to access the route |
| `requireAll` | boolean | `false` | Whether all permissions are required (true) or any of them (false) |
| `redirectTo` | string | `"/login"` | The path to redirect to when the user is not authenticated or doesn't have the required permissions |
| `loadingComponent` | ReactNode | `<Loader />` | The component to render while checking authentication and permissions |

### Usage

```tsx
import { ProtectedRoute } from '@/auth/components/ProtectedRoute';

function AdminPage() {
  return (
    <ProtectedRoute roles={["ADMIN"]} redirectTo="/dashboard">
      <AdminDashboard />
    </ProtectedRoute>
  );
}
```

### Features

- Redirects unauthenticated users to login
- Checks for required permissions or roles
- Supports custom redirect paths
- Handles loading states
- Checks for session expiry

## SessionActivityTracker

The `SessionActivityTracker` component tracks user activity and manages session timeouts.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `warningTime` | number | `25` | Time in minutes before showing the warning |
| `expiryTime` | number | `30` | Time in minutes before the session expires |
| `checkInterval` | number | `30` | Check interval in seconds |

### Usage

```tsx
import { SessionActivityTracker } from '@/auth/components/SessionActivityTracker';

function App() {
  return (
    <>
      <SessionActivityTracker
        warningTime={25}
        expiryTime={30}
        checkInterval={30}
      />
      <AppContent />
    </>
  );
}
```

### Features

- Tracks user activity to prevent timeouts
- Shows warning dialog before session expiry
- Provides session extension functionality
- Handles automatic logout
- Updates activity on user interaction

## StoreSynchronizer

The `StoreSynchronizer` component synchronizes the authentication store with the server.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `syncInterval` | number | `300` | Sync interval in seconds |
| `syncOnFocus` | boolean | `true` | Whether to sync when the window regains focus |
| `syncOnReconnect` | boolean | `true` | Whether to sync when the network reconnects |

### Usage

```tsx
import { StoreSynchronizer } from '@/auth/components/StoreSynchronizer';

function App() {
  return (
    <>
      <StoreSynchronizer
        syncInterval={300}
        syncOnFocus={true}
        syncOnReconnect={true}
      />
      <AppContent />
    </>
  );
}
```

### Features

- Synchronizes NextAuth session with Zustand store
- Updates on window focus and network reconnection
- Handles periodic refresh of user data
- Manages error states
- Provides real-time synchronization

## AuthDevTools

The `AuthDevTools` component provides developer tools for debugging the authentication system.

### Props

None

### Usage

```tsx
import { AuthDevTools } from '@/auth/components/AuthDevTools';

function App() {
  return (
    <>
      <AppContent />
      {process.env.NODE_ENV === 'development' && <AuthDevTools />}
    </>
  );
}
```

### Features

- State inspection for authentication and profile data
- Action testing for authentication actions
- Session management tools
- Local storage inspection
- Analytics visualization

## AuthAnalyticsDashboard

The `AuthAnalyticsDashboard` component displays analytics for authentication events.

### Props

None

### Usage

```tsx
import { AuthAnalyticsDashboard } from '@/auth/components/AuthAnalyticsDashboard';

function AnalyticsPage() {
  return (
    <div>
      <h1>Authentication Analytics</h1>
      <AuthAnalyticsDashboard />
    </div>
  );
}
```

### Features

- Overview of authentication events
- Charts and visualizations of event data
- Detailed event log
- Event filtering and sorting
- Data export options
