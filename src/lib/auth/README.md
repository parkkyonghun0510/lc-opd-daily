# Authentication Documentation

## Overview

This application uses NextAuth.js for authentication. NextAuth.js provides a complete authentication solution with support for multiple providers, session management, and JWT handling.

## Configuration

Authentication is configured in `src/lib/auth.ts`. The main configuration includes:

```typescript
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      // Credentials provider configuration
    }),
  ],
  callbacks: {
    // JWT and session callbacks
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};
```

## Usage Examples

### API Routes

```typescript
import { getToken } from "next-auth/jwt";

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request });

  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized - Authentication required" },
      { status: 401 }
    );
  }

  // Your authenticated logic here
}
```

### Client Components

```typescript
"use client";
import { useSession, signIn, signOut } from "next-auth/react";

export default function AuthComponent() {
  const { data: session } = useSession();

  if (session) {
    return (
      <>
        Signed in as {session.user.email}
        <button onClick={() => signOut()}>Sign out</button>
      </>
    );
  }
  return <button onClick={() => signIn()}>Sign in</button>;
}
```

### Server Components

```typescript
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export default async function ServerComponent() {
  const session = await getServerSession(authOptions);

  if (session) {
    return <div>Welcome {session.user.email}</div>;
  }
  return <div>Please sign in</div>;
}
```

## Role-Based Access Control

The application supports role-based access control through the user's role stored in the JWT token:

- Admin users: Full access to all features
- Regular users: Limited access based on their role

Example of role checking:

```typescript
if (token.role !== "admin") {
  return NextResponse.json(
    { error: "Forbidden - Admin access required" },
    { status: 403 }
  );
}
```

## Error Handling

Common authentication errors and their meanings:

- 401 Unauthorized: User is not authenticated
- 403 Forbidden: User is authenticated but lacks required permissions
- 400 Bad Request: Invalid credentials or request format

## Testing

For testing authentication:

1. Configure test environment:

   ```typescript
   // Set shorter session duration
   session: {
     maxAge: 60; // 60 seconds
   }
   ```

2. Run the test scripts:
   ```bash
   node test-auth-api.js
   node test-session-expiry.js
   ```

## Troubleshooting

### Common Issues

1. Token Expiration

   - Default session duration is 30 days
   - Check token expiration in session callback
   - Use refresh token rotation if needed

2. CORS Issues

   - Ensure NextAuth callback URL is configured correctly
   - Check CORS settings in `next.config.js`

3. Role-Based Access
   - Verify token contains correct role information
   - Check role verification logic in protected routes

### Debug Mode

Enable debug logging in NextAuth configuration:

```typescript
debug: process.env.NODE_ENV === "development";
```

## Security Best Practices

1. Always use HTTPS in production
2. Implement proper CSRF protection
3. Use secure session cookies
4. Regularly rotate secrets and keys
5. Implement rate limiting for authentication endpoints

## Migration Notes

The application has been migrated from a custom JWT implementation to NextAuth.js. All deprecated functions have been removed:

- ❌ `getUserFromToken()` -> ✅ Use `getToken()` from 'next-auth/jwt'
- ❌ `generateToken()` -> ✅ Use NextAuth signIn
- ❌ `verifyToken()` -> ✅ Use `getToken()` from 'next-auth/jwt'
