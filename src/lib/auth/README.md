# Authentication System Documentation

## Overview

This application uses NextAuth.js for all authentication and session management. This document provides guidance on how to properly implement authentication in different parts of the application.

## Key Files

- `src/lib/auth.ts` - Contains NextAuth configuration and authentication utilities
- `src/app/api/auth/[...nextauth]/route.ts` - NextAuth API route handler
- `src/components/providers/NextAuthProvider.tsx` - Client-side provider for NextAuth

## Authentication Methods

### Client-Side Authentication

To access the current session on the client side:

```tsx
"use client";

import { useSession } from "next-auth/react";

export default function ProfilePage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (status === "unauthenticated") {
    return <div>Not authenticated</div>;
  }

  return (
    <div>
      <h1>Welcome {session?.user?.name}</h1>
      <p>Email: {session?.user?.email}</p>
      <p>Role: {session?.user?.role}</p>
    </div>
  );
}
```

### Server-Side Authentication

#### In Server Components

```tsx
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return <div>Not authenticated</div>;
  }

  return (
    <div>
      <h1>Welcome {session.user.name}</h1>
      <p>Email: {session.user.email}</p>
      <p>Role: {session.user.role}</p>
    </div>
  );
}
```

#### In API Routes

```tsx
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request });

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Access token properties
  const userId = token.id;
  const userRole = token.role;

  // Continue with protected API logic
  return NextResponse.json({ message: "Success" });
}
```

## Authentication Flows

### Login

1. User navigates to `/login`
2. User submits credentials
3. NextAuth validates credentials
4. On success, NextAuth creates a session and redirects to the callback URL

### Logout

```tsx
"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <Button onClick={() => signOut({ callbackUrl: "/" })}>Sign Out</Button>
  );
}
```

## Role-Based Access Control

Role-based permissions are defined in `src/lib/auth/roles.ts`. Use the `hasPermission` function to check if a user has the required permission:

```tsx
import { hasPermission, Permission, UserRole } from "@/lib/auth/roles";

// Check if user has permission
const canApproveReports = hasPermission(userRole, Permission.APPROVE_REPORTS);
```

## Best Practices

1. Always use NextAuth functions directly - avoid using deprecated compatibility functions
2. For API routes, use `getToken()` from 'next-auth/jwt' to verify authentication
3. Always handle loading and unauthenticated states in client components
4. Use `getServerSession()` for server components
5. Check user permissions before displaying sensitive UI elements

## Troubleshooting

### Session Not Available

If the session is not available in client components, ensure:

- `NextAuthProvider` is wrapping your application in the root layout
- The component is a client component with 'use client' directive
- You're using `useSession()` to access the session

### Token Not Available in API Routes

If `getToken()` returns null in API routes, check:

- The user is authenticated
- The NextAuth secret is properly configured
- The JWT expiration has not passed

## Migration Notes

This application has been migrated from a custom JWT implementation to NextAuth. The following functions are deprecated and should not be used:

- `getUserFromToken()` - Use `getToken()` from 'next-auth/jwt' instead
- `generateToken()` - Use NextAuth signIn directly
- `verifyToken()` - Use `getToken()` from 'next-auth/jwt' instead

If you encounter any references to these functions, please update them to use the NextAuth equivalents.
