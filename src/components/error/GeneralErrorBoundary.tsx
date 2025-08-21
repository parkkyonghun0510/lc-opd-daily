'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showErrorDetails?: boolean;
  enableRetry?: boolean;
  enableNavigation?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string;
}

export interface ErrorFallbackProps {
  error: Error;
  errorInfo: React.ErrorInfo;
  errorId: string;
  resetError: () => void;
  goHome: () => void;
  reportError: () => void;
}

class GeneralErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('GeneralErrorBoundary caught an error:', error, errorInfo);
    
    // Generate error report
    const errorReport = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown'
    };
    
    console.error('Error Report:', errorReport);
    
    this.setState({ errorInfo });
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // Show toast notification
    toast.error('An unexpected error occurred. Please try refreshing the page.');
    
    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      this.reportErrorToService(errorReport);
    }
  }

  private reportErrorToService = async (errorReport: any) => {
    try {
      // Replace with your actual error reporting service
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorReport)
      // });
      console.log('Error would be reported to service:', errorReport);
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  private resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    });
  };

  private goHome = () => {
    this.resetError();
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  private reportError = () => {
    if (this.state.error && this.state.errorInfo) {
      const errorReport = {
        errorId: this.state.errorId,
        message: this.state.error.message,
        stack: this.state.error.stack,
        componentStack: this.state.errorInfo.componentStack,
        timestamp: new Date().toISOString()
      };
      
      // Copy error details to clipboard
      if (typeof window !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2))
          .then(() => {
            toast.success('Error details copied to clipboard');
          })
          .catch(() => {
            toast.error('Failed to copy error details');
          });
      }
      
      // You could also open a bug report form or email client
      console.log('Error report for user:', errorReport);
    }
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
            errorId={this.state.errorId}
            resetError={this.resetError}
            goHome={this.goHome}
            reportError={this.reportError}
          />
        );
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-destructive" />
                <div>
                  <CardTitle className="text-xl">Something went wrong</CardTitle>
                  <CardDescription>
                    An unexpected error occurred. We apologize for the inconvenience.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <Alert>
                <Bug className="h-4 w-4" />
                <AlertTitle>Error ID: {this.state.errorId}</AlertTitle>
                <AlertDescription>
                  {this.state.error.message || 'An unknown error occurred'}
                </AlertDescription>
              </Alert>
              
              <div className="flex flex-wrap gap-3">
                {this.props.enableRetry !== false && (
                  <Button
                    onClick={this.resetError}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try Again
                  </Button>
                )}
                
                {this.props.enableNavigation !== false && (
                  <Button
                    variant="outline"
                    onClick={this.goHome}
                    className="flex items-center gap-2"
                  >
                    <Home className="h-4 w-4" />
                    Go Home
                  </Button>
                )}
                
                <Button
                  variant="secondary"
                  onClick={this.reportError}
                  className="flex items-center gap-2"
                >
                  <Bug className="h-4 w-4" />
                  Report Issue
                </Button>
              </div>
              
              {(this.props.showErrorDetails || process.env.NODE_ENV === 'development') && (
                <details className="mt-6">
                  <summary className="cursor-pointer font-medium mb-3 text-sm text-muted-foreground">
                    Technical Details {process.env.NODE_ENV === 'development' && '(Development Mode)'}
                  </summary>
                  
                  <div className="space-y-4 text-xs">
                    <div className="p-3 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2">Error Information</h4>
                      <div className="space-y-1">
                        <div><strong>Type:</strong> {this.state.error.name}</div>
                        <div><strong>Message:</strong> {this.state.error.message}</div>
                        <div><strong>Timestamp:</strong> {new Date().toLocaleString()}</div>
                        <div><strong>Error ID:</strong> {this.state.errorId}</div>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2">Stack Trace</h4>
                      <pre className="overflow-auto whitespace-pre-wrap text-xs">
                        {this.state.error.stack}
                      </pre>
                    </div>
                    
                    <div className="p-3 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2">Component Stack</h4>
                      <pre className="overflow-auto whitespace-pre-wrap text-xs">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  </div>
                </details>
              )}
              
              <div className="text-xs text-muted-foreground pt-4 border-t">
                <p>
                  If this problem persists, please contact support with the Error ID above.
                  {process.env.NODE_ENV === 'development' && (
                    <span className="block mt-1 font-medium">
                      Development Mode: Check the console for additional details.
                    </span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export const useErrorHandler = () => {
  const router = useRouter();
  
  const handleError = React.useCallback((error: Error, errorInfo?: any) => {
    console.error('Error caught by useErrorHandler:', error, errorInfo);
    
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    toast.error(`An error occurred (${errorId}). Please try again.`);
    
    // In production, report to error service
    if (process.env.NODE_ENV === 'production') {
      // reportErrorToService({ error, errorInfo, errorId });
    }
    
    return errorId;
  }, []);
  
  const resetAndGoHome = React.useCallback(() => {
    router.push('/');
  }, [router]);
  
  return {
    handleError,
    resetAndGoHome
  };
};

// Default fallback component
export const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorId,
  resetError,
  goHome,
  reportError
}) => {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Alert variant="destructive" className="max-w-md">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Occurred</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-4">{error.message}</p>
          <p className="text-xs text-muted-foreground mb-4">Error ID: {errorId}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetError}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
            <Button variant="secondary" size="sm" onClick={goHome}>
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
            <Button variant="ghost" size="sm" onClick={reportError}>
              <Bug className="h-4 w-4 mr-2" />
              Report
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default GeneralErrorBoundary;