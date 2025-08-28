"use client";

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Home, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  enableRecovery?: boolean;
  recoveryAttempts?: number;
  resetOnPropsChange?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  recoveryAttempt: number;
  lastErrorTime: number;
  isRecovering: boolean;
}

export class EnhancedErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      recoveryAttempt: 0,
      lastErrorTime: 0,
      isRecovering: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      lastErrorTime: Date.now(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('EnhancedErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call the error callback if provided
    this.props.onError?.(error, errorInfo);

    // Log error to monitoring service
    if (typeof window !== 'undefined') {
      try {
        // You can integrate with your error monitoring service here
        window.dispatchEvent(new CustomEvent('errorBoundary', {
          detail: {
            error: error.toString(),
            componentStack: errorInfo.componentStack,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
          }
        }));
      } catch (loggingError) {
        console.error('Failed to log error:', loggingError);
      }
    }
  }

  componentDidUpdate(prevProps: Props) {
    // Reset error boundary when props change (if enabled)
    if (this.props.resetOnPropsChange && 
        this.state.hasError && 
        prevProps.children !== this.props.children) {
      this.handleRecovery();
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  handleRecovery = () => {
    const { recoveryAttempts = 3 } = this.props;
    
    if (this.state.recoveryAttempt >= recoveryAttempts) {
      console.warn('Maximum recovery attempts reached');
      return;
    }

    this.setState({ isRecovering: true });

    // Add a small delay to prevent immediate re-rendering issues
    this.resetTimeoutId = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        recoveryAttempt: this.state.recoveryAttempt + 1,
        isRecovering: false,
      });
    }, 1000);
  };

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleNavigateHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard';
    }
  };

  renderError() {
    const { error, errorInfo, recoveryAttempt, isRecovering } = this.state;
    const { enableRecovery = true, recoveryAttempts = 3 } = this.props;
    
    const canRecover = enableRecovery && recoveryAttempt < recoveryAttempts;
    const errorMessage = error?.message || 'An unexpected error occurred';
    const isNetworkError = errorMessage.toLowerCase().includes('network') || 
                          errorMessage.toLowerCase().includes('fetch');

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-red-600">
              Oops! Something went wrong
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Error Type Alert */}
            <Alert variant={isNetworkError ? "default" : "destructive"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                {isNetworkError ? 'Connection Problem' : 'Application Error'}
              </AlertTitle>
              <AlertDescription>
                {isNetworkError 
                  ? 'There seems to be a network connectivity issue. Please check your internet connection.'
                  : 'The application encountered an unexpected error and needs to recover.'
                }
              </AlertDescription>
            </Alert>

            {/* Error Details */}
            <div className="bg-gray-100 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Error Details:</h3>
              <p className="text-sm text-gray-700 font-mono bg-white p-2 rounded border">
                {errorMessage}
              </p>
              {recoveryAttempt > 0 && (
                <p className="text-sm text-gray-600 mt-2">
                  Recovery attempts: {recoveryAttempt} of {recoveryAttempts}
                </p>
              )}
            </div>

            {/* Recovery Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              {canRecover && (
                <Button 
                  onClick={this.handleRecovery}
                  disabled={isRecovering}
                  className="flex items-center justify-center"
                >
                  {isRecovering ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Recovering...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Try Again
                    </>
                  )}
                </Button>
              )}
              
              <Button 
                variant="outline" 
                onClick={this.handleReload}
                className="flex items-center justify-center"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reload Page
              </Button>
              
              <Button 
                variant="outline" 
                onClick={this.handleNavigateHome}
                className="flex items-center justify-center"
              >
                <Home className="w-4 h-4 mr-2" />
                Go to Dashboard
              </Button>
            </div>

            {/* Help and Support */}
            <div className="border-t pt-4">
              <h3 className="font-medium text-gray-900 mb-2">Need Help?</h3>
              <div className="text-sm text-gray-600 space-y-2">
                <p>• Try refreshing the page or clearing your browser cache</p>
                <p>• Check your internet connection</p>
                <p>• If the problem persists, contact your system administrator</p>
              </div>
              
              <Button 
                variant="ghost" 
                size="sm"
                className="mt-3"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.open('mailto:support@example.com?subject=Error Report&body=' + 
                      encodeURIComponent(`Error: ${errorMessage}\nTime: ${new Date().toISOString()}\nURL: ${window.location.href}`));
                  }
                }}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Report This Error
              </Button>
            </div>

            {/* Development Info (only in development) */}
            {process.env.NODE_ENV === 'development' && errorInfo && (
              <details className="border rounded p-3 bg-yellow-50">
                <summary className="cursor-pointer font-medium text-yellow-800">
                  Development Details (Click to expand)
                </summary>
                <pre className="mt-2 text-xs text-yellow-700 overflow-auto">
                  {errorInfo.componentStack}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  render() {
    if (this.state.hasError) {
      // Return custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Return default error UI
      return this.renderError();
    }

    return this.props.children;
  }
}

// Hook for using error boundary in functional components
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { captureError, resetError };
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <EnhancedErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </EnhancedErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

export default EnhancedErrorBoundary;