"use client";

import React, { Component, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, RefreshCw, Home, Bug } from 'lucide-react';
import { handleError, createErrorBoundaryHandler } from '@/lib/errors/error-handler';
import { AppError, ErrorSeverity } from '@/types/errors';
import { cn } from '@/lib/utils';

// Error boundary state interface
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string;
  retryCount: number;
  canRetry: boolean;
}

// Error boundary props
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showDetails?: boolean;
  maxRetries?: number;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
  className?: string;
}

// Main error boundary component
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null;
  private previousResetKeys: Array<string | number> = [];

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0,
      canRetry: true
    };
    this.previousResetKeys = props.resetKeys || [];
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    
    // Handle error using centralized error handler
    const errorHandler = createErrorBoundaryHandler('ErrorBoundary');
    errorHandler(error, errorInfo);
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys } = this.props;
    const { hasError } = this.state;
    
    // Reset error boundary if resetKeys changed
    if (hasError && resetKeys && prevProps.resetKeys !== resetKeys) {
      const hasResetKeyChanged = resetKeys.some(
        (key, index) => this.previousResetKeys[index] !== key
      );
      
      if (hasResetKeyChanged) {
        this.previousResetKeys = resetKeys;
        this.resetErrorBoundary();
      }
    }
  }

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0,
      canRetry: true
    });
  };

  handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;
    
    if (retryCount < maxRetries) {
      this.setState({
        retryCount: retryCount + 1,
        canRetry: retryCount + 1 < maxRetries
      });
      
      // Reset after a short delay
      this.resetTimeoutId = window.setTimeout(() => {
        this.resetErrorBoundary();
      }, 100);
    }
  };

  render() {
    const { hasError, error, errorInfo, retryCount, canRetry } = this.state;
    const { children, fallback, showDetails = false, maxRetries = 3, className } = this.props;
    
    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }
      
      // Default error UI
      return (
        <div className={cn('min-h-[400px] flex items-center justify-center p-4', className)}>
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto h-12 w-12 text-destructive mb-4">
                <AlertCircle className="h-full w-full" />
              </div>
              <CardTitle className="text-xl">Something went wrong</CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Details</AlertTitle>
                <AlertDescription>
                  {error.message || 'An unexpected error occurred'}
                </AlertDescription>
              </Alert>
              
              {showDetails && errorInfo && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Technical Details</h4>
                    <div className="bg-muted p-3 rounded-md text-xs font-mono overflow-auto max-h-32">
                      <div className="text-destructive font-semibold mb-2">
                        {error.name}: {error.message}
                      </div>
                      {error.stack && (
                        <pre className="whitespace-pre-wrap text-muted-foreground">
                          {error.stack}
                        </pre>
                      )}
                    </div>
                  </div>
                </>
              )}
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {retryCount > 0 && (
                    <span>Retry attempt: {retryCount}/{maxRetries}</span>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  {canRetry && (
                    <Button onClick={this.handleRetry} variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Try Again
                    </Button>
                  )}
                  
                  <Button 
                    onClick={() => window.location.href = '/'} 
                    variant="default" 
                    size="sm"
                  >
                    <Home className="h-4 w-4 mr-2" />
                    Go Home
                  </Button>
                  
                  {showDetails && (
                    <Button 
                      onClick={() => {
                        const errorReport = {
                          error: error.message,
                          stack: error.stack,
                          componentStack: errorInfo?.componentStack,
                          timestamp: new Date().toISOString()
                        };
                        console.error('Error Report:', errorReport);
                        navigator.clipboard?.writeText(JSON.stringify(errorReport, null, 2));
                      }}
                      variant="ghost" 
                      size="sm"
                    >
                      <Bug className="h-4 w-4 mr-2" />
                      Copy Error
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    
    return children;
  }
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

// Hook for error boundary context
export function useErrorHandler() {
  const throwError = React.useCallback((error: Error) => {
    throw error;
  }, []);
  
  return { throwError };
}

// Simplified error fallback components
export const SimpleErrorFallback: React.FC<{ error?: Error; onRetry?: () => void }> = ({ 
  error, 
  onRetry 
}) => (
  <Alert variant="destructive" className="m-4">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Error</AlertTitle>
    <AlertDescription className="flex items-center justify-between">
      <span>{error?.message || 'Something went wrong'}</span>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="ml-4">
          Retry
        </Button>
      )}
    </AlertDescription>
  </Alert>
);

export const MinimalErrorFallback: React.FC<{ error?: Error }> = ({ error }) => (
  <div className="text-center p-8 text-muted-foreground">
    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
    <p>{error?.message || 'Something went wrong'}</p>
  </div>
);

// Export error boundary as default
export default ErrorBoundary;