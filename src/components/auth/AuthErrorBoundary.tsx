'use client';

import React from 'react';
import { AlertCircle, RefreshCw, LogOut } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { signOut } from 'next-auth/react';
import toast from 'react-hot-toast';

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<AuthErrorFallbackProps>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export interface AuthErrorFallbackProps {
  error: Error;
  errorInfo: React.ErrorInfo;
  resetError: () => void;
  signOutUser: () => void;
}

class AuthErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('AuthErrorBoundary caught an error:', error, errorInfo);
    
    // Log authentication-specific error details
    if (this.isAuthError(error)) {
      console.error('Authentication error details:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      });
      
      // Show toast notification for auth errors
      toast.error('Authentication error occurred. Please try signing in again.');
    }
    
    this.setState({ errorInfo });
  }

  private isAuthError = (error: Error): boolean => {
    const authErrorKeywords = [
      'authentication',
      'unauthorized',
      'session',
      'token',
      'login',
      'signin',
      'credential'
    ];
    
    return authErrorKeywords.some(keyword => 
      error.message.toLowerCase().includes(keyword) ||
      error.name.toLowerCase().includes(keyword)
    );
  };

  private resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  private signOutUser = async () => {
    try {
      await signOut({ callbackUrl: '/login' });
    } catch (error) {
      console.error('Error signing out:', error);
      // Force redirect if signOut fails
      window.location.href = '/login';
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
            resetError={this.resetError}
            signOutUser={this.signOutUser}
          />
        );
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Authentication Error</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="mb-4">
                  {this.isAuthError(this.state.error)
                    ? 'There was a problem with your authentication. Please sign in again.'
                    : this.state.error.message || 'An unexpected authentication error occurred.'}
                </p>
                
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={this.resetError}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try Again
                  </Button>
                  
                  <Button
                    variant="default"
                    size="sm"
                    onClick={this.signOutUser}
                    className="flex items-center gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
            
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4 p-4 bg-muted rounded-lg">
                <summary className="cursor-pointer font-medium mb-2">
                  Error Details (Development)
                </summary>
                <pre className="text-xs overflow-auto whitespace-pre-wrap">
                  {this.state.error.stack}
                </pre>
                <pre className="text-xs overflow-auto whitespace-pre-wrap mt-2">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Default fallback component
export const DefaultAuthErrorFallback: React.FC<AuthErrorFallbackProps> = ({
  error,
  resetError,
  signOutUser
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Authentication Error</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-4">{error.message}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetError}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
              <Button variant="default" size="sm" onClick={signOutUser}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
};

export default AuthErrorBoundary;