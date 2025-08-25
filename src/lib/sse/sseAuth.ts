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
 * This function tries multiple authentication methods in order of security:
 * 1. Session-based authentication (most secure)
 * 2. JWT token-based authentication (secure)
 * 3. Bearer token from Authorization header
 * 4. User ID parameter (least secure, only for development)
 */
export async function authenticateSSERequest(req: NextRequest) {
  try {
    // Get the URL parameters
    const { searchParams } = new URL(req.url);
    
    // Method 1: Try to get user from session (most secure)
    try {
      const session = await getServerSession(authOptions);
      if (session?.user?.id) {
        return {
          userId: session.user.id,
          authenticated: true,
          method: 'session',
          userRole: session.user.role,
          userEmail: session.user.email
        };
      }
    } catch (error) {
      console.error("[SSE Auth] Error getting session:", error);
    }

    // Method 2: Try to get user from JWT token (secure)
    const token = searchParams.get('token');
    if (token) {
      const payload = await verifySSEToken(token);
      if (payload && payload.userId) {
        return {
          userId: payload.userId as string,
          authenticated: true,
          method: 'jwt_token',
          metadata: payload.metadata,
          userRole: payload.metadata?.role,
          userEmail: payload.metadata?.email
        };
      }
    }

    // Method 3: Try Authorization header (for API clients)
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const bearerToken = authHeader.slice(7);
      const payload = await verifySSEToken(bearerToken);
      if (payload && payload.userId) {
        return {
          userId: payload.userId as string,
          authenticated: true,
          method: 'bearer_token',
          metadata: payload.metadata,
          userRole: payload.metadata?.role,
          userEmail: payload.metadata?.email
        };
      }
    }

    // Method 4: Fall back to user ID parameter (least secure, only for development)
    if (process.env.NODE_ENV === 'development') {
      const userId = searchParams.get('userId');
      if (userId) {
        console.warn('[SSE Auth] Using parameter-based auth in development mode');
        return {
          userId,
          authenticated: true,
          method: 'parameter_dev',
          userRole: 'USER'
        };
      }
    }

    // No authentication found
    return {
      userId: null,
      authenticated: false,
      method: null,
      error: 'No valid authentication found'
    };
  } catch (error) {
    console.error('[SSE Auth] Authentication error:', error);
    return {
      userId: null,
      authenticated: false,
      method: null,
      error: error instanceof Error ? error.message : 'Authentication error'
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

/**
 * Get SSE token for authenticated client use
 * 
 * This function can be called from client-side code to get a token for SSE authentication
 */
export async function getSSEToken(): Promise<{ token: string; expiresAt: number } | null> {
  try {
    const response = await fetch('/api/auth/sse-token', {
      method: 'GET',
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get SSE token: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      token: data.token,
      expiresAt: data.expiresAt
    };
  } catch (error) {
    console.error('[SSE Auth] Error getting token:', error);
    return null;
  }
}

/**
 * Refresh SSE token if it's about to expire
 */
export async function refreshSSETokenIfNeeded(currentToken: string | null, expiresAt: number): Promise<{ token: string; expiresAt: number } | null> {
  // Check if token needs refresh (5 minutes before expiry)
  const now = Date.now();
  const refreshThreshold = 5 * 60 * 1000; // 5 minutes
  
  if (!currentToken || (expiresAt - now) < refreshThreshold) {
    return await getSSEToken();
  }
  
  return null;
}
