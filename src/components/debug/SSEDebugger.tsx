'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useHybridRealtimeV2 } from '@/hooks/useHybridRealtimeV2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SSEDebuggerProps {
  endpoint?: string;
  userId?: string;
  token?: string;
}

interface LogEntry {
  id: string;
  timestamp: number;
  type: 'info' | 'error' | 'warning' | 'success';
  category: 'connection' | 'event' | 'error' | 'health' | 'test';
  message: string;
  data?: any;
}

interface TestEvent {
  type: string;
  data: any;
  target?: 'broadcast' | 'user' | 'role';
  targetValue?: string;
}

interface HealthData {
  status: string;
  timestamp: string;
  uptime: number;
  connections: {
    total: number;
    users: number;
  };
  errorRate: number;
  responseTime: number;
}

export default function SSEDebugger({ 
  endpoint = '/api/sse', 
  userId: propUserId, 
  token: propToken 
}: SSEDebuggerProps) {
  const { user, isAuthenticated } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStats, setConnectionStats] = useState<any>(null);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [testEvent, setTestEvent] = useState<TestEvent>({
    type: 'test',
    data: { message: 'Test message' },
    target: 'user'
  });
  const [customEndpoint, setCustomEndpoint] = useState(endpoint);
  const [autoRefreshHealth, setAutoRefreshHealth] = useState(false);
  
  const logRef = useRef<HTMLDivElement>(null);
  const healthIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Add log entry
  const addLog = useCallback((type: LogEntry['type'], category: LogEntry['category'], message: string, data?: any) => {
    const logEntry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type,
      category,
      message,
      data
    };
    
    setLogs(prev => [logEntry, ...prev.slice(0, 499)]); // Keep last 500 logs
    
    // Auto-scroll to bottom
    setTimeout(() => {
      if (logRef.current) {
        logRef.current.scrollTop = 0;
      }
    }, 100);
  }, []);
  
  // SSE connection using improved hybrid hook
  const sseConnection = useHybridRealtimeV2({
    sseEndpoint: customEndpoint,
    pollingEndpoint: '/api/realtime/polling',
    debug: true,
    enableTokenAuth: true,
    eventHandlers: {
      '*': (event) => {
        addLog('info', 'event', `Received event: ${event.type}`, event);
      },
      connected: (data) => {
        addLog('success', 'connection', 'SSE connected successfully', data);
        setConnectionStats(data);
      },
      disconnected: (data) => {
        addLog('warning', 'connection', 'SSE disconnected', data);
      },
      ping: (data) => {
        addLog('info', 'health', 'Ping received', data);
      },
      error: (data) => {
        addLog('error', 'error', 'SSE error occurred', data);
      }
    },
    onError: (error) => {
      addLog('error', 'connection', `Connection error: ${error.message}`, error);
    },
    onConnect: () => {
      addLog('success', 'connection', 'Connection established');
      setIsConnecting(false);
    }
  });
  
  // Connect/disconnect handlers
  const handleConnect = useCallback(() => {
    if (!isAuthenticated) {
      addLog('error', 'connection', 'Not authenticated');
      return;
    }
    
    addLog('info', 'connection', `Connecting to ${customEndpoint}...`);
    setIsConnecting(true);
    sseConnection.reconnect();
  }, [isAuthenticated, customEndpoint, sseConnection, addLog]);
  
  const handleDisconnect = useCallback(() => {
    addLog('info', 'connection', 'Disconnecting...');
    sseConnection.disconnect();
    setIsConnecting(false);
  }, [sseConnection, addLog]);
  
  // Send test event
  const sendTestEvent = useCallback(async () => {
    try {
      addLog('info', 'test', `Sending test event: ${testEvent.type}`);
      
      const response = await fetch('/api/realtime/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: testEvent.type,
          message: testEvent.data.message || 'Test message',
          data: testEvent.data,
          target: testEvent.target === 'broadcast' ? 'sse' : undefined
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        addLog('success', 'test', 'Test event sent successfully', result);
      } else {
        const error = await response.json();
        addLog('error', 'test', `Failed to send test event: ${error.message}`, error);
      }
    } catch (error) {
      addLog('error', 'test', `Test event error: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    }
  }, [testEvent, addLog]);
  
  // Fetch health data
  const fetchHealthData = useCallback(async () => {
    try {
      const response = await fetch('/api/sse/health?details=true');
      if (response.ok) {
        const health = await response.json();
        setHealthData(health);
        addLog('info', 'health', `Health check: ${health.status}`);
      } else {
        addLog('error', 'health', `Health check failed: ${response.status}`);
      }
    } catch (error) {
      addLog('error', 'health', `Health check error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [addLog]);
  
  // Auto refresh health data
  useEffect(() => {
    if (autoRefreshHealth) {
      healthIntervalRef.current = setInterval(fetchHealthData, 5000);
    } else {
      if (healthIntervalRef.current) {
        clearInterval(healthIntervalRef.current);
        healthIntervalRef.current = null;
      }
    }
    
    return () => {
      if (healthIntervalRef.current) {
        clearInterval(healthIntervalRef.current);
      }
    };
  }, [autoRefreshHealth, fetchHealthData]);
  
  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
    addLog('info', 'test', 'Logs cleared');
  }, [addLog]);
  
  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };
  
  // Get status color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'connected':
      case 'healthy':
        return 'bg-green-500';
      case 'connecting':
      case 'degraded':
        return 'bg-yellow-500';
      case 'disconnected':
      case 'unhealthy':
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };
  
  // Get log type color
  const getLogTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      case 'info':
      default:
        return 'text-blue-600';
    }
  };
  
  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SSE Debugger</CardTitle>
          <CardDescription>Authentication required to use the SSE debugger</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Please log in to access the SSE debugging tools.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            SSE Connection Status
            <div className={`w-3 h-3 rounded-full ${getStatusColor(sseConnection.connectionStatus)}`} />
          </CardTitle>
          <CardDescription>
            Current connection: {sseConnection.activeMethod} - {sseConnection.connectionStatus}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant={sseConnection.isConnected ? 'default' : 'secondary'}>
              {sseConnection.isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
            <Badge variant="outline">
              Method: {sseConnection.activeMethod}
            </Badge>
            <Badge variant="outline">
              SSE Failures: {sseConnection.sseFailureCount}
            </Badge>
            <Badge variant="outline">
              Polling Failures: {sseConnection.pollingFailureCount}
            </Badge>
            {sseConnection.hasToken && (
              <Badge variant="outline">
                Token: Valid
              </Badge>
            )}
          </div>
          
          <div className="flex gap-2 mb-4">
            <Input
              value={customEndpoint}
              onChange={(e) => setCustomEndpoint(e.target.value)}
              placeholder="SSE Endpoint"
              className="flex-1"
            />
            <Button 
              onClick={handleConnect} 
              disabled={isConnecting || sseConnection.isConnected}
              variant="default"
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </Button>
            <Button 
              onClick={handleDisconnect} 
              disabled={!sseConnection.isConnected}
              variant="outline"
            >
              Disconnect
            </Button>
          </div>
          
          {sseConnection.error && (
            <Alert>
              <AlertDescription>
                <strong>Error:</strong> {sseConnection.error}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      
      {/* Tabbed Interface */}
      <Tabs defaultValue="events" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>
        
        {/* Events Tab */}
        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
              <CardDescription>
                Events received from the SSE connection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64 w-full border rounded-md p-4">
                {sseConnection.lastEvent ? (
                  <div className="space-y-2">
                    <div className="text-sm">
                      <strong>Last Event:</strong> {sseConnection.lastEvent.type}
                    </div>
                    <div className="text-sm text-gray-600">
                      <strong>Time:</strong> {formatTime(sseConnection.lastEvent.timestamp)}
                    </div>
                    <div className="text-sm">
                      <strong>Data:</strong>
                      <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto">
                        {JSON.stringify(sseConnection.lastEvent.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500">No events received yet</div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Testing Tab */}
        <TabsContent value="testing">
          <Card>
            <CardHeader>
              <CardTitle>Event Testing</CardTitle>
              <CardDescription>
                Send test events to the SSE system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Event Type</label>
                <Input
                  value={testEvent.type}
                  onChange={(e) => setTestEvent(prev => ({ ...prev, type: e.target.value }))}
                  placeholder="Event type (e.g., notification, test)"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Event Data (JSON)</label>
                <textarea
                  className="w-full p-2 border rounded-md h-24 font-mono text-sm"
                  value={JSON.stringify(testEvent.data, null, 2)}
                  onChange={(e) => {
                    try {
                      const data = JSON.parse(e.target.value);
                      setTestEvent(prev => ({ ...prev, data }));
                    } catch (error) {
                      // Invalid JSON, ignore
                    }
                  }}
                  placeholder='{ "message": "Test message" }'
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Target</label>
                <select
                  className="w-full p-2 border rounded-md"
                  value={testEvent.target}
                  onChange={(e) => setTestEvent(prev => ({ ...prev, target: e.target.value as any }))}
                >
                  <option value="broadcast">Broadcast to all</option>
                  <option value="user">Specific user</option>
                  <option value="role">Specific role</option>
                </select>
              </div>
              
              {testEvent.target !== 'broadcast' && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {testEvent.target === 'user' ? 'User ID' : 'Role'}
                  </label>
                  <Input
                    value={testEvent.targetValue || ''}
                    onChange={(e) => setTestEvent(prev => ({ ...prev, targetValue: e.target.value }))}
                    placeholder={testEvent.target === 'user' ? 'Enter user ID' : 'Enter role'}
                  />
                </div>
              )}
              
              <Button onClick={sendTestEvent} className="w-full">
                Send Test Event
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Health Tab */}
        <TabsContent value="health">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                System Health
                <Button
                  onClick={fetchHealthData}
                  variant="outline"
                  size="sm"
                >
                  Refresh
                </Button>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={autoRefreshHealth}
                    onChange={(e) => setAutoRefreshHealth(e.target.checked)}
                  />
                  Auto-refresh
                </label>
              </CardTitle>
              <CardDescription>
                Overall system health and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {healthData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{healthData.status}</div>
                      <div className="text-sm text-gray-600">Status</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{healthData.connections.total}</div>
                      <div className="text-sm text-gray-600">Connections</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{healthData.errorRate}%</div>
                      <div className="text-sm text-gray-600">Error Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{Math.round(healthData.uptime / 1000)}s</div>
                      <div className="text-sm text-gray-600">Uptime</div>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    Last updated: {new Date(healthData.timestamp).toLocaleString()}
                  </div>
                </div>
              ) : (
                <div className="text-gray-500">Click Refresh to load health data</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Debug Logs
                <Button onClick={clearLogs} variant="outline" size="sm">
                  Clear Logs
                </Button>
              </CardTitle>
              <CardDescription>
                Detailed debug information and events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96 w-full border rounded-md p-4" ref={logRef}>
                {logs.length > 0 ? (
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div key={log.id} className="text-sm border-b pb-2">
                        <div className="flex items-center justify-between">
                          <span className={`font-medium ${getLogTypeColor(log.type)}`}>
                            [{log.category.toUpperCase()}] {log.message}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTime(log.timestamp)}
                          </span>
                        </div>
                        {log.data && (
                          <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500">No logs yet</div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
