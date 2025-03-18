# Branch Role-Based Access Control (RBAC)

This document outlines the branch access control system implemented in the Daily Reports System.

## Overview

The system implements a hierarchical branch access control mechanism based on user roles and explicit branch assignments. This ensures users can only view and manage branches according to their role and specific branch assignments.

## User Roles and Branch Access

| Role           | Branch Access                                                                    |
| -------------- | -------------------------------------------------------------------------------- |
| Admin          | All branches in the system                                                       |
| Branch Manager | Their default branch + any assigned branches + all sub-branches in the hierarchy |
| Supervisor     | Their default branch + any explicitly assigned branches                          |
| User           | Their default branch + any explicitly assigned branches                          |

## Key Components

### 1. Branch Hierarchy

Branches can have parent-child relationships, creating a hierarchical structure. Branch managers automatically have access to all branches in their branch's subtree.

```typescript
interface BranchHierarchy {
  id: string;
  name: string;
  parentId: string | null;
  level: number;
  path: string[];
}
```

### 2. User Branch Assignments

Users can be explicitly assigned to multiple branches through the UserBranchAssignment model. One assignment is designated as the default.

```typescript
// Schema representation
model UserBranchAssignment {
  id        String   @id @default(cuid())
  userId    String
  branchId  String
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  branch    Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)

  @@unique([userId, branchId])
  @@unique([userId], map: "UserBranchAssignment_userId_isDefault_key", where: isDefault = true)
}
```

### 3. Access Control Functions

The system provides helper functions for checking branch access:

```typescript
// Check if a user can access a specific branch
function canAccessBranch(
  userRole: UserRole,
  userBranchId: string | null,
  targetBranchId: string,
  branchHierarchy?: BranchHierarchy[],
  assignedBranchIds?: string[]
): boolean;

// Get all branches a user can access
function getAccessibleBranches(
  userRole: UserRole,
  userBranchId: string | null,
  branchHierarchy: BranchHierarchy[],
  assignedBranchIds?: string[]
): string[];
```

## API Implementation

Branch access control is implemented in several API endpoints:

1. **GET /api/branches** - Filters branches based on user role and permissions
2. **GET /api/reports/pending** - Filters pending reports based on accessible branches
3. **GET /api/user-branch-assignments** - Manages branch assignments with appropriate permissions

## Managing Branch Assignments

Branch assignments can be managed through the following endpoints:

1. **GET /api/user-branch-assignments** - List assignments for a user
2. **POST /api/user-branch-assignments** - Assign a user to a branch
3. **PATCH /api/user-branch-assignments** - Update an assignment (e.g., set as default)
4. **DELETE /api/user-branch-assignments** - Remove a branch assignment

Only users with the `MANAGE_USERS` permission can create, update or delete branch assignments. Users can view their own assignments, and admins/branch managers can view assignments for users in their branches.

## Testing

A test script is provided to verify the RBAC implementation for branches:

```bash
npx ts-node src/scripts/test-branch-rbac.ts
```

## Troubleshooting

If branch access is not working as expected:

1. Check the user's role in the database
2. Verify branch assignments in the UserBranchAssignment table
3. Check the branch hierarchy to ensure parent-child relationships are correctly defined
4. Review the RBAC implementation in the API endpoints
5. Run the test script to identify potential issues

## Tips for Extending

When extending the branch access system:

1. Always use the `canAccessBranch` and `getAccessibleBranches` helper functions
2. Update the `Permission` enum when adding new branch-related permissions
3. Update the `ROLE_PERMISSIONS` mapping when changing role permissions
4. Test thoroughly with different user roles and branch configurations
