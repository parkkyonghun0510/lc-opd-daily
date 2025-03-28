# Authentication System Migration Plan

## Overview

This document outlines the plan to consolidate the dual authentication systems currently in use:

1. NextAuth for session-based authentication
2. Custom JWT implementation with jose library

The goal is to standardize on NextAuth while maintaining backward compatibility with existing code.

## Current State

The application currently uses:

- NextAuth for client-side authentication and session management
- Custom JWT implementation for server-side API authentication
- Multiple middleware implementations with overlapping functionality

## Migration Strategy

### Phase 1: Create Compatibility Layer (Completed)

- ✅ Create compatibility functions in `src/lib/auth.ts` that implement the custom JWT API using NextAuth
- ✅ Update `src/lib/jwt.ts` to use the NextAuth compatibility functions while maintaining the same API
- ✅ Update the permission middleware to use NextAuth directly

### Phase 2: API Route Migration (Completed)

For each API route that uses the custom JWT authentication:

1. Identify all API routes using `getUserFromToken` from the custom JWT implementation
2. Update each route to use the compatibility layer
3. Test each route to ensure functionality is maintained
4. Once all routes are migrated, deprecate the custom JWT functions

Migrated routes:

- ✅ `src/app/api/auth/me/route.ts` - Updated to use NextAuth directly
- ✅ `src/app/api/auth/login/route.ts` - Removed JWT token generation and cookie handling
- ✅ `src/app/api/auth/logout/route.ts` - Updated to use NextAuth directly
- ✅ `src/app/api/auth/register/route.ts` - Removed JWT token generation and cookie handling
- ✅ `src/app/api/users/route.ts` - All handlers updated to use NextAuth directly
- ✅ `src/app/api/users/[id]/route.ts` - All handlers updated to use NextAuth directly
- ✅ `src/app/api/reports/[id]/route.ts` - All handlers updated to use NextAuth directly
- ✅ `src/app/api/reports/pending/route.ts` - Updated to use NextAuth directly
- ✅ `src/app/api/reports/consolidated/route.ts` - Updated to use NextAuth directly
- ✅ `src/app/api/branches/route.ts` - All handlers updated to use NextAuth directly

### Phase 3: Login/Authentication Flow Consolidation (Completed)

- ✅ Updated the login flow to use NextAuth exclusively
- ✅ Removed direct authentication in `/api/auth/login` route, focusing on pre-login security checks
- ✅ Marked compatibility functions as deprecated with clear warning messages
- ✅ Added proper TypeScript types for authentication functions
- ✅ Created documentation (`src/lib/auth/README.md`) on how to use NextAuth in all parts of the application
- ✅ Removed unused JWT-related imports (jose library) from auth.ts

### Phase 4: Final Cleanup (In Progress)

#### Files to Remove

1. `src/lib/jwt.ts` - Deprecated JWT implementation
2. Old authentication middleware files (if any)

#### Files to Update

1. `src/lib/auth.ts` - Remove deprecated functions:
   - `getUserFromToken`
   - Any remaining JWT-specific code

#### Documentation Updates

1. Update `src/lib/auth/README.md` with:
   - Remove deprecated function documentation
   - Add NextAuth configuration guide
   - Add authentication usage examples
   - Update troubleshooting section

#### Verification Steps

1. Run the test suite to ensure no regressions
2. Verify all API routes are using NextAuth
3. Check for any remaining references to old JWT functions
4. Ensure all documentation is up to date

### Completed Phases

#### Phase 1 - Compatibility Layer ✅

- Created functions to implement custom JWT API using NextAuth
- Set up NextAuth configuration
- Implemented session handling

#### Phase 2 - API Route Migration ✅

Successfully migrated all API routes to use NextAuth:

- `src/app/api/auth/me/route.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/auth/register/route.ts`
- `src/app/api/users/route.ts`
- `src/app/api/users/[id]/route.ts`
- `src/app/api/reports/[id]/route.ts`
- `src/app/api/reports/pending/route.ts`
- `src/app/api/reports/consolidated/route.ts`
- `src/app/api/branches/route.ts`

#### Phase 3 - Authentication Flow Consolidation ✅

- Updated login flow to use NextAuth exclusively
- Removed custom token generation
- Created comprehensive testing documentation
- Implemented test scripts and configurations

### Next Steps

1. Remove deprecated files
2. Update documentation
3. Run final verification
4. Deploy changes

### Rollback Plan

In case of issues:

1. Revert to the last working commit
2. Re-enable old JWT implementation temporarily
3. Gradually roll back changes if needed

Would you like me to proceed with:

1. Removing the deprecated files?
2. Updating the documentation?
3. Running the verification steps?

## Benefits

- **Simplified Authentication**: Single authentication system using industry-standard NextAuth
- **Reduced Code Complexity**: Fewer authentication-related files and functions
- **Improved Maintainability**: Standard patterns for authentication across the application
- **Better Security**: Reduced risk from maintaining custom JWT implementation
- **Improved Documentation**: Clear guidance for developers on authentication best practices

## Timeline

- Phase 1: Complete
- Phase 2: Complete
- Phase 3: Complete
- Phase 4: To be scheduled after thorough testing of Phases 1-3

## Testing Strategy

1. Unit tests for critical authentication functionality
2. Integration tests for authentication flows
3. Manual testing of all protected routes
4. Special focus on testing edge cases like token expiration and role-based access

## Rollback Plan

If issues are discovered:

1. Revert to the original implementations
2. Fix any compatibility issues
3. Attempt migration again with fixes
