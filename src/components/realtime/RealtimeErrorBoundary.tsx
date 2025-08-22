'use client';

import React from 'react';
import { AlertCircle, Wifi, WifiOff, RefreshCw, Settings } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import toast from 'react-hot-toast';

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<RealtimeErrorFallbackProps>;
  onConnectionRetry?: () => void;
  onForcePolling?: () => void;
  onForceSSE?: () => void;
  connectionMethod?: 'sse' | 'polling';
  isConnected?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
}

export interface RealtimeErrorFallbackProps {
  error: Error;
  errorInfo: React.ErrorInfo;
  resetError: () => void;
  retryConnection: () => void;
  forcePolling: () => void;
  forceSSE: () => void;
  connectionMethod?: 'sse' | 'polling';
  isConnected?: boolean;
  retryCount: number;
}

class RealtimeErrorBoundary extends React.Component<Props, State> {
  private retryTimeout: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('RealtimeErrorBoundary caught an error:', error, errorInfo);
    
    // Log realtime-specific error details
    if (this.isRealtimeError(error)) {
      console.error('Realtime connection error details:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        connectionMethod: this.props.connectionMethod,
        isConnected: this.props.isConnected
      });
      
      // Show appropriate toast notification
      if (this.isConnectionError(error)) {
        toast.error('Real-time connection lost. Attempting to reconnect...');
      } else {
        toast.error('Real-time communication error occurred.');
      }
    }
    
    this.setState({ errorInfo });
    
    // Auto-retry for connection errors
    if (this.isConnectionError(error) && this.state.retryCount < 3) {
      this.scheduleRetry();
    }
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  private isRealtimeError = (error: Error): boolean => {
    const realtimeErrorKeywords = [
      'sse',
      'eventsource',
      'realtime',
      'connection',
      'polling',
      'websocket',
      'stream'
    ];
    
    return realtimeErrorKeywords.some(keyword => 
      error.message.toLowerCase().includes(keyword) ||
      error.name.toLowerCase().includes(keyword)
    );
  };

  private isConnectionError = (error: Error): boolean => {
    const connectionErrorKeywords = [
      'connection',
      'network',
      'timeout',
      'failed to fetch',
      'eventsource',
      'sse'
    ];
    
    return connectionErrorKeywords.some(keyword => 
      error.message.toLowerCase().includes(keyword)
    );
  };

  private scheduleRetry = () => {
    const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000); // Exponential backoff, max 10s
    
    this.retryTimeout = setTimeout(() => {
      this.setState(prevState => ({
        retryCount: prevState.retryCount + 1
      }));
      this.retryConnection();
    }, delay);
  };

  private resetError = () => {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    });
  };

  private retryConnection = () => {
    this.resetError();
    if (this.props.onConnectionRetry) {
      this.props.onConnectionRetry();
    }
  };

  private forcePolling = () => {
    this.resetError();
    if (this.props.onForcePolling) {
      this.props.onForcePolling();
    }
    toast.success('Switched to polling mode');
  };

  private forceSSE = () => {
    this.resetError();
    if (this.props.onForceSSE) {
      this.props.onForceSSE();
    }
    toast.success('Attempting SSE connection');
  };

  render() {
    if (this.state.hasError && this.state.error && this.state.errorInfo) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={this.state.error}
            errorInfo={this.state.errorInfo}
            resetError={this.resetError}
            retryConnection={this.retryConnection}
            forcePolling={this.forcePolling}
            forceSSE={this.forceSSE}
            connectionMethod={this.props.connectionMethod}
            isConnected={this.props.isConnected}
            retryCount={this.state.retryCount}
          />
        );
      }

      // Default fallback UI
      return (
        <div className="p-4">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="flex items-center gap-2">
              Real-time Connection Error
              <Badge variant="outline" className="ml-2">
                {this.props.connectionMethod === 'sse' ? (
                  <><Wifi className="h-3 w-3 mr-1" />SSE</>
                ) : (
                  <><WifiOff className="h-3 w-3 mr-1" />Polling</>
                )}
              </Badge>
            </AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-4">
                {this.isConnectionError(this.state.error)
                  ? 'Lost connection to real-time updates. Some features may not work properly.'
                  : this.state.error.message || 'An unexpected real-time error occurred.'}
              </p>
              
              {this.state.retryCount > 0 && (
                <p className="text-sm text-muted-foreground mb-4">
                  Retry attempt: {this.state.retryCount}/3
                </p>
              )}
              
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={this.retryConnection}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry Connection
                </Button>
                
                {this.props.connectionMethod === 'sse' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={this.forcePolling}
                    className="flex items-center gap-2"
                  >
                    <WifiOff className="h-4 w-4" />
                    Use Polling
                  </Button>
                )}
                
                {this.props.connectionMethod === 'polling' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={this.forceSSE}
                    className="flex items-center gap-2"
                  >
                    <Wifi className="h-4 w-4" />
                    Try SSE
                  </Button>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={this.resetError}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Dismiss
                </Button>
              </div>
            </AlertDescription>
          </Alert>
          
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4 p-4 bg-muted rounded-lg">
              <summary className="cursor-pointer font-medium mb-2">
                Error Details (Development)
              </summary>
              <div className="text-xs space-y-2">
                <div>
                  <strong>Connection Method:</strong> {this.props.connectionMethod || 'unknown'}
                </div>
                <div>
                  <strong>Is Connected:</strong> {this.props.isConnected ? 'Yes' : 'No'}
                </div>
                <div>
                  <strong>Retry Count:</strong> {this.state.retryCount}
                </div>
                <pre className="overflow-auto whitespace-pre-wrap">
                  {this.state.error.stack}
                </pre>
                <pre className="overflow-auto whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </pre>
              </div>
            </details>
          )}
          
          {/* Render children with error state */}
          <div className="opacity-50 pointer-events-none">
            {this.props.children}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Default fallback component
export const DefaultRealtimeErrorFallback: React.FC<RealtimeErrorFallbackProps> = ({
  error,
  resetError,
  retryConnection,
  forcePolling,
  forceSSE,
  connectionMethod,
  isConnected,
  retryCount
}) => {
  return (
    <Alert variant="destructive" className="m-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Real-time Connection Error</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-4">{error.message}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={retryConnection}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
          {connectionMethod === 'sse' && (
            <Button variant="secondary" size="sm" onClick={forcePolling}>
              <WifiOff className="h-4 w-4 mr-2" />
              Use Polling
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={resetError}>
            Dismiss
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default RealtimeErrorBoundary;