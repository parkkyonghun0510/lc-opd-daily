import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { generateSSEToken } from '@/lib/sse/sseAuth';

/**
 * SSE Token Generation API
 * 
 * This endpoint generates secure JWT tokens for SSE authentication.
 * It requires an active session to generate tokens.
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate the user via session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate a token with comprehensive user metadata
    const token = await generateSSEToken(session.user.id, {
      name: session.user.name,
      email: session.user.email,
      role: session.user.role || 'USER',
      branchId: session.user.branchId, // Include branch ID if available
      lastActivity: Date.now(),
      tokenCreatedAt: Date.now(),
      permissions: session.user.permissions || []
    });

    // Calculate expiration times
    const expiresAt = Date.now() + (60 * 60 * 1000); // 1 hour
    const refreshAfter = Date.now() + (45 * 60 * 1000); // 45 minutes

    // Return the token with metadata
    return NextResponse.json({
      token,
      expiresAt,
      refreshAfter,
      userId: session.user.id,
      metadata: {
        role: session.user.role,
        permissions: session.user.permissions || []
      }
    });
  } catch (error) {
    console.error('[SSE Token API] Error generating token:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error',
      message: 'Failed to generate SSE token'
    }, { status: 500 });
  }
}