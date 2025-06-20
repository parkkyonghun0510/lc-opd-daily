"use client";

import { useState, useEffect } from "react";
import { useHybridRealtime } from "@/hooks/useHybridRealtime";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function SimpleHybridTest() {
  const [events, setEvents] = useState<any[]>([]);

  // Use the hybrid realtime hook
  const { isConnected, activeMethod, lastEvent, error, reconnect } =
    useHybridRealtime({
      debug: true,
      eventHandlers: {
        // Handle all events with the wildcard handler
        "*": (event) => {
          console.log("Received event:", event);
          setEvents((prev) => [event, ...prev].slice(0, 5));
        },
      },
    });

  // Send a test event
  const sendTestEvent = async () => {
    try {
      const response = await fetch("/api/realtime/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "test",
          message: "Test message from SimpleHybridTest",
        }),
      });

      const data = await response.json();
      console.log("Test event sent:", data);
    } catch (err) {
      console.error("Error sending test event:", err);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Simple Hybrid Test</CardTitle>
        <CardDescription>Testing the hybrid realtime approach</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-4 mb-4">
          <div>
            Status:
            <Badge
              variant={isConnected ? "default" : "destructive"}
              className="ml-2"
            >
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
          <div>
            Method:
            <Badge variant="outline" className="ml-2">
              {activeMethod || "None"}
            </Badge>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded mb-4">
            Error: {error}
          </div>
        )}

        <div className="flex space-x-4 mb-4">
          <Button onClick={reconnect}>Reconnect</Button>
          <Button onClick={sendTestEvent}>Send Test Event</Button>
        </div>

        <div className="mt-4">
          <h3 className="text-sm font-medium mb-2">Recent Events:</h3>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No events received yet
            </p>
          ) : (
            <div className="space-y-2">
              {events.map((event, index) => (
                <div key={index} className="border rounded p-2 text-sm">
                  <div className="flex justify-between mb-1">
                    <Badge variant="outline">{event.type}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className="text-xs bg-muted p-1 rounded overflow-auto">
                    {JSON.stringify(event.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
