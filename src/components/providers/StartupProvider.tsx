/**
 * Startup Provider Component
 * 
 * Handles application initialization and environment validation
 * Provides user-friendly feedback during startup
 */

'use client';

import React, { useEffect, useState } from 'react';
import { EnvironmentValidator } from '@/lib/env-validator';

// Startup status interface
interface StartupStatus {
  isLoading: boolean;
  isReady: boolean;
  errors: string[];
  warnings: string[];
  services: {
    environment: boolean;
    redis: boolean;
    dragonfly: boolean;
    vapid: boolean;
  };
}

// Props interface
interface StartupProviderProps {
  children: React.ReactNode;
  onError?: (errors: string[]) => void;
  onWarning?: (warnings: string[]) => void;
}

// Loading component
const StartupLoading: React.FC = () => (
  <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
    <div className="text-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Initializing Application...</h2>
        <p className="text-sm text-muted-foreground">
          Validating environment and checking services
        </p>
      </div>
    </div>
  </div>
);

// Error component
const StartupError: React.FC<{ errors: string[]; onRetry?: () => void }> = ({ errors, onRetry }) => (
  <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
    <div className="max-w-md w-full mx-4 space-y-4">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 text-destructive">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold mt-4">Initialization Failed</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Some required services are not configured correctly
        </p>
      </div>
      
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
        <h3 className="text-sm font-medium text-destructive mb-2">Errors:</h3>
        <ul className="text-sm space-y-1">
          {errors.map((error, index) => (
            <li key={index} className="text-destructive">
              • {error}
            </li>
          ))}
        </ul>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="w-full bg-primary text-primary-foreground rounded-md px-4 py-2 hover:bg-primary/90"
        >
          Retry
        </button>
      )}
    </div>
  </div>
);

// Warning component
const StartupWarning: React.FC<{ warnings: string[]; onContinue: () => void }> = ({ warnings, onContinue }) => (
  <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="max-w-md w-full mx-4 space-y-4">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 text-warning">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold mt-4">Configuration Warnings</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Some features may not work as expected
        </p>
      </div>
      
      <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
        <h3 className="text-sm font-medium text-warning mb-2">Warnings:</h3>
        <ul className="text-sm space-y-1">
          {warnings.map((warning, index) => (
            <li key={index} className="text-warning">
              • {warning}
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={onContinue}
        className="w-full bg-primary text-primary-foreground rounded-md px-4 py-2 hover:bg-primary/90"
      >
        Continue Anyway
      </button>
    </div>
  </div>
);

export const StartupProvider: React.FC<StartupProviderProps> = ({ children, onError, onWarning }) => {
  const [status, setStatus] = useState<StartupStatus>({
    isLoading: true,
    isReady: false,
    errors: [],
    warnings: [],
    services: {
      environment: false,
      redis: false,
      dragonfly: false,
      vapid: false,
    },
  });

  const initializeApp = async () => {
    try {
      setStatus(prev => ({ ...prev, isLoading: true }));
      
      // Client-side validation only - this is a client component
      const validator = EnvironmentValidator.getInstance();
      const result = validator.validateEnvironment();
      
      setStatus({
        isLoading: false,
        isReady: result.success || (result.warnings.length > 0 && result.errors.length === 0),
        errors: result.errors,
        warnings: result.warnings,
        services: {
          environment: result.success,
          redis: false, // Cannot test in browser
          dragonfly: false, // Cannot test in browser
          vapid: result.success && validator.validateVapidConfiguration(),
        },
      });

      // Trigger callbacks
      if (result.errors.length > 0) {
        onError?.(result.errors);
      }
      
      if (result.warnings.length > 0) {
        onWarning?.(result.warnings);
      }

    } catch (error) {
      setStatus({
        isLoading: false,
        isReady: false,
        errors: [error instanceof Error ? error.message : 'Unknown initialization error'],
        warnings: [],
        services: {
          environment: false,
          redis: false,
          dragonfly: false,
          vapid: false,
        },
      });
      onError?.([error instanceof Error ? error.message : 'Unknown initialization error']);
    }
  };

  useEffect(() => {
    initializeApp();
  }, []);

  const handleRetry = () => {
    initializeApp();
  };

  const handleContinueWithWarnings = () => {
    setStatus(prev => ({ ...prev, isReady: true }));
  };

  // Show loading state
  if (status.isLoading) {
    return <StartupLoading />;
  }

  // Show error state
  if (status.errors.length > 0 && !status.isReady) {
    return <StartupError errors={status.errors} onRetry={handleRetry} />;
  }

  // Show warning state
  if (status.warnings.length > 0 && !status.isReady) {
    return <StartupWarning warnings={status.warnings} onContinue={handleContinueWithWarnings} />;
  }

  // Application is ready
  return <>{children}</>;
};

// Hook for accessing startup status
export const useStartupStatus = () => {
  const [status, setStatus] = useState<StartupStatus>({
    isLoading: true,
    isReady: false,
    errors: [],
    warnings: [],
    services: {
      environment: false,
      redis: false,
      dragonfly: false,
      vapid: false,
    },
  });

  useEffect(() => {
    const checkStatus = async () => {
      const validator = EnvironmentValidator.getInstance();
      const result = validator.validateEnvironment();
      
      setStatus({
        isLoading: false,
        isReady: result.success || result.warnings.length > 0,
        errors: result.errors,
        warnings: result.warnings,
        services: {
          environment: result.success,
          redis: false, // This would need actual connection check
          dragonfly: false, // This would need actual connection check
          vapid: result.data?.NEXT_PUBLIC_VAPID_PUBLIC_KEY !== undefined,
        },
      });
    };

    checkStatus();
  }, []);

  return status;
};