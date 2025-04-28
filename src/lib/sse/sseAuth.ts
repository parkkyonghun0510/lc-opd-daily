import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { SignJWT, jwtVerify } from 'jose';

/**
 * SSE Authentication
 *
 * This module provides authentication utilities for SSE connections.
 */

// Secret key for JWT signing
const SECRET_KEY = new TextEncoder().encode(
  process.env.SSE_JWT_SECRET || process.env.NEXTAUTH_SECRET || 'sse-secret-key'
);

// Token expiration time (1 hour)
const TOKEN_EXPIRATION = '1h';

/**
 * Generate an SSE token for a user
 *
 * This token is used to authenticate SSE connections without requiring
 * the full session cookie on every request.
 */
export async function generateSSEToken(userId: string, metadata: Record<string, any> = {}) {
  try {
    const token = await new SignJWT({
      userId,
      metadata,
      type: 'sse-token'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(TOKEN_EXPIRATION)
      .sign(SECRET_KEY);

    return token;
  } catch (error) {
    console.error('[SSE Auth] Error generating token:', error);
    throw new Error('Failed to generate SSE token');
  }
}

/**
 * Verify an SSE token
 */
export async function verifySSEToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload;
  } catch (error) {
    console.error('[SSE Auth] Error verifying token:', error);
    return null;
  }
}

/**
 * Authenticate an SSE request
 *
 * This function tries multiple authentication methods:
 * 1. Session-based authentication
 * 2. Token-based authentication
 * 3. User ID parameter (least secure, for backward compatibility)
 */
export async function authenticateSSERequest(req: NextRequest) {
  try {
    // Get the URL parameters
    const { searchParams } = new URL(req.url);

    // Try to get user from session (most secure)
    try {
      const session = await getServerSession(authOptions);
      if (session?.user?.id) {
        return {
          userId: session.user.id,
          authenticated: true,
          method: 'session'
        };
      }
    } catch (error) {
      console.error("[SSE Auth] Error getting session:", error);
    }

    // Try to get user from token (secure)
    const token = searchParams.get('token');
    if (token) {
      const payload = await verifySSEToken(token);
      if (payload && payload.userId) {
        return {
          userId: payload.userId as string,
          authenticated: true,
          method: 'token',
          metadata: payload.metadata
        };
      }
    }

    // Fall back to user ID parameter (least secure, for backward compatibility)
    const userId = searchParams.get('userId');
    if (userId) {
      return {
        userId,
        authenticated: true,
        method: 'parameter'
      };
    }

    // No authentication found
    return {
      userId: null,
      authenticated: false,
      method: null
    };
  } catch (error) {
    console.error('[SSE Auth] Authentication error:', error);
    return {
      userId: null,
      authenticated: false,
      method: null,
      error: 'Authentication error'
    };
  }
}

/**
 * Generate an SSE token endpoint
 *
 * This endpoint generates an SSE token for the authenticated user.
 */
export async function generateSSETokenHandler(req: NextRequest) {
  try {
    // Authenticate the user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate a token with more user data
    const token = await generateSSEToken(session.user.id, {
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
      branchId: session.user.branchId, // Include branch ID if available
      lastActivity: Date.now(), // Track last activity for session management
      tokenCreatedAt: Date.now() // For token refresh logic
    });

    // Return the token with expiration info
    return NextResponse.json({
      token,
      expiresAt: Date.now() + (60 * 60 * 1000), // 1 hour from now
      refreshAfter: Date.now() + (45 * 60 * 1000) // 45 minutes from now (for proactive refresh)
    });
  } catch (error) {
    console.error('[SSE Auth] Error generating token:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
