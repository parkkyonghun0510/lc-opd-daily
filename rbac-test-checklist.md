# Role-Based Access Control Testing Checklist

## Overview

This checklist helps verify that role-based access controls are working correctly after migrating to NextAuth.

## Test Users

Create or use the following test accounts:

- [ok] Admin User: Full system access
- [ok] Manager User: Branch management and report approval
- [ ] Regular User: Basic reporting functionality
- [ ] Read-Only User: View-only access

## Role-Based UI Testing

### Admin User Tests

- [ ] Can access admin dashboard
- [ ] Can create/edit/delete branches
- [ ] Can create/edit/delete users
- [ ] Can manage system settings
- [ ] Can approve reports
- [ ] Can view all reports across branches

### Manager User Tests

- [ ] Cannot access admin dashboard
- [ ] Can view all assigned branches
- [] Can approve reports for assigned branches
- [ ] Cannot create/edit/delete branches
- [ ] Cannot create/edit/delete users not in their branch

### Regular User Tests

- [ ] Can only access their own branch data
- [ ] Can create and edit reports for their branch
- [ ] Cannot approve reports
- [ ] Cannot access branches they aren't assigned to
- [ ] Cannot access user management

### Read-Only User Tests

- [ ] Can view reports for assigned branches
- [ ] Cannot create or edit any reports
- [ ] Cannot approve reports
- [ ] Cannot access user management

## API Route Permission Tests

For each user role, test these API endpoints:

### `/api/branches`

- [ ] Admin: GET, POST, PATCH, DELETE all succeed
- [ ] Manager: GET succeeds, POST/PATCH/DELETE fail
- [ ] Regular: GET returns only assigned branches, POST/PATCH/DELETE fail
- [ ] Read-Only: GET returns only assigned branches, POST/PATCH/DELETE fail

### `/api/users`

- [ ] Admin: GET, POST, PATCH, DELETE all succeed
- [ ] Manager: GET returns only users in their branches, limited actions
- [ ] Regular: GET returns only themselves and branch colleagues, other actions fail
- [ ] Read-Only: GET returns limited user data, other actions fail

### `/api/reports`

- [ ] Admin: Full access to all operations
- [ ] Manager: Access to reports in their branches
- [ ] Regular: Access only to their reports and branch reports
- [ ] Read-Only: GET access only

### `/api/reports/pending`

- [ ] Admin: Access to all pending reports
- [ ] Manager: Access to pending reports in their branches
- [ ] Regular: No access or limited view-only access
- [ ] Read-Only: No access

## Special Cases

### Token Validation

- [ ] Expired tokens are rejected
- [ ] Modified tokens are rejected
- [ ] Tokens from logged-out users are rejected

### Permission Boundaries

- [ ] URL manipulation cannot bypass role restrictions
- [ ] Direct API calls respect role permissions
- [ ] Role claims in token cannot be manipulated

## Test Results

| Test Category | Admin | Manager | Regular | Read-Only |
| ------------- | ----- | ------- | ------- | --------- |
| UI Access     | [ ]   | [ ]     | [ ]     | [ ]       |
| /api/branches | [ ]   | [ ]     | [ ]     | [ ]       |
| /api/users    | [ ]   | [ ]     | [ ]     | [ ]       |
| /api/reports  | [ ]   | [ ]     | [ ]     | [ ]       |
| Edge Cases    | [ ]   | [ ]     | [ ]     | [ ]       |

## Notes

- Document any unexpected behavior here
- Note any permissions that need adjustment
- Document any security concerns discovered
