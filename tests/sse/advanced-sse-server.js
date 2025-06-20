import http from "http";
import fs from "fs";
import path from "path";
import { URL } from "url";
import { fileURLToPath } from "url";

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SSE Handler class - similar to your sseHandler.ts implementation
class SSEHandler {
  constructor() {
    this.clients = new Map();
    this.cleanupInterval = setInterval(
      () => this.cleanupInactiveConnections(),
      30000,
    );
    console.log("[SSE] Handler initialized");
  }

  // Add a new client connection
  addClient(id, userId, response, metadata = {}) {
    const now = Date.now();
    this.clients.set(id, {
      id,
      userId,
      response,
      connectedAt: now,
      lastActivity: now,
      metadata,
    });

    console.log(
      `[SSE] Client connected: ${id} for user: ${userId}. Total: ${this.clients.size}`,
    );
    return id;
  }

  // Remove a client connection
  removeClient(id) {
    const client = this.clients.get(id);
    if (client) {
      console.log(
        `[SSE] Client disconnected: ${id} for user: ${client.userId}. Total before removal: ${this.clients.size}`,
      );
      this.clients.delete(id);
      return true;
    }
    return false;
  }

  // Send an event to a specific user
  sendEventToUser(userId, eventType, data, options = {}) {
    const startTime = Date.now();
    let sentCount = 0;

    for (const client of this.clients.values()) {
      if (client.userId === userId) {
        this.sendEvent(client.response, {
          type: eventType,
          data,
          retry: options.retry,
          id: options.id,
        });
        client.lastActivity = Date.now();
        sentCount++;
      }
    }

    if (sentCount > 0) {
      const processingTime = Date.now() - startTime;
      console.log(
        `[SSE] Sent '${eventType}' event to user ${userId} (${sentCount} connections) in ${processingTime}ms`,
      );
    }

    return sentCount;
  }

  // Broadcast an event to all connected clients
  broadcastEvent(eventType, data, options = {}) {
    const startTime = Date.now();
    console.log(
      `[SSE] Broadcasting '${eventType}' event to all clients (${this.clients.size})`,
    );

    // Track unique users that received the event
    const userIds = new Set();

    for (const client of this.clients.values()) {
      this.sendEvent(client.response, {
        type: eventType,
        data,
        retry: options.retry,
        id: options.id,
      });
      client.lastActivity = Date.now();
      userIds.add(client.userId);
    }

    const processingTime = Date.now() - startTime;
    console.log(
      `[SSE] Broadcast complete: Sent to ${this.clients.size} connections (${userIds.size} unique users) in ${processingTime}ms`,
    );

    return this.clients.size;
  }

  // Send a properly formatted SSE event
  sendEvent(response, event) {
    try {
      // Format the event according to SSE specification
      let message = "";

      // Add event type if provided
      if (event.type) {
        message += `event: ${event.type}\n`;
      }

      // Add event ID if provided
      if (event.id) {
        message += `id: ${event.id}\n`;
      }

      // Add retry if provided
      if (event.retry) {
        message += `retry: ${event.retry}\n`;
      }

      // Add data (required)
      message += `data: ${JSON.stringify(event.data)}\n\n`;

      // Send the message
      response.write(message);
      return true;
    } catch (error) {
      console.error("[SSE] Error sending event:", error);
      return false;
    }
  }

  // Clean up inactive connections
  cleanupInactiveConnections() {
    const now = Date.now();
    const INACTIVE_TIMEOUT = 3 * 60 * 1000; // 3 minutes
    const STALE_TIMEOUT = 15 * 60 * 1000; // 15 minutes

    let inactiveCount = 0;
    let staleCount = 0;

    for (const [id, client] of this.clients.entries()) {
      const inactiveDuration = now - client.lastActivity;
      const totalDuration = now - client.connectedAt;

      // Remove inactive clients
      if (inactiveDuration > INACTIVE_TIMEOUT) {
        console.log(
          `[SSE] Removing inactive client: ${id} (inactive for ${Math.round(inactiveDuration / 1000)}s)`,
        );
        this.clients.delete(id);
        inactiveCount++;
        continue;
      }

      // Remove stale clients (connected for too long)
      if (totalDuration > STALE_TIMEOUT) {
        console.log(
          `[SSE] Removing stale client: ${id} (connected for ${Math.round(totalDuration / 1000)}s)`,
        );
        this.clients.delete(id);
        staleCount++;
        continue;
      }
    }

    if (inactiveCount > 0 || staleCount > 0) {
      console.log(
        `[SSE] Cleanup complete: Removed ${inactiveCount} inactive and ${staleCount} stale connections. Remaining: ${this.clients.size}`,
      );
    }
  }

  // Get statistics about current connections
  getStats() {
    // Count connections per user
    const userCounts = {};
    for (const client of this.clients.values()) {
      userCounts[client.userId] = (userCounts[client.userId] || 0) + 1;
    }

    // Count connections per client type
    const clientTypes = {};
    for (const client of this.clients.values()) {
      const clientType = client.metadata?.clientType || "unknown";
      clientTypes[clientType] = (clientTypes[clientType] || 0) + 1;
    }

    return {
      totalConnections: this.clients.size,
      uniqueUsers: Object.keys(userCounts).length,
      userCounts,
      clientTypes,
      timestamp: new Date().toISOString(),
    };
  }
}

// Create a singleton instance of the SSE handler
const sseHandler = new SSEHandler();

// Create a simple HTTP server
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Serve the client HTML file
  if (pathname === "/" || pathname === "/index.html") {
    fs.readFile(path.join(__dirname, "test-sse-client.html"), (err, data) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    });
    return;
  }

  // SSE endpoint
  if (
    pathname === "/sse" ||
    pathname === "/api/sse" ||
    pathname === "/api/dashboard/sse"
  ) {
    // Get user ID from query parameters (in a real app, this would come from authentication)
    const userId = url.searchParams.get("userId") || "anonymous-user";
    const clientType = url.searchParams.get("clientType") || "browser";
    const clientInfo =
      url.searchParams.get("clientInfo") || req.headers["user-agent"];

    console.log(
      `[SSE] New connection request from user: ${userId}, client: ${clientType}`,
    );

    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Important for Nginx
    });

    // Generate a unique client ID
    const clientId =
      Date.now().toString(36) + Math.random().toString(36).substring(2);

    // Register client with the SSE handler
    sseHandler.addClient(clientId, userId, res, {
      clientType,
      clientInfo,
      userAgent: req.headers["user-agent"],
      endpoint: pathname,
    });

    // Send initial connection message
    sseHandler.sendEventToUser(userId, "connected", {
      message: `Connected to SSE server (${pathname})`,
      clientId,
      timestamp: Date.now(),
    });

    // Send a ping every 10 seconds to keep the connection alive
    const pingInterval = setInterval(() => {
      try {
        sseHandler.sendEventToUser(userId, "ping", {
          time: new Date().toISOString(),
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error("[SSE] Error sending ping:", error);
        clearInterval(pingInterval);
        sseHandler.removeClient(clientId);
      }
    }, 10000);

    // Handle client disconnect
    req.on("close", () => {
      clearInterval(pingInterval);
      sseHandler.removeClient(clientId);
    });

    return;
  }

  // Endpoint to trigger custom events
  if (pathname === "/trigger-event") {
    const eventType = url.searchParams.get("type") || "notification";
    const message = url.searchParams.get("message") || "Test notification";
    const userId = url.searchParams.get("userId");

    const eventData = {
      message,
      id: Date.now().toString(36) + Math.random().toString(36).substring(2),
      timestamp: Date.now(),
    };

    let result;

    // Send to specific user or broadcast
    if (userId) {
      result = sseHandler.sendEventToUser(userId, eventType, eventData);
      console.log(
        `[SSE] Sent ${eventType} event to user ${userId}: ${result} connections received it`,
      );
    } else {
      result = sseHandler.broadcastEvent(eventType, eventData);
      console.log(
        `[SSE] Broadcast ${eventType} event: ${result} connections received it`,
      );
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: true,
        message: userId
          ? `Event ${eventType} sent to user ${userId}`
          : `Event ${eventType} broadcast to all users`,
        recipients: result,
      }),
    );

    return;
  }

  // Endpoint to get SSE statistics
  if (pathname === "/api/sse-stats") {
    const stats = sseHandler.getStats();

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        stats,
        handlerType: "memory",
      }),
    );

    return;
  }

  // Endpoint to simulate dashboard updates
  if (pathname === "/api/simulate-dashboard-update") {
    const updateType = url.searchParams.get("type") || "data";

    let data;

    // Generate different types of dashboard updates
    switch (updateType) {
      case "newReport":
        data = {
          type: "newReport",
          reportId: `report-${Date.now()}`,
          title: "New Daily Report",
          status: "pending",
          createdAt: new Date().toISOString(),
          createdBy: "user-123",
        };
        break;

      case "statusChange":
        data = {
          type: "statusChange",
          reportId: `report-${Math.floor(Math.random() * 1000)}`,
          oldStatus: "pending",
          newStatus: "approved",
          updatedAt: new Date().toISOString(),
          updatedBy: "admin-456",
        };
        break;

      case "metrics":
        data = {
          type: "metrics",
          timestamp: new Date().toISOString(),
          metrics: {
            totalReports: Math.floor(Math.random() * 100) + 50,
            pendingReports: Math.floor(Math.random() * 20),
            approvedReports: Math.floor(Math.random() * 80) + 20,
            rejectedReports: Math.floor(Math.random() * 10),
          },
        };
        break;

      default:
        data = {
          type: "generic",
          message: "Dashboard data updated",
          timestamp: new Date().toISOString(),
        };
    }

    // Broadcast the dashboard update
    const result = sseHandler.broadcastEvent("dashboardUpdate", data);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: true,
        message: `Dashboard update (${updateType}) broadcast to all users`,
        recipients: result,
        data,
      }),
    );

    return;
  }

  // Endpoint to simulate system alerts
  if (pathname === "/api/simulate-system-alert") {
    const alertType = url.searchParams.get("type") || "info";
    const message = url.searchParams.get("message") || "System notification";

    const alertData = {
      type: alertType,
      message,
      timestamp: new Date().toISOString(),
      id: `alert-${Date.now()}`,
    };

    // Broadcast the system alert
    const result = sseHandler.broadcastEvent("systemAlert", alertData);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: true,
        message: `System alert (${alertType}) broadcast to all users`,
        recipients: result,
        data: alertData,
      }),
    );

    return;
  }

  // Default 404 response
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Advanced SSE test server running at http://localhost:${PORT}`);
  console.log(`- SSE endpoints:`);
  console.log(`  * http://localhost:${PORT}/sse`);
  console.log(`  * http://localhost:${PORT}/api/sse`);
  console.log(`  * http://localhost:${PORT}/api/dashboard/sse`);
  console.log(
    `- Trigger event: http://localhost:${PORT}/trigger-event?type=notification&message=Test`,
  );
  console.log(`- Get stats: http://localhost:${PORT}/api/sse-stats`);
  console.log(
    `- Simulate dashboard update: http://localhost:${PORT}/api/simulate-dashboard-update?type=metrics`,
  );
  console.log(
    `- Simulate system alert: http://localhost:${PORT}/api/simulate-system-alert?type=warning&message=System%20maintenance`,
  );
});
