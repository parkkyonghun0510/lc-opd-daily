# Authentication System Testing Guide

This guide provides a comprehensive approach to testing your authentication system after migrating from custom JWT to NextAuth.

## Preparation

Before starting the tests, ensure your development environment is properly set up:

1. **Install Dependencies**

   ```bash
   npm install node-fetch
   ```

2. **Configure for Testing**
   Temporarily modify your NextAuth configuration in `src/lib/auth.ts`:

   ```typescript
   export const authOptions: NextAuthOptions = {
     debug: true, // Enable debug logging
     secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
     session: {
       strategy: "jwt",
       maxAge: 60, // 60 seconds (for testing expiration)
     },
     // ... rest of configuration
   };
   ```

3. **Restart Your Server**
   ```bash
   npm run dev
   ```

## Testing Categories

### 1. Login Flow Tests (Manual)

Test the following scenarios manually:

- **Successful Login**

  - Navigate to `/login`
  - Enter valid credentials
  - Verify redirection to dashboard/home page
  - Verify user information is displayed correctly

- **Failed Login (Invalid Credentials)**

  - Navigate to `/login`
  - Enter invalid username/password
  - Verify appropriate error message
  - Verify you remain on login page

- **Account Lockout**

  - Navigate to `/login`
  - Attempt login with invalid credentials multiple times (typically 5)
  - Verify account lockout message appears
  - Try with valid credentials and verify lockout message persists

- **Redirect After Login**
  - Navigate to a protected page that redirects to login
  - Complete login
  - Verify redirection to the originally requested page

### 2. API Authentication Tests (Automated)

Run the provided script to test authentication for API routes:

```bash
node test-auth-api.js
```

This script will:

- Test protected endpoints without authentication
- Attempt login and obtain a token
- Test protected endpoints with valid authentication
- Report any issues or security concerns

### 3. Session Expiration Tests (Automated)

Test token expiration behavior with:

```bash
node test-session-expiry.js
```

This script will:

- Login and obtain a session token
- Test access with a fresh token
- Wait for the token to expire (60 seconds)
- Test access with the expired token
- Verify that expired tokens are properly rejected

### 4. Role-Based Access Control Tests (Manual)

Use the provided RBAC checklist (`rbac-test-checklist.md`) to verify access controls for different user roles:

1. For each role (Admin, Manager, Regular, Read-Only):

   - Log in with a user of that role
   - Attempt to access various pages and features
   - Verify that permissions are correctly enforced
   - Test API endpoints with appropriate credentials

2. Check the following specific permissions:
   - Branch management
   - User management
   - Report creation and editing
   - Report approval
   - Data visibility across branches

### 5. Security Edge Cases

Test these additional security scenarios:

- **Logout Behavior**
  - Log in, then log out
  - Verify session is properly terminated
  - Attempt to access protected resources with the old token
- **Token Manipulation**

  - Obtain a valid token
  - Modify the token content
  - Verify the manipulated token is rejected

- **Cross-Site Protection**
  - Check that CSRF protections are in place
  - Verify that session tokens have appropriate security attributes

## Troubleshooting Common Issues

If you encounter issues during testing:

1. **401 Unauthorized Errors**

   - Confirm token is being sent correctly in the request
   - Check that token secret is consistent
   - Verify that token hasn't expired

2. **Session Persistence Issues**

   - Check that cookies are being set correctly
   - Verify that `sameSite`, `secure`, and `httpOnly` are properly configured
   - Confirm that session strategy is set to "jwt"

3. **Role/Permission Problems**
   - Verify that role information is correctly included in the token
   - Check that role comparison logic works correctly
   - Confirm that access control checks are consistent across the application

## After Testing

1. **Restore Original Configuration**
   Remember to restore your original NextAuth settings:

   ```typescript
   export const authOptions: NextAuthOptions = {
     secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
     session: {
       strategy: "jwt",
       maxAge: 30 * 24 * 60 * 60, // Back to 30 days
     },
     debug: false, // Disable debug logging
     // ... rest of original configuration
   };
   ```

2. **Restart Your Server**

   ```bash
   npm run dev
   ```

3. **Document Results**
   - Record any issues discovered during testing
   - Document any changes needed before proceeding to Phase 4

## Final Verification

Before moving to Phase 4 (Final Cleanup):

1. Verify all API routes are using NextAuth correctly
2. Confirm that client-side authentication works as expected
3. Validate that logout properly terminates sessions
4. Check that error handling is consistent across the application
