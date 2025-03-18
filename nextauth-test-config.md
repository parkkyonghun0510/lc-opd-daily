# NextAuth Testing Configuration

## Temporarily Modifying NextAuth for Testing

Follow these steps to modify your NextAuth configuration for thorough testing:

### 1. Reduce Session Expiration Time

For testing session expiration, temporarily modify `src/lib/auth.ts`:

```typescript
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
  session: {
    strategy: "jwt",
    // Change from 30 days to 60 seconds for testing
    maxAge: 60, // 60 seconds
  },
  // ... rest of configuration
};
```

### 2. Enable Debug Logging

To get more insight into NextAuth operations, enable debug mode:

```typescript
export const authOptions: NextAuthOptions = {
  debug: true, // Enable debug logging
  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
  // ... rest of configuration
};
```

### 3. Test Multiple Authentication Providers (Optional)

If you plan to add more providers in the future:

```typescript
export const authOptions: NextAuthOptions = {
  // ... existing config
  providers: [
    CredentialsProvider({
      // Your existing credentials provider
    }),
    // Add a test provider (remove before production)
    // This is just an example, not required for your current testing
    GithubProvider({
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
    }),
  ],
};
```

### 4. Test with Different Callbacks

To ensure your callback functions handle all scenarios correctly:

```typescript
export const authOptions: NextAuthOptions = {
  // ... existing config
  callbacks: {
    // Existing callbacks

    // Add a signIn callback for testing
    async signIn({ user, account, profile, email, credentials }) {
      console.log("Sign-in attempt", { user, account });
      // Add custom validation logic for testing
      return true;
    },
  },
};
```

### 5. Restore Original Configuration

**IMPORTANT:** After testing, restore your original production configuration:

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

## Running Tests

1. Make the temporary modifications above
2. Restart your development server
3. Run the test scripts:
   - `node test-auth-api.js`
   - `node test-session-expiry.js`
4. Complete the RBAC checklist manually
5. **RESTORE** your original NextAuth configuration
6. Restart your development server again
