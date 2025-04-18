import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { EventEmitter } from 'events';
import { DashboardEventType, DashboardUpdatePayload, createDashboardUpdate } from '@/lib/events/dashboard-events';

/**
 * RECOMMENDED SSE IMPLEMENTATION
 *
 * This is the preferred Server-Sent Events (SSE) implementation using EventEmitter
 * for real-time dashboard updates. It properly formats SSE events and handles
 * client connections efficiently.
 *
 * Features:
 * - Proper event-based architecture with EventEmitter
 * - Authentication support
 * - Keepalive mechanism to prevent connection timeouts
 * - Proper event formatting with named events
 */

// Simple in-memory event emitter for broadcasting updates
// In production, consider using Redis Pub/Sub or similar for scalability
const emitter = new EventEmitter();

// Keep track of connected clients
const clients = new Map<string, Response>();

export async function GET(request: NextRequest) {
  // --- Authentication Check ---
  let userId: string;

  try {
    // Use getServerSession for API routes in Next.js
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      //console.log('[SSE Debug] Authentication failed: No valid session');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    userId = session.user.id; // Get user ID from session
    //console.log(`[SSE Debug] Connection opened for authenticated user: ${userId} at ${new Date().toISOString()}`);
  } catch (error) {
    console.error('[SSE Debug] Authentication error:', error);
    return new NextResponse('Authentication error', { status: 500 });
  }

  const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Important for Nginx buffering issues
  };

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (event: string, data: any) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(new TextEncoder().encode(message));
          //console.log(`[SSE Debug] Sent SSE event '${event}' to user: ${userId} with data:`, data);
        } catch (error) {
          console.error(`[SSE Debug] Error sending SSE to user ${userId}:`, error);
          // Clean up if the client disconnected during send
          controller.close();
          clients.delete(userId);
          emitter.off('update', sendUpdate);
        }
      };

      const sendUpdate = (updateData: DashboardUpdatePayload) => {
        // Example: Only send updates relevant to the user/branch
        // if (updateData.branchId === session.user.branchId) { ... }
        sendEvent('dashboardUpdate', updateData);
      };

      // Send a connection confirmation event
      //console.log(`[SSE Debug] Sending initial 'connected' event to user: ${userId}`);
      sendEvent('connected', { message: 'SSE connection established' });

      // Register listener for this client
      emitter.on('update', sendUpdate);

      // Store the response object to potentially close it later if needed
      // Note: Closing the controller is the primary way to end the stream
      // clients.set(userId, response); // Storing response might not be necessary with ReadableStream

      // Keep connection alive by sending periodic pings (optional but recommended)
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': keepalive\n\n'));
        } catch (error) {
          console.error(`[SSE Debug] Error sending keepalive ping to user ${userId}:`, error);
          clearInterval(keepAliveInterval);
          controller.close();
          clients.delete(userId);
          emitter.off('update', sendUpdate);
        }
      }, 30000); // Send a comment every 30 seconds

      // Clean up when the client disconnects
      request.signal.addEventListener('abort', () => {
        //console.log(`[SSE Debug] Connection closed for user: ${userId} at ${new Date().toISOString()}`);
        clearInterval(keepAliveInterval);
        emitter.off('update', sendUpdate);
        clients.delete(userId);
        // Controller might already be closed by errors, handle gracefully
        try {
          controller.close();
        } catch { }
      });
    },
    cancel(reason) {
      //console.log(`[SSE Debug] Stream cancelled for user ${userId}:`, reason);
      emitter.off('update', (updateData: any) => {
        // Ensure the correct listener is removed if multiple exist (unlikely here)
        // This is a simplified removal, adjust if needed
      });
      clients.delete(userId);
    }
  });

  return new NextResponse(stream, { headers });

  // --- Function to Broadcast Updates ---
  // This function would be called from other parts of your backend
  // (e.g., after a report is created, approved, user data changes, etc.)
  // export function broadcastDashboardUpdate(data: any) {
  //   //console.log('[SSE Debug] Broadcasting dashboard update:', data);
  //   emitter.emit('update', data);
  // }
}

export function broadcastDashboardUpdate(type: DashboardEventType, data: unknown) {
  const payload = createDashboardUpdate(type, data);
  //console.log('[SSE Debug] Broadcasting dashboard update:', payload);
  emitter.emit('dashboardUpdate', payload);
}

// Example of how to trigger an update (e.g., from another API route or service)
// setTimeout(() => {
//   broadcastDashboardUpdate({ type: 'NEW_REPORT', reportId: '123', branchId: 'branchA' });
// }, 10000);

// setTimeout(() => {
//   broadcastDashboardUpdate({ type: 'USER_PROFILE_UPDATED', userId: 'user_abc' });
// }, 20000);