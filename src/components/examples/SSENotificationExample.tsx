'use client';

import { useState, useEffect } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

/**
 * SSE Notification Example Component
 *
 * This component demonstrates how to use SSE for real-time notifications.
 */
export function SSENotificationExample() {
  const [notifications, setNotifications] = useState<any[]>([]);

  // Use the SSE hook to connect to the SSE endpoint
  const { isConnected, error, lastEvent, reconnect, closeConnection } = useSSE({
    sseEndpoint: '/api/sse',
    // Configure event handlers for different event types
    eventHandlers: {
      // Handle notification events
      notification: (data: any) => {
        toast.info(data.title || 'Notification', {
          description: data.message || 'New notification received',
        });

        // Add the notification to our local state
        setNotifications((prev) => [data, ...prev].slice(0, 10));
      },

      // Handle system alert events
      systemAlert: (data: any) => {
        const toastType = data.type === 'error' ? toast.error :
          data.type === 'warning' ? toast.warning : toast.info;

        toastType(data.message || 'System alert');
      },

      // Handle ping events (optional, for debugging)
      ping: (data: any) => {
        console.log('Ping received:', data);
      }
    },

    // Enable debug logging
    debug: true,

    // Enable client-side caching of events
    enableCache: true
  });

  // Function to trigger a test notification
  const triggerTestNotification = async () => {
    try {
      const response = await fetch('/api/test-notification', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to trigger test notification');
      }

      toast.success('Test notification triggered');
    } catch (error) {
      console.error('Error triggering test notification:', error);
      toast.error('Failed to trigger test notification');
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Real-Time Notifications
          <Badge variant={isConnected ? "success" : "destructive"}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </CardTitle>
        <CardDescription>
          Receive notifications in real-time using Server-Sent Events (SSE)
        </CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4">
            Connection error: {error.toString()}
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Recent Notifications</h3>
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification, index) => (
                  <div key={notification.id || index} className="bg-muted p-3 rounded-md">
                    <div className="flex justify-between">
                      <h4 className="font-medium">{notification.title}</h4>
                      <span className="text-xs text-muted-foreground">
                        {new Date(notification.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm">{notification.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-medium mb-2">Last Event</h3>
            {lastEvent ? (
              <div className="bg-muted p-3 rounded-md">
                <div className="flex justify-between">
                  <span className="text-xs font-medium">{lastEvent.type}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(lastEvent.timestamp || Date.now()).toLocaleTimeString()}
                  </span>
                </div>
                <pre className="text-xs mt-2 overflow-auto max-h-24">
                  {/* {JSON.stringify(lastEvent.payload, null, 2)} */}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No events received yet</p>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between">
        <div className="flex gap-2">
          {isConnected ? (
            <Button variant="outline" onClick={closeConnection}>
              Disconnect
            </Button>
          ) : (
            <Button variant="outline" onClick={reconnect}>
              Reconnect
            </Button>
          )}
        </div>

        <Button onClick={triggerTestNotification}>
          Trigger Test Notification
        </Button>
      </CardFooter>
    </Card>
  );
}
