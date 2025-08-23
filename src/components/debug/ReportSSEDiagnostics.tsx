import { useState, useEffect, lazy, Suspense } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Wifi, WifiOff, AlertTriangle, Info } from 'lucide-react';

// Lazy load heavy diagnostic components
const LazyDiagnosticResults = lazy(() => import('./DiagnosticResults').then(module => ({ default: module.DiagnosticResults })));
const LazyConnectionTester = lazy(() => import('./ConnectionTester').then(module => ({ default: module.ConnectionTester })));

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

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  const handleTestComplete = (results: string[]) => {
    setTestResults(results);
  };

  const handleDiagnosticsUpdate = (updates: Partial<SSEDiagnosticInfo>) => {
    setDiagnostics(prev => ({ ...prev, ...updates, timestamp: new Date().toISOString() }));
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
            <Suspense fallback={<Button size="sm" variant="outline" disabled>Loading...</Button>}>
              <LazyConnectionTester 
                onTestComplete={handleTestComplete}
                onDiagnosticsUpdate={handleDiagnosticsUpdate}
              />
            </Suspense>
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

      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading results...</div>}>
        <LazyDiagnosticResults testResults={testResults} />
      </Suspense>
    </div>
  );
}