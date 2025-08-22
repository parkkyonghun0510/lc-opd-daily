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
const StartupWarning: React.FC<{ warnings: string[]; onContinue: () => void }> = ({ warnings, onContinue }) => {
  const isBrowserValidationWarning = warnings.some(warning => 
    warning.includes('cannot be validated in the browser') || 
    warning.includes('Ensure it is configured on the server')
  );

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="max-w-lg w-full mx-4 space-y-4">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 text-warning">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mt-4">
            {isBrowserValidationWarning ? 'Browser Security Notice' : 'Configuration Warnings'}
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            {isBrowserValidationWarning 
              ? 'These warnings are expected and indicate proper security practices'
              : 'Some features may not work as expected'
            }
          </p>
        </div>

        <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="h-4 w-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-sm font-medium text-warning">
              {isBrowserValidationWarning ? 'Security Information:' : 'Warnings:'}
            </h3>
          </div>
          <ul className="text-sm space-y-2">
            {warnings.map((warning, index) => (
              <li key={index} className="text-warning flex items-start gap-2">
                <span className="text-warning/60 mt-0.5">•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
          {isBrowserValidationWarning && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Why these warnings appear:</strong> For security, sensitive server-side environment variables 
                (like private keys and database URLs) cannot be validated in the browser. These warnings confirm 
                that your application follows security best practices.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onContinue}
            className="flex-1 bg-primary text-primary-foreground rounded-md px-4 py-2 hover:bg-primary/90 transition-colors"
          >
            {isBrowserValidationWarning ? 'Continue (Safe)' : 'Continue Anyway'}
          </button>
          {isBrowserValidationWarning && (
            <button
              onClick={() => window.open('/ENVIRONMENT_VALIDATION_GUIDE.md', '_blank')}
              className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent transition-colors"
              title="Learn more about these warnings"
            >
              Learn More
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

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

      const hasErrors = result.errors.length > 0;
      const hasWarnings = result.warnings.length > 0;

      setStatus({
        isLoading: false,
        // Do not auto-continue when warnings exist; show the warning overlay instead
        isReady: !hasErrors && !hasWarnings,
        errors: result.errors,
        warnings: result.warnings,
        services: {
          environment: result.success,
          redis: false, // Cannot test in browser
          dragonfly: false, // Cannot test in browser
          // In the browser we can only validate the presence of the public key
          vapid: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
        },
      });
      // Trigger callbacks
      if (result.errors.length > 0) {
        console.error("StartupProvider Errors:", result.errors);
        onError?.(result.errors);
      }

      if (result.warnings.length > 0) {
        console.warn("StartupProvider Warnings:", result.warnings);
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

      // Downgrade missing VAPID public key to a warning so app can still load without push
      const downgradedWarnings = [...result.warnings];
      const remainingErrors: string[] = [];
      for (const e of result.errors) {
        if (e.includes('NEXT_PUBLIC_VAPID_PUBLIC_KEY')) {
          downgradedWarnings.push(`Push notifications disabled: ${e}`);
        } else {
          remainingErrors.push(e);
        }
      }

      const hasErrors = remainingErrors.length > 0;
      const hasWarnings = downgradedWarnings.length > 0;

      setStatus({
        isLoading: false,
        // Do not auto-continue when warnings exist; show the warning overlay instead
        isReady: !hasErrors && !hasWarnings,
        errors: remainingErrors,
        warnings: downgradedWarnings,
        services: {
          environment: result.success,
          redis: false, // Cannot test in browser
          dragonfly: false, // Cannot test in browser
          // In the browser we can only validate the presence of the public key
          vapid: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
        },
      });

      // Note: hooks should not call provider callbacks; just update local state and log
      if (remainingErrors.length > 0) {
        console.error('useStartupStatus Errors:', remainingErrors);
      }
      if (downgradedWarnings.length > 0) {
        console.warn('useStartupStatus Warnings:', downgradedWarnings);
      }
    };

    checkStatus();
  }, []);

  return status;
};