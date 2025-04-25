'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, AlertCircle, Users, Activity, Server, Zap } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

export default function RealtimeMonitoringDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  // Fetch monitoring data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/realtime/monitor');
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setData(data);
    } catch (err) {
      console.error('Error fetching monitoring data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      
      toast({
        title: 'Error',
        description: 'Failed to fetch monitoring data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, []);
  
  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);
  
  // Format timestamp
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };
  
  // Handle auto-refresh toggle
  const toggleAutoRefresh = () => {
    setAutoRefresh(prev => !prev);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Real-time Monitoring Dashboard</h2>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </>
            )}
          </Button>
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={toggleAutoRefresh}
          >
            {autoRefresh ? 'Auto-Refresh: On' : 'Auto-Refresh: Off'}
          </Button>
        </div>
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {data ? (
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="instances">Instances</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold flex items-center">
                    <Users className="w-4 h-4 mr-2 text-muted-foreground" />
                    {data.metrics.connections.active}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Peak: {data.metrics.connections.peak}
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Events Sent</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold flex items-center">
                    <Activity className="w-4 h-4 mr-2 text-muted-foreground" />
                    {data.metrics.events.sent}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Errors: {data.metrics.events.errors}
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold flex items-center">
                    <Users className="w-4 h-4 mr-2 text-muted-foreground" />
                    {data.sseStats.uniqueUsers}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total Connections: {data.sseStats.totalConnections}
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold flex items-center">
                    <Zap className="w-4 h-4 mr-2 text-muted-foreground" />
                    {data.metrics.performance.avgLatency.toFixed(2)} ms
                  </div>
                  <p className="text-xs text-muted-foreground">
                    P95: {data.metrics.performance.p95Latency.toFixed(2)} ms
                  </p>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
                <CardDescription>
                  Current status of the real-time system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Connection Status</span>
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      Operational
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Event Processing</span>
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      Operational
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Redis Connectivity</span>
                    <Badge variant="outline" className={data.metrics.redisAvailable ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}>
                      {data.metrics.redisAvailable ? "Connected" : "Fallback Mode"}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Active Instances</span>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      {Object.keys(data.allInstancesMetrics).length || 1}
                    </Badge>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="text-xs text-muted-foreground">
                Last updated: {formatTime(data.timestamp)}
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="connections" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Connection Statistics</CardTitle>
                <CardDescription>
                  Details about active connections
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-md p-4">
                      <div className="text-sm font-medium text-muted-foreground mb-2">Total Connections</div>
                      <div className="text-2xl font-bold">{data.metrics.connections.total}</div>
                    </div>
                    <div className="border rounded-md p-4">
                      <div className="text-sm font-medium text-muted-foreground mb-2">Active Connections</div>
                      <div className="text-2xl font-bold">{data.metrics.connections.active}</div>
                    </div>
                    <div className="border rounded-md p-4">
                      <div className="text-sm font-medium text-muted-foreground mb-2">Peak Connections</div>
                      <div className="text-2xl font-bold">{data.metrics.connections.peak}</div>
                    </div>
                  </div>
                  
                  <div className="border rounded-md p-4">
                    <div className="text-sm font-medium mb-2">User Distribution</div>
                    <div className="space-y-2">
                      {Object.entries(data.sseStats.userCounts).map(([userId, count]: [string, number]) => (
                        <div key={userId} className="flex justify-between items-center">
                          <span className="text-sm">{userId}</span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="events" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Event Statistics</CardTitle>
                <CardDescription>
                  Details about event processing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-md p-4">
                      <div className="text-sm font-medium text-muted-foreground mb-2">Events Sent</div>
                      <div className="text-2xl font-bold">{data.metrics.events.sent}</div>
                    </div>
                    <div className="border rounded-md p-4">
                      <div className="text-sm font-medium text-muted-foreground mb-2">Events Received</div>
                      <div className="text-2xl font-bold">{data.metrics.events.received}</div>
                    </div>
                    <div className="border rounded-md p-4">
                      <div className="text-sm font-medium text-muted-foreground mb-2">Event Errors</div>
                      <div className="text-2xl font-bold">{data.metrics.events.errors}</div>
                    </div>
                  </div>
                  
                  <div className="border rounded-md p-4">
                    <div className="text-sm font-medium mb-2">Error Breakdown</div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Connection Errors</span>
                        <Badge variant="outline" className={data.metrics.errors.connection > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}>
                          {data.metrics.errors.connection}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Message Errors</span>
                        <Badge variant="outline" className={data.metrics.errors.message > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}>
                          {data.metrics.errors.message}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Other Errors</span>
                        <Badge variant="outline" className={data.metrics.errors.other > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}>
                          {data.metrics.errors.other}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>
                  Performance statistics for real-time communication
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-md p-4">
                      <div className="text-sm font-medium text-muted-foreground mb-2">Average Latency</div>
                      <div className="text-2xl font-bold">{data.metrics.performance.avgLatency.toFixed(2)} ms</div>
                    </div>
                    <div className="border rounded-md p-4">
                      <div className="text-sm font-medium text-muted-foreground mb-2">95th Percentile</div>
                      <div className="text-2xl font-bold">{data.metrics.performance.p95Latency.toFixed(2)} ms</div>
                    </div>
                    <div className="border rounded-md p-4">
                      <div className="text-sm font-medium text-muted-foreground mb-2">99th Percentile</div>
                      <div className="text-2xl font-bold">{data.metrics.performance.p99Latency.toFixed(2)} ms</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="instances" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Instance Information</CardTitle>
                <CardDescription>
                  Details about server instances
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(data.allInstancesMetrics).length > 0 ? (
                    Object.entries(data.allInstancesMetrics).map(([instanceId, metrics]: [string, any]) => (
                      <div key={instanceId} className="border rounded-md p-4">
                        <div className="flex items-center mb-2">
                          <Server className="w-4 h-4 mr-2" />
                          <div className="text-sm font-medium">{instanceId}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>Active Connections: <span className="font-medium">{metrics.connections.active}</span></div>
                          <div>Events Sent: <span className="font-medium">{metrics.events.sent}</span></div>
                          <div>Avg Latency: <span className="font-medium">{metrics.performance.avgLatency.toFixed(2)} ms</span></div>
                          <div>Errors: <span className="font-medium">{metrics.events.errors}</span></div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      No instance data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : loading ? (
        <div className="flex justify-center items-center h-40">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Data</AlertTitle>
          <AlertDescription>
            No monitoring data is available. Try refreshing the page.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
