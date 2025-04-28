# Code Organization Improvements

This document describes the key patterns, conventions, and improvements implemented in the LC-OPD-Daily project to enhance maintainability, readability, modularity, and reusability of the codebase. It serves as a guide for developers contributing to or maintaining the project.

The improvements include centralized constants, specialized helper functions, modular exports, and enhanced documentation practices.

## Role Name Constants

We've created dedicated constants for role names to improve code consistency and maintainability:

```typescript
// src/lib/auth/constants.ts
export const MANAGER_ROLE_NAMES = [
    'manager', 'admin', 'approver', 'branch_manager',
    'BRANCH_MANAGER', 'ADMIN', 'APPROVER'
];

export const SUPERVISOR_ROLE_NAMES = ['SUPERVISOR', 'supervisor'];

export const REPORTER_ROLE_NAMES = [
    'reporter', 'user', 'manager', 'USER', 'SUPERVISOR', 'BRANCH_MANAGER'
];
```

These constants are used throughout the application for role-based access control and notification targeting, ensuring consistency and making it easier to update role names in the future.

Refer to the [Error Handling Guide](./error-handling-guide.md) for how these constants integrate with permission checks and error responses.

## Cache TTL Constants

We've also centralized cache TTL values for better management:

```typescript
// src/lib/auth/constants.ts
export const CACHE_TTL = {
    BRANCH_MAPS: 5 * 60 * 1000, // 5 minutes
    USER_ACCESS: 5 * 60 * 1000, // 5 minutes
    USER_CACHE: 2 * 60 * 1000,  // 2 minutes
    REPORT_CACHE: 2 * 60 * 1000 // 2 minutes
};
```

This makes it easier to adjust cache durations and ensures consistency across the application. The TTL values are used in caching branch maps, user access, and report data to optimize performance.

## Specialized Helper Functions

We've implemented specialized helper functions for common operations:

### Authentication Helpers

```typescript
// src/lib/auth/helpers.ts
export function isManager(userRole: string): boolean {
    return MANAGER_ROLE_NAMES.includes(userRole);
}

export function isSupervisor(userRole: string): boolean {
    return SUPERVISOR_ROLE_NAMES.includes(userRole);
}

export function isAdmin(userRole: string): boolean {
    return userRole === UserRole.ADMIN || userRole === "admin" || userRole === "ADMIN";
}
```

These functions make role checking more readable and maintainable. They encapsulate common role validation logic, reducing duplication across the codebase.

### Branch Access Helpers

```typescript
// src/lib/auth/helpers.ts
export async function hasBranchPermission(
    userId: string,
    branchId: string,
    permission: Permission
): Promise<boolean> {
    // Implementation...
}

export async function getUsersByRoleAndBranch(
    role: string,
    branchId: string
): Promise<string[]> {
    // Implementation...
}
```

These functions encapsulate complex logic for branch access control, such as verifying user permissions on specific branches and retrieving users by role within a branch.

### Notification Helpers

```typescript
// src/utils/notificationHelpers.ts
export async function sendReportStatusNotification(
    reportId: string,
    status: 'approved' | 'rejected',
    approverName: string,
    comments?: string
): Promise<{ success: boolean; count: number }> {
    // Implementation...
}
```

These functions simplify notification sending and ensure consistent behavior. For more details on the notification system, see [Notification Queue](./notification-queue.md) and [Notification Worker](./notification-worker.md).

## Module Exports

We've created index files to export related functions and constants from a single entry point:

### Auth Module

```typescript
// src/lib/auth/index.ts
export type { Branch, BranchHierarchy } from './branch-access';
export {
  getEnhancedBranchMaps,
  getAccessibleBranches,
  hasBranchAccess,
  checkBranchesAccess,
  buildBranchHierarchy
} from './branch-access';

export {
  MANAGER_ROLE_NAMES,
  SUPERVISOR_ROLE_NAMES,
  REPORTER_ROLE_NAMES,
  CACHE_TTL
} from './constants';

// More exports...
```

### Utils Module

```typescript
// src/utils/index.ts
export { NotificationType } from './notificationTemplates';
export { getUsersForNotification } from './notificationTargeting';
export type { NotificationData } from './notificationHelpers';
export {
  sendNotification,
  sendReportStatusNotification,
  sendReportSubmittedNotification,
  sendCommentNotification,
  sendSystemNotification
} from './notificationHelpers';
```

This makes imports cleaner and more maintainable.

## Improved Function Documentation

We've enhanced function documentation with detailed JSDoc comments:

```typescript
/**
 * Server action to approve or reject a report
 * @param reportId The ID of the report to approve or reject
 * @param status The new status for the report ('approved' or 'rejected')
 * @param comments Optional comments to include with the approval/rejection
 * @param notifyUsers Whether to send notifications about this action
 * @returns Object containing success status, updated report data, and a message
 */
export async function approveReportAction(
  reportId: string,
  status: 'approved' | 'rejected',
  comments?: string,
  notifyUsers: boolean = true
) {
  // Implementation...
}
```

This improves code readability and helps developers understand the purpose and usage of functions. It also facilitates better IDE support and automated documentation generation.

## Benefits

These improvements provide several benefits:

1. **Improved Maintainability**: Centralized constants and helper functions make it easier to update code in one place.
2. **Better Readability**: Clear function names and documentation make the code easier to understand.
3. **Reduced Duplication**: Reusable helper functions eliminate code duplication.
4. **Type Safety**: TypeScript type annotations ensure type safety and provide better IDE support.
5. **Modular Design**: Organized exports make it easier to import and use related functions.

## Future Improvements

Potential future improvements include:

1. Further modularization of complex functions
2. Creating more specialized utility functions for common operations
3. Implementing unit tests for helper functions
4. Adding more comprehensive documentation
## Related Documentation

- [Error Handling Guide](./error-handling-guide.md)
- [Notification Queue](./notification-queue.md)
- [Notification Worker](./notification-worker.md)
- [Performance Optimizations](./performance-optimizations.md)
- [Production Deployment](./production-deployment.md)

