import { NextRequest } from "next/server";
import sseHandler from "@/lib/sse/sseHandler";
import redisSSEHandler from "@/lib/sse/redisSSEHandler";
import { rateLimiter } from "@/lib/rate-limit";
import { authenticateSSERequest } from "@/lib/sse/sseAuth";

export const runtime = "nodejs";

// Use Redis-backed SSE handler if available
const handler = redisSSEHandler || sseHandler;

/**
 * Server-Sent Events (SSE) endpoint
 *
 * This endpoint establishes a persistent connection with the client
 * for real-time updates using the SSE protocol.
 *
 * Enhanced with:
 * - Multiple authentication methods (session, JWT token, bearer token)
 * - Improved error handling and connection management
 * - Better client metadata tracking
 * - Health monitoring and connection diagnostics
 */
export async function GET(req: NextRequest) {
    try {
        // Apply rate limiting
        const rateLimitResponse = await rateLimiter.applyRateLimit(req, {
            identifier: 'sse',
            limit: 5, // Maximum 5 connections per user/IP
            window: 60 // Within a 60-second window
        });

        // If rate limited, return the response
        if (rateLimitResponse) {
            console.log('[SSE] Rate limit exceeded');
            return rateLimitResponse;
        }

        // Authenticate the request using multiple methods
        const auth = await authenticateSSERequest(req);

        // Require authentication
        if (!auth.authenticated || !auth.userId) {
            console.log('[SSE] Authentication failed:', auth.error || 'No authentication');
            return new Response("Unauthorized: Authentication required", {
                status: 401,
                headers: {
                    'WWW-Authenticate': 'Bearer',
                    'X-Error-Details': auth.error || 'Authentication required'
                }
            });
        }

        const userId = auth.userId;
        console.log(`[SSE] User ${userId} authenticated via ${auth.method}`);

        // Check if user already has too many active connections
        try {
            const stats = await handler.getStats();
            let userConnections = 0;

            if ('localUserCounts' in stats) {
                // Redis handler
                userConnections = (stats as any).localUserCounts[userId] || 0;
            } else {
                // Memory handler
                userConnections = (stats as any).userCounts[userId] || 0;
            }

            // Limit to 3 connections per user per instance
            if (userConnections >= 3) {
                console.log(`[SSE] Too many connections for user ${userId}: ${userConnections}`);
                return new Response("Too many connections for this user", {
                    status: 429,
                    headers: {
                        'Retry-After': '60',
                        'X-Connection-Count': userConnections.toString()
                    }
                });
            }
        } catch (error) {
            console.error("[SSE] Error checking user connection count:", error);
            // Continue anyway, don't block connection for stats error
        }

        // Get client metadata from query parameters and headers
        const { searchParams } = new URL(req.url);
        const clientType = searchParams.get("clientType") || "browser";
        const userAgent = req.headers.get("user-agent") || "unknown";
        const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
        const clientInfo = searchParams.get("clientInfo") || userAgent;

        // Enhanced client metadata
        const clientMetadata = {
            clientType,
            clientInfo,
            userAgent,
            ip,
            connectedAt: new Date().toISOString(),
            authMethod: auth.method,
            userRole: auth.userRole || 'USER',
            userEmail: auth.userEmail
        };

        // Create SSE stream with enhanced error handling
        const stream = new ReadableStream({
            start(controller) {
                const encoder = new TextEncoder();
                const clientId = crypto.randomUUID();
                let isActive = true;

                // Create response object that the SSE handler will use
                const response = {
                    write: (chunk: string) => {
                        if (isActive) {
                            try {
                                controller.enqueue(encoder.encode(chunk));
                            } catch (error) {
                                console.error(`[SSE] Error writing to client ${clientId}:`, error);
                                isActive = false;
                            }
                        }
                    },
                    close: () => {
                        if (isActive) {
                            isActive = false;
                            try {
                                controller.close();
                            } catch (error) {
                                console.error(`[SSE] Error closing stream for client ${clientId}:`, error);
                            }
                        }
                    },
                    error: (err: Error) => {
                        if (isActive) {
                            isActive = false;
                            try {
                                controller.error(err);
                            } catch (error) {
                                console.error(`[SSE] Error reporting error for client ${clientId}:`, error);
                            }
                        }
                    }
                };

                try {
                    // Register client with the SSE handler
                    handler.addClient(clientId, userId!, response, clientMetadata);

                    // Set up enhanced ping interval with health monitoring
                    const pingInterval = setInterval(() => {
                        if (!isActive) {
                            clearInterval(pingInterval);
                            return;
                        }

                        try {
                            // Send ping with health status and update activity timestamp
                            handler.sendEventToUser(userId!, "ping", {
                                timestamp: Date.now(),
                                clientId,
                                serverTime: new Date().toISOString(),
                                connectionDuration: Date.now() - Date.now() // Will be calculated by handler
                            });
                            handler.updateClientActivity(clientId, true); // Mark as ping
                        } catch (error) {
                            console.error(`[SSE] Error sending ping to client ${clientId}:`, error);
                            // Don't disconnect on ping error, let cleanup handle it
                        }
                    }, 30000); // 30 second ping

                    // Handle connection close with proper cleanup
                    const handleAbort = () => {
                        if (isActive) {
                            isActive = false;
                            clearInterval(pingInterval);
                            handler.removeClient(clientId, 'Client disconnected');
                            console.log(`[SSE] Client ${clientId} connection aborted`);
                        }
                    };

                    // Listen for abort signal
                    req.signal.addEventListener("abort", handleAbort);

                    // Send initial connection event with comprehensive info
                    handler.sendEventToUser(userId!, "connected", {
                        clientId,
                        timestamp: Date.now(),
                        message: "SSE connection established successfully",
                        serverInfo: {
                            version: "1.0",
                            capabilities: ["ping", "reconnect", "error_recovery"],
                            pingInterval: 30000
                        },
                        clientInfo: clientMetadata
                    });

                    console.log(`[SSE] Client ${clientId} connected successfully for user ${userId}`);
                } catch (error) {
                    console.error(`[SSE] Error setting up client ${clientId}:`, error);
                    if (isActive) {
                        isActive = false;
                        response.error(error as Error);
                    }
                }
            },
            cancel() {
                console.log('[SSE] Stream cancelled by client');
            }
        });

        // Return the SSE response with appropriate headers
        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no", // Important for Nginx
                "Access-Control-Allow-Origin": "*", // Enable CORS for SSE
                "Access-Control-Allow-Headers": "Cache-Control",
                "X-SSE-Version": "1.0"
            },
        });
    } catch (error) {
        console.error('[SSE] Unexpected error in SSE endpoint:', error);
        
        return new Response(
            JSON.stringify({
                error: 'Internal Server Error',
                message: 'Failed to establish SSE connection',
                timestamp: new Date().toISOString()
            }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
    }
}