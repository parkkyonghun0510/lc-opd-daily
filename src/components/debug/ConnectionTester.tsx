import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

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

interface ConnectionTesterProps {
  onTestComplete: (results: string[]) => void;
  onDiagnosticsUpdate: (diagnostics: Partial<SSEDiagnosticInfo>) => void;
}

export function ConnectionTester({ onTestComplete, onDiagnosticsUpdate }: ConnectionTesterProps) {
  const [isTesting, setIsTesting] = useState(false);

  const testSSEConnection = async () => {
    setIsTesting(true);
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
        onDiagnosticsUpdate({ isConnected: true });
        eventSource.close();
      };
      
      eventSource.onerror = (error) => {
        results.push(`❌ SSE Connection Error: ${error.type || 'Unknown error'}`);
        onDiagnosticsUpdate({ isConnected: false, error: error.type || 'Connection failed' });
        eventSource.close();
      };
      
      // Wait for 5 seconds for connection
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } catch (error) {
      results.push(`❌ SSE Setup Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    onTestComplete(results);
    setIsTesting(false);
  };

  return (
    <Button 
      onClick={testSSEConnection} 
      disabled={isTesting}
      size="sm"
      variant="outline"
    >
      <RefreshCw className={`h-4 w-4 mr-1 ${isTesting ? 'animate-spin' : ''}`} />
      {isTesting ? 'Testing...' : 'Test Connection'}
    </Button>
  );
}