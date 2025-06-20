"use client";

import { useState, useEffect } from "react";
import { useHybridRealtime } from "@/hooks/useHybridRealtime";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function HybridRealtimeDemo() {
  // State for events
  const [events, setEvents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("auto");

  // Use the hybrid realtime hook
  const { isConnected, activeMethod, lastEvent, error, reconnect } =
    useHybridRealtime({
      // preferredMethod is not supported in the simplified version
      debug: true,
      eventHandlers: {
        // Handle all events with the wildcard handler
        "*": (event) => {
          console.log("Received event:", event);
          setEvents((prev) => [event, ...prev].slice(0, 10));
        },
        // Specific handlers for different event types
        notification: (data) => {
          console.log("Notification:", data);
        },
        dashboardUpdate: (data) => {
          console.log("Dashboard update:", data);
        },
      },
    });

  // Test sending an event
  const sendTestEvent = async () => {
    try {
      const response = await fetch("/api/realtime/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "test",
          message: "Test message from client",
        }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Test event sent:", data);
    } catch (err) {
      console.error("Error sending test event:", err);
    }
  };

  // Change the connection method
  const changeMethod = (method: string) => {
    setActiveTab(method);
  };

  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Hybrid Realtime Demo</CardTitle>
          <CardDescription>
            Demonstrates the hybrid SSE/Polling approach for real-time updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <div>
              Status:
              {isConnected ? (
                <Badge variant="success" className="ml-2">
                  Connected
                </Badge>
              ) : (
                <Badge variant="destructive" className="ml-2">
                  Disconnected
                </Badge>
              )}
            </div>
            <div>
              Method:
              <Badge variant="outline" className="ml-2">
                {activeMethod || "None"}
              </Badge>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Tabs value={activeTab} onValueChange={changeMethod}>
            <TabsList className="mb-4">
              <TabsTrigger value="auto">Auto (Recommended)</TabsTrigger>
              <TabsTrigger value="sse">SSE Only</TabsTrigger>
              <TabsTrigger value="polling">Polling Only</TabsTrigger>
            </TabsList>

            <TabsContent value="auto">
              <p>
                Auto mode uses SSE when available and falls back to polling when
                necessary.
              </p>
            </TabsContent>
            <TabsContent value="sse">
              <p>
                SSE mode uses Server-Sent Events exclusively. May not work in
                all browsers.
              </p>
            </TabsContent>
            <TabsContent value="polling">
              <p>
                Polling mode uses regular HTTP requests at intervals. Works
                everywhere but less efficient.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button onClick={reconnect}>Reconnect</Button>
          <Button onClick={sendTestEvent}>Send Test Event</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
          <CardDescription>
            Last {events.length} events received
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-muted-foreground">No events received yet</p>
          ) : (
            <div className="space-y-4">
              {events.map((event, index) => (
                <div key={index} className="border rounded-md p-4">
                  <div className="flex justify-between mb-2">
                    <Badge>{event.type}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatTime(event.timestamp)}
                    </span>
                  </div>
                  <pre className="bg-muted p-2 rounded text-sm overflow-auto">
                    {JSON.stringify(event.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
