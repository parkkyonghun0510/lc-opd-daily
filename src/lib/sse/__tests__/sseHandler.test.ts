import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import sseHandler from "../sseHandler";

describe("SSE Handler", () => {
  // Mock response object
  let mockResponse: { write: Mock };

  // Mock client ID and user ID
  const clientId = "test-client-id";
  const userId = "test-user-id";

  beforeEach(() => {
    // Create a fresh mock response for each test
    mockResponse = {
      write: vi.fn(),
    };

    // Clear all clients before each test
    // @ts-expect-error - Accessing private property for testing
    sseHandler.clients.clear();
  });

  afterEach(() => {
    // Clean up after each test
    vi.resetAllMocks();
  });

  it("should add a client", () => {
    // Add a client
    sseHandler.addClient(clientId, userId, mockResponse);

    // Check that the client was added
    // @ts-expect-error - Accessing private property for testing
    expect(sseHandler.clients.size).toBe(1);
    // @ts-expect-error - Accessing private property for testing
    expect(sseHandler.clients.get(clientId)).toBeDefined();
    // @ts-expect-error - Accessing private property for testing
    expect(sseHandler.clients.get(clientId).userId).toBe(userId);
  });

  it("should remove a client", () => {
    // Add a client
    sseHandler.addClient(clientId, userId, mockResponse);

    // Remove the client
    sseHandler.removeClient(clientId);

    // Check that the client was removed
    // @ts-expect-error - Accessing private property for testing
    expect(sseHandler.clients.size).toBe(0);
    // @ts-expect-error - Accessing private property for testing
    expect(sseHandler.clients.get(clientId)).toBeUndefined();
  });

  it("should send an event to a user", () => {
    // Add a client
    sseHandler.addClient(clientId, userId, mockResponse);

    // Send an event to the user
    const eventType = "test-event";
    const eventData = { message: "Hello, world!" };
    sseHandler.sendEventToUser(userId, eventType, eventData);

    // Check that the event was sent
    expect(mockResponse.write).toHaveBeenCalledTimes(1);

    // Check the format of the event
    const expectedEventFormat = `event: ${eventType}\ndata: ${JSON.stringify(eventData)}\n\n`;
    expect(mockResponse.write).toHaveBeenCalledWith(expectedEventFormat);
  });

  it("should broadcast an event to all clients", () => {
    // Add multiple clients
    const clientId2 = "test-client-id-2";
    const userId2 = "test-user-id-2";
    const mockResponse2 = { write: vi.fn() };

    sseHandler.addClient(clientId, userId, mockResponse);
    sseHandler.addClient(clientId2, userId2, mockResponse2);

    // Broadcast an event
    const eventType = "test-broadcast";
    const eventData = { message: "Broadcast message" };
    sseHandler.broadcastEvent(eventType, eventData);

    // Check that the event was sent to all clients
    expect(mockResponse.write).toHaveBeenCalledTimes(1);
    expect(mockResponse2.write).toHaveBeenCalledTimes(1);

    // Check the format of the event
    const expectedEventFormat = `event: ${eventType}\ndata: ${JSON.stringify(eventData)}\n\n`;
    expect(mockResponse.write).toHaveBeenCalledWith(expectedEventFormat);
    expect(mockResponse2.write).toHaveBeenCalledWith(expectedEventFormat);
  });

  it("should update client activity", () => {
    // Add a client
    sseHandler.addClient(clientId, userId, mockResponse);

    // Get the initial last activity timestamp
    // @ts-expect-error - Accessing private property for testing
    const initialLastActivity = sseHandler.clients.get(clientId).lastActivity;

    // Wait a short time
    vi.advanceTimersByTime(100);

    // Update client activity
    sseHandler.updateClientActivity(clientId);

    // Check that the last activity timestamp was updated
    // @ts-expect-error - Accessing private property for testing
    const updatedLastActivity = sseHandler.clients.get(clientId).lastActivity;
    expect(updatedLastActivity).toBeGreaterThan(initialLastActivity);
  });

  it("should clean up inactive connections", () => {
    // Add a client
    sseHandler.addClient(clientId, userId, mockResponse);

    // Set the last activity to a long time ago
    // @ts-expect-error - Accessing private property for testing
    sseHandler.clients.get(clientId).lastActivity = Date.now() - 6 * 60 * 1000; // 6 minutes ago

    // Trigger cleanup
    // @ts-expect-error - Accessing private method for testing
    sseHandler.cleanupInactiveConnections();

    // Check that the client was removed
    // @ts-expect-error - Accessing private property for testing
    expect(sseHandler.clients.size).toBe(0);
  });

  it("should get statistics about connections", () => {
    // Add multiple clients for the same user
    const clientId2 = "test-client-id-2";
    sseHandler.addClient(clientId, userId, mockResponse);
    sseHandler.addClient(clientId2, userId, { write: vi.fn() });

    // Add a client for a different user
    const clientId3 = "test-client-id-3";
    const userId2 = "test-user-id-2";
    sseHandler.addClient(clientId3, userId2, { write: vi.fn() });

    // Get statistics
    const stats = sseHandler.getStats();

    // Check the statistics
    expect(stats.totalConnections).toBe(3);
    expect(stats.uniqueUsers).toBe(2);
    expect(stats.userCounts[userId]).toBe(2);
    expect(stats.userCounts[userId2]).toBe(1);
  });

  it("should handle errors when sending events", () => {
    // Add a client with a response that throws an error
    const errorResponse = {
      write: vi.fn().mockImplementation(() => {
        throw new Error("Test error");
      }),
    };

    sseHandler.addClient(clientId, userId, errorResponse);

    // Send an event to the user
    const eventType = "test-event";
    const eventData = { message: "Hello, world!" };

    // This should not throw an error
    expect(() => {
      sseHandler.sendEventToUser(userId, eventType, eventData);
    }).not.toThrow();

    // The write method should have been called
    expect(errorResponse.write).toHaveBeenCalledTimes(1);
  });
});
