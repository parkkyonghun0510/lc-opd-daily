'use client';

import React from 'react';
import GeneralErrorBoundary, { ErrorFallbackProps } from './GeneralErrorBoundary';
import AuthErrorBoundary from '../auth/AuthErrorBoundary';
import RealtimeErrorBoundary, { RealtimeErrorFallbackProps } from '../realtime/RealtimeErrorBoundary';

// Generic HOC options
interface WithErrorBoundaryOptions {
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showErrorDetails?: boolean;
  enableRetry?: boolean;
  enableNavigation?: boolean;
}

// Auth-specific HOC options
interface WithAuthErrorBoundaryOptions {
  fallback?: React.ComponentType<any>;
}

// Realtime-specific HOC options
interface WithRealtimeErrorBoundaryOptions {
  fallback?: React.ComponentType<RealtimeErrorFallbackProps>;
  onConnectionRetry?: () => void;
  onForcePolling?: () => void;
  onForceSSE?: () => void;
  connectionMethod?: 'sse' | 'polling';
  isConnected?: boolean;
}

// Generic error boundary HOC
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options: WithErrorBoundaryOptions = {}
) {
  const WrappedComponent = React.forwardRef<any, P>((props, ref) => {
    return (
      <GeneralErrorBoundary
        fallback={options.fallback}
        onError={options.onError}
        showErrorDetails={options.showErrorDetails}
        enableRetry={options.enableRetry}
        enableNavigation={options.enableNavigation}
      >
        <Component {...(props as P)} ref={ref} />
      </GeneralErrorBoundary>
    );
  });

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Auth error boundary HOC
export function withAuthErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options: WithAuthErrorBoundaryOptions = {}
) {
  const WrappedComponent = React.forwardRef<any, P>((props, ref) => {
    return (
      <AuthErrorBoundary
        fallback={options.fallback}
      >
        <Component {...(props as P)} ref={ref} />
      </AuthErrorBoundary>
    );
  });

  WrappedComponent.displayName = `withAuthErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Realtime error boundary HOC
export function withRealtimeErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options: WithRealtimeErrorBoundaryOptions = {}
) {
  const WrappedComponent = React.forwardRef<any, P>((props, ref) => {
    return (
      <RealtimeErrorBoundary
        fallback={options.fallback}
        onConnectionRetry={options.onConnectionRetry}
        onForcePolling={options.onForcePolling}
        onForceSSE={options.onForceSSE}
        connectionMethod={options.connectionMethod}
        isConnected={options.isConnected}
      >
        <Component {...(props as P)} ref={ref} />
      </RealtimeErrorBoundary>
    );
  });

  WrappedComponent.displayName = `withRealtimeErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Combined error boundary HOC that includes all error boundaries
export function withAllErrorBoundaries<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    general?: WithErrorBoundaryOptions;
    auth?: WithAuthErrorBoundaryOptions;
    realtime?: WithRealtimeErrorBoundaryOptions;
  } = {}
) {
  const WrappedComponent = React.forwardRef<any, P>((props, ref) => {
    return (
      <GeneralErrorBoundary
        {...options.general}
      >
        <AuthErrorBoundary
          {...options.auth}
        >
          <RealtimeErrorBoundary
            {...options.realtime}
          >
            <Component {...(props as P)} ref={ref} />
          </RealtimeErrorBoundary>
        </AuthErrorBoundary>
      </GeneralErrorBoundary>
    );
  });

  WrappedComponent.displayName = `withAllErrorBoundaries(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Utility function to create error boundary wrapper components
export const createErrorBoundaryWrapper = (
  options: WithErrorBoundaryOptions = {}
) => {
  return function ErrorBoundaryWrapper({ children }: { children: React.ReactNode }) {
    return (
      <GeneralErrorBoundary {...options}>
        {children}
      </GeneralErrorBoundary>
    );
  };
};

export const createAuthErrorBoundaryWrapper = (
  options: WithAuthErrorBoundaryOptions = {}
) => {
  return function AuthErrorBoundaryWrapper({ children }: { children: React.ReactNode }) {
    return (
      <AuthErrorBoundary {...options}>
        {children}
      </AuthErrorBoundary>
    );
  };
};

export const createRealtimeErrorBoundaryWrapper = (
  options: WithRealtimeErrorBoundaryOptions = {}
) => {
  return function RealtimeErrorBoundaryWrapper({ children }: { children: React.ReactNode }) {
    return (
      <RealtimeErrorBoundary {...options}>
        {children}
      </RealtimeErrorBoundary>
    );
  };
};

// Example usage components for documentation
export const ExampleUsage = {
  // Basic usage
  BasicComponent: withErrorBoundary(() => <div>My Component</div>),
  
  // With custom options
  CustomComponent: withErrorBoundary(
    () => <div>My Component</div>,
    {
      showErrorDetails: true,
      onError: (error, errorInfo) => {
        console.log('Custom error handler:', error, errorInfo);
      }
    }
  ),
  
  // Auth component
  AuthComponent: withAuthErrorBoundary(
    () => <div>Protected Component</div>,
    {
      // Only fallback is supported for AuthErrorBoundary
    }
  ),
  
  // Realtime component
  RealtimeComponent: withRealtimeErrorBoundary(
    () => <div>Realtime Component</div>,
    {
      connectionMethod: 'sse',
      isConnected: true,
      onConnectionRetry: () => console.log('Retrying connection')
    }
  ),
  
  // All error boundaries
  FullyProtectedComponent: withAllErrorBoundaries(
    () => <div>Fully Protected Component</div>,
    {
      general: { showErrorDetails: true },
      auth: { /* Only fallback is supported */ },
      realtime: { connectionMethod: 'sse' }
    }
  )
};

// Export types for external use
export type {
  WithErrorBoundaryOptions,
  WithAuthErrorBoundaryOptions,
  WithRealtimeErrorBoundaryOptions
};