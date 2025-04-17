import { NextRequest, NextResponse } from 'next/server';
import { getSession } from 'next-auth/react'; // Or your auth method
import { EventEmitter } from 'events';

// Simple in-memory event emitter for broadcasting updates
// In production, consider using Redis Pub/Sub or similar for scalability
const emitter = new EventEmitter();

// Keep track of connected clients
const clients = new Map<string, Response>();

export async function GET(request: NextRequest) {
  // --- Authentication Check (Adapt to your auth system) ---
  // This is a placeholder. Replace with your actual session/token validation.
  // const session = await getSession({ req: request });
  // if (!session || !session.user) {
  //   return new NextResponse('Unauthorized', { status: 401 });
  // }
  // const userId = session.user.id; // Get user ID or unique identifier
  const userId = `user_${Math.random().toString(36).substring(7)}`; // Temporary unique ID for demo
  console.log(`SSE connection opened for user: ${userId}`);

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
          console.log(`Sent SSE event '${event}' to user: ${userId}`);
        } catch (error) {
          console.error(`Error sending SSE to user ${userId}:`, error);
          // Clean up if the client disconnected during send
          controller.close();
          clients.delete(userId);
          emitter.off('update', sendUpdate);
        }
      };

      const sendUpdate = (updateData: any) => {
        // Example: Only send updates relevant to the user/branch
        // if (updateData.branchId === session.user.branchId) { ... }
        sendEvent('dashboardUpdate', updateData);
      };

      // Send a connection confirmation event
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
          console.error(`Error sending keepalive ping to user ${userId}:`, error);
          clearInterval(keepAliveInterval);
          controller.close();
          clients.delete(userId);
          emitter.off('update', sendUpdate);
        }
      }, 30000); // Send a comment every 30 seconds

      // Clean up when the client disconnects
      request.signal.addEventListener('abort', () => {
        console.log(`SSE connection closed for user: ${userId}`);
        clearInterval(keepAliveInterval);
        emitter.off('update', sendUpdate);
        clients.delete(userId);
        // Controller might already be closed by errors, handle gracefully
        try {
          controller.close();
        } catch {}
      });
    },
    cancel(reason) {
      console.log(`SSE stream cancelled for user ${userId}:`, reason);
      emitter.off('update', (updateData: any) => {
         // Ensure the correct listener is removed if multiple exist (unlikely here)
         // This is a simplified removal, adjust if needed
      });
      clients.delete(userId);
    }
  });

  return new NextResponse(stream, { headers });
}

// --- Function to Broadcast Updates ---
// This function would be called from other parts of your backend
// (e.g., after a report is created, approved, user data changes, etc.)
export function broadcastDashboardUpdate(data: any) {
  console.log('Broadcasting dashboard update:', data);
  emitter.emit('update', data);
}

// Example of how to trigger an update (e.g., from another API route or service)
// setTimeout(() => {
//   broadcastDashboardUpdate({ type: 'NEW_REPORT', reportId: '123', branchId: 'branchA' });
// }, 10000);

// setTimeout(() => {
//   broadcastDashboardUpdate({ type: 'USER_PROFILE_UPDATED', userId: 'user_abc' });
// }, 20000);