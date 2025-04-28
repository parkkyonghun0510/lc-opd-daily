'use client';

import { useState, useEffect } from 'react';
import { useHybridRealtime } from '@/hooks/useHybridRealtime';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, AlertCircle, RefreshCw, BarChart } from 'lucide-react';

/**
 * Redis Notification Tester Component
 *
 * This component provides a UI for testing the Redis notification system.
 * It displays real-time notifications and allows triggering test notifications.
 */
export function RedisNotificationTester() {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [redisStatus, setRedisStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [metrics, setMetrics] = useState<any>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);

  // Use the hybrid realtime hook to receive notifications
  const {
    isConnected,
    activeMethod,
    connectionStatus,
    lastEvent,
    error,
    reconnect
  } = useHybridRealtime({
    eventHandlers: {
      // Handle all events
      '*': (event) => {
        console.log('Received event:', event);
        setEvents(prev => [event, ...prev].slice(0, 10));

        // Show toast for notification events
        if (event.type === 'notification') {
          toast(event.title || 'New Notification', {
            description: event.message || event.body || 'You have a new notification',
          });
        }
      },
      // Specific handler for notifications
      notification: (data) => {
        console.log('Notification received:', data);
      }
    },
    debug: true,
    pollingInterval: 5000, // Poll every 5 seconds
  });

  // Check Redis connection and metrics on mount
  useEffect(() => {
    checkRedisConnection();
    fetchRedisMetrics();
  }, []);

  // Function to fetch Redis metrics
  const fetchRedisMetrics = async () => {
    try {
      setIsLoadingMetrics(true);
      const response = await fetch('/api/test/redis-metrics');

      if (!response.ok) {
        throw new Error('Failed to fetch Redis metrics');
      }

      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Error fetching Redis metrics:', error);
      toast.error('Failed to fetch Redis metrics');
    } finally {
      setIsLoadingMetrics(false);
    }
  };

  // Function to check Redis connection
  const checkRedisConnection = async () => {
    try {
      setRedisStatus('checking');
      const response = await fetch('/api/dashboard/test-redis');
      const data = await response.json();

      if (data.status === 'success') {
        setRedisStatus('connected');
      } else {
        setRedisStatus('disconnected');
      }
    } catch (error) {
      console.error('Error checking Redis connection:', error);
      setRedisStatus('disconnected');
    }
  };

  // Function to trigger a test notification
  const triggerTestNotification = async () => {
    try {
      setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  // Function to trigger a Redis notification
  const triggerRedisNotification = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'SYSTEM_NOTIFICATION',
          data: {
            title: 'Redis Test Notification',
            body: `This is a test notification sent at ${new Date().toLocaleTimeString()}`,
            source: 'ui-test',
            timestamp: new Date().toISOString()
          },
          priority: 'high'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send Redis notification');
      }

      const data = await response.json();
      toast.success('Redis notification sent', {
        description: `Notification ID: ${data.notificationId}`,
      });
    } catch (error) {
      console.error('Error sending Redis notification:', error);
      toast.error('Failed to send Redis notification');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Redis Notification Tester
            <Badge variant={redisStatus === 'connected' ? 'success' : redisStatus === 'checking' ? 'outline' : 'destructive'}>
              {redisStatus === 'connected' ? (
                <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4" /> Redis Connected</span>
              ) : redisStatus === 'checking' ? (
                <span className="flex items-center gap-1"><Loader2 className="h-4 w-4 animate-spin" /> Checking Redis</span>
              ) : (
                <span className="flex items-center gap-1"><AlertCircle className="h-4 w-4" /> Redis Disconnected</span>
              )}
            </Badge>
          </CardTitle>
          <CardDescription>
            Test the Redis notification system by sending and receiving notifications in real-time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium mb-2">Connection Status</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Status:</span>
                  <Badge variant={isConnected ? 'success' : 'destructive'}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Method:</span>
                  <Badge variant="outline">{activeMethod || 'None'}</Badge>
                </div>
                {error && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Error:</span>
                    <Badge variant="destructive">{error}</Badge>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={reconnect}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reconnect
                </Button>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Redis Status</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Connection:</span>
                  <Badge variant={redisStatus === 'connected' ? 'success' : redisStatus === 'checking' ? 'outline' : 'destructive'}>
                    {redisStatus === 'connected' ? 'Connected' : redisStatus === 'checking' ? 'Checking' : 'Disconnected'}
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={checkRedisConnection}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Check Redis Connection
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <div className="flex gap-4 w-full">
            <Button
              onClick={triggerTestNotification}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Test SSE Notification
            </Button>
            <Button
              onClick={triggerRedisNotification}
              disabled={isLoading}
              variant="default"
              className="flex-1"
            >
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Redis Notification
            </Button>
          </div>
        </CardFooter>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Recent Events
              <Button
                variant="outline"
                size="sm"
                onClick={reconnect}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </CardTitle>
            <CardDescription>
              Most recent events received from the real-time system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No events received yet. Try sending a test notification.
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((event, index) => (
                  <div key={index} className="border rounded-md p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{event.type || 'unknown'}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <h4 className="font-medium">{event.title || event.id || 'Event'}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {event.message || event.body || JSON.stringify(event.data || {})}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Redis Metrics
              <Button
                variant="outline"
                size="sm"
                onClick={fetchRedisMetrics}
                disabled={isLoadingMetrics}
              >
                {isLoadingMetrics ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <BarChart className="h-4 w-4 mr-2" />
                )}
                Refresh Metrics
              </Button>
            </CardTitle>
            <CardDescription>
              Metrics about the Redis notification system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!metrics ? (
              <div className="text-center py-8 text-muted-foreground">
                {isLoadingMetrics ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-8 w-8 animate-spin mb-2" />
                    <p>Loading metrics...</p>
                  </div>
                ) : (
                  <p>No metrics available. Click "Refresh Metrics" to load.</p>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-2">Notification Metrics</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="border rounded-md p-3">
                      <div className="text-xs text-muted-foreground">Queue Length</div>
                      <div className="text-2xl font-bold">{metrics.metrics?.queueLength || 0}</div>
                    </div>
                    <div className="border rounded-md p-3">
                      <div className="text-xs text-muted-foreground">Processing</div>
                      <div className="text-2xl font-bold">{metrics.metrics?.processingCount || 0}</div>
                    </div>
                    <div className="border rounded-md p-3">
                      <div className="text-xs text-muted-foreground">History</div>
                      <div className="text-2xl font-bold">{metrics.metrics?.historyCount || 0}</div>
                    </div>
                    <div className="border rounded-md p-3">
                      <div className="text-xs text-muted-foreground">Errors</div>
                      <div className="text-2xl font-bold">{metrics.metrics?.errorCount || 0}</div>
                    </div>
                  </div>
                </div>

                {metrics.redisInfo?.history && metrics.redisInfo.history.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">Recent Notifications</h3>
                    <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
                      <pre className="text-xs whitespace-pre-wrap">
                        {metrics.redisInfo.history.map((item: string, index: number) => {
                          try {
                            const parsed = JSON.parse(item);
                            return (
                              <div key={index} className="mb-2 pb-2 border-b last:border-0">
                                <div><strong>ID:</strong> {parsed.id}</div>
                                <div><strong>Type:</strong> {parsed.type}</div>
                                <div><strong>Processed:</strong> {new Date(parsed.processedAt).toLocaleString()}</div>
                                <div><strong>Users:</strong> {parsed.userIds?.length || 0}</div>
                              </div>
                            );
                          } catch (e) {
                            return <div key={index}>{String(item)}</div>;
                          }
                        })}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
