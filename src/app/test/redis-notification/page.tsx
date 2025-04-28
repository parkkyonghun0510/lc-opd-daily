'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, RefreshCw, Send } from 'lucide-react';
import { useHybridRealtime } from '@/hooks/useHybridRealtime';

export default function RedisNotificationTest() {
  const [message, setMessage] = useState('This is a test notification sent at ' + new Date().toLocaleTimeString());
  const [title, setTitle] = useState('Redis Test Notification');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState('');
  const [metrics, setMetrics] = useState<any>(null);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const { toast } = useToast();

  // Initialize real-time connection
  const {
    isConnected: realtimeConnected,
    activeMethod: realtimeMethod,
    lastEvent,
    reconnect
  } = useHybridRealtime();

  // Update connection status when real-time connection changes
  useEffect(() => {
    setIsConnected(realtimeConnected);
    setConnectionMethod(realtimeMethod);
  }, [realtimeConnected, realtimeMethod]);

  // Create a mock events array from lastEvent for backward compatibility
  const events = lastEvent ? [lastEvent] : [];

  // Update recent events when new events are received
  useEffect(() => {
    if (events && events.length > 0) {
      setRecentEvents(prev => {
        // Add new events to the beginning of the array
        const newEvents = [...events, ...prev];
        // Deduplicate events by id
        const uniqueEvents = newEvents.filter((event, index, self) =>
          index === self.findIndex(e => e.id === event.id)
        );
        // Return the first 10 events
        return uniqueEvents.slice(0, 10);
      });
    }
  }, [events]);

  // Fetch metrics on load
  useEffect(() => {
    fetchMetrics();
  }, []);

  // Send a test notification
  const sendTestNotification = async () => {
    try {
      setIsLoading(true);

      const response = await fetch('/api/test/redis-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, title }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send notification');
      }

      toast({
        title: 'Notification Sent',
        description: `Notification ID: ${data.notificationId}`,
      });

      // Update metrics
      setMetrics(data.metrics);

      // Update message with current time
      setMessage('This is a test notification sent at ' + new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Error sending notification:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send notification',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Send a test SSE notification
  const sendTestSSENotification = async () => {
    try {
      setIsLoading(true);

      const response = await fetch('/api/test/sse-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, title }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send SSE notification');
      }

      toast({
        title: 'SSE Notification Sent',
        description: `Event ID: ${data.eventId}`,
      });
    } catch (error) {
      console.error('Error sending SSE notification:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send SSE notification',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch metrics
  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/test/redis-notification');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch metrics');
      }

      setMetrics(data.metrics);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch metrics',
        variant: 'destructive',
      });
    }
  };

  // Check Redis connection
  const checkRedisConnection = async () => {
    try {
      // Instead of checkConnection (which doesn't exist anymore), just trigger reconnect
      reconnect();
      toast({
        title: 'Connection Checked',
        description: `Connected using ${realtimeMethod}`,
      });
    } catch (error) {
      console.error('Error checking connection:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to check connection',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Redis Notification Tester</h1>
      <p className="text-gray-500 mb-8">Test the Redis notification system by sending and receiving notifications in real-time.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Connection Status
              <Badge variant={isConnected ? "success" : "destructive"}>
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
            </CardTitle>
            <CardDescription>Method: {connectionMethod || 'None'}</CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={reconnect}>
              <RefreshCw className="mr-2 h-4 w-4" /> Reconnect
            </Button>
            <Button variant="secondary" onClick={checkRedisConnection}>
              Check Redis Connection
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Redis Status</CardTitle>
            <CardDescription>Metrics about the Redis notification system</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted p-3 rounded-md">
                  <div className="text-sm text-muted-foreground">Queue Length</div>
                  <div className="text-2xl font-bold">{metrics.queueLength}</div>
                </div>
                <div className="bg-muted p-3 rounded-md">
                  <div className="text-sm text-muted-foreground">Processing</div>
                  <div className="text-2xl font-bold">{metrics.processingCount}</div>
                </div>
                <div className="bg-muted p-3 rounded-md">
                  <div className="text-sm text-muted-foreground">History</div>
                  <div className="text-2xl font-bold">{metrics.historyCount}</div>
                </div>
                <div className="bg-muted p-3 rounded-md">
                  <div className="text-sm text-muted-foreground">Errors</div>
                  <div className="text-2xl font-bold">{metrics.errorCount}</div>
                </div>
              </div>
            ) : (
              <div className="flex justify-center items-center h-24">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={fetchMetrics} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh Metrics
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Send Test Notification</CardTitle>
          <CardDescription>Send a test notification to yourself</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium">Title</label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Notification title"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="message" className="text-sm font-medium">Message</label>
              <Input
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Notification message"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button onClick={sendTestSSENotification} variant="outline">
            <Send className="mr-2 h-4 w-4" /> Send Test SSE Notification
          </Button>
          <Button onClick={sendTestNotification} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send Redis Notification
          </Button>
        </CardFooter>
      </Card>

      <Tabs defaultValue="events" className="mt-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="events">Recent Events</TabsTrigger>
          <TabsTrigger value="notifications">Recent Notifications</TabsTrigger>
        </TabsList>
        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
              <CardDescription>Most recent events received from the real-time system</CardDescription>
            </CardHeader>
            <CardContent>
              {recentEvents.length > 0 ? (
                <div className="space-y-4">
                  {recentEvents.map((event: any, index: number) => (
                    <div key={event.id || index} className="border rounded-md p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{event.title || event.type}</h3>
                          <p className="text-sm text-muted-foreground">{event.message || event.body}</p>
                        </div>
                        <Badge variant="outline">{event.type}</Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No events received yet. Send a notification to see events.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Recent Notifications</CardTitle>
              <CardDescription>Notifications from the Redis notification system</CardDescription>
            </CardHeader>
            <CardContent>
              {metrics?.recentNotifications?.length > 0 ? (
                <div className="space-y-4">
                  {metrics.recentNotifications.map((notification: any, index: number) => (
                    <div key={notification.id || index} className="border rounded-md p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{notification.data?.title || notification.type}</h3>
                          <p className="text-sm text-muted-foreground">{notification.data?.body}</p>
                        </div>
                        <Badge variant="outline">{notification.type}</Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {new Date(notification.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No notifications found. Send a notification to see it here.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
