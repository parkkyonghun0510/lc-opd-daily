import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Wifi, WifiOff, AlertTriangle, Info } from 'lucide-react';

interface SSEDiagnosticInfo {
  isConnected: boolean;
  error: string | null;
  lastEvent: string | null;
  connectionAttempts: number;
  readyState: number;
  timestamp: string;
  browserSupport: boolean;
  endpoint: string;
}

export function ReportSSEDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<SSEDiagnosticInfo>({
    isConnected: false,
    error: null,
    lastEvent: null,
    connectionAttempts: 0,
    readyState: 0,
    timestamp: new Date().toISOString(),
    browserSupport: true,
    endpoint: '/api/reports/updates'
  });

  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  const testSSEConnection = async () => {
    setIsTesting(true);
    setTestResults([]);
    
    const results: string[] = [];
    
    // Test 1: Browser Support
    results.push(`Browser EventSource Support: ${typeof EventSource !== 'undefined' ? '✅ Supported' : '❌ Not Supported'}`);
    
    // Test 2: Endpoint Accessibility
    try {
      const response = await fetch('/api/reports/updates', {
        method: 'HEAD',
        credentials: 'include'
      });
      results.push(`Endpoint Response: ${response.status} ${response.statusText}`);
    } catch (error) {
      results.push(`Endpoint Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Test 3: Manual SSE Connection
    try {
      const eventSource = new EventSource('/api/reports/updates', {
        withCredentials: true
      });
      
      eventSource.onopen = () => {
        results.push('✅ SSE Connection: Successfully opened');
        setDiagnostics(prev => ({ ...prev, isConnected: true }));
        eventSource.close();
      };
      
      eventSource.onerror = (error) => {
        results.push(`❌ SSE Connection Error: ${error.type || 'Unknown error'}`);
        setDiagnostics(prev => ({ ...prev, isConnected: false, error: error.type || 'Connection failed' }));
        eventSource.close();
      };
      
      // Wait for 5 seconds for connection
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } catch (error) {
      results.push(`❌ SSE Setup Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    setTestResults(results);
    setIsTesting(false);
  };

  const getConnectionStatus = () => {
    if (diagnostics.isConnected) {
      return {
        icon: <Wifi className="h-4 w-4" />,
        color: "text-green-500",
        text: "Connected"
      };
    } else if (diagnostics.error) {
      return {
        icon: <AlertTriangle className="h-4 w-4" />,
        color: "text-red-500",
        text: "Connection Error"
      };
    } else {
      return {
        icon: <WifiOff className="h-4 w-4" />,
        color: "text-yellow-500",
        text: "Disconnected"
      };
    }
  };

  const status = getConnectionStatus();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Report SSE Connection Diagnostics
          </CardTitle>
          <CardDescription>
            Real-time diagnostics for report updates SSE connection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={diagnostics.isConnected ? "default" : "secondary"}>
                {status.icon}
                <span className="ml-1">{status.text}</span>
              </Badge>
            </div>
            <Button 
              onClick={testSSEConnection} 
              disabled={isTesting}
              size="sm"
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isTesting ? 'animate-spin' : ''}`} />
              {isTesting ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>

          {diagnostics.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Connection Error</AlertTitle>
              <AlertDescription>
                {diagnostics.error}
              </AlertDescription>
            </Alert>
          )}

          <div className="text-sm text-muted-foreground">
            <p><strong>Endpoint:</strong> {diagnostics.endpoint}</p>
            <p><strong>Last Updated:</strong> {new Date(diagnostics.timestamp).toLocaleString()}</p>
            <p><strong>Browser Support:</strong> {diagnostics.browserSupport ? '✅' : '❌'}</p>
          </div>
        </CardContent>
      </Card>

      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {testResults.map((result, index) => (
                <div key={index} className="text-sm font-mono">
                  {result}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}