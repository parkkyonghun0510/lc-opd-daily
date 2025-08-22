/**
 * Race condition safe authentication hooks
 * Prevents common race conditions in auth operations
 */

import { useCallback, useRef, useEffect } from 'react';
import { useAuth, useUserProfile } from './useAuth';
import { raceConditionManager } from '@/lib/sync/race-condition-manager';
import { handleError } from '@/lib/errors/error-handler';
import { createAuthError } from '@/lib/errors/error-classes';
import { AuthErrorCode } from '@/types/errors';

interface SafeAuthOptions {
  preventDuplicateLogin?: boolean;
  loginTimeout?: number;
  logoutTimeout?: number;
  refreshTimeout?: number;
  maxConcurrentOperations?: number;
}

export function useRaceConditionSafeAuth(options: SafeAuthOptions = {}) {
  const {
    preventDuplicateLogin = true,
    loginTimeout = 30000,
    logoutTimeout = 10000,
    refreshTimeout = 15000,
    maxConcurrentOperations = 3
  } = options;

  const auth = useAuth();
  const operationCountRef = useRef(0);
  const abortControllersRef = useRef(new Map<string, AbortController>());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Abort all pending operations
      abortControllersRef.current.forEach(controller => {
        controller.abort();
      });
      abortControllersRef.current.clear();
    };
  }, []);

  const safeLogin = useCallback(async (
    email: string,
    password: string,
    callbackUrl?: string
  ) => {
    const operationKey = `login_${email}`;
    
    try {
      // Check operation limit
      if (operationCountRef.current >= maxConcurrentOperations) {
        throw createAuthError(
          AuthErrorCode.RATE_LIMITED,
          'Too many concurrent authentication operations',
          { retryable: true, userId: email }
        );
      }

      operationCountRef.current++;

      const result = await raceConditionManager.preventDuplicateRequest(
        operationKey,
        async (signal) => {
          // Store abort controller
          abortControllersRef.current.set(operationKey, new AbortController());
          
          try {
            // Check if signal is already aborted
            if (signal.aborted) {
              throw createAuthError(
                AuthErrorCode.SIGNIN_FAILED,
                'Login operation was cancelled',
                { retryable: false, userId: email }
              );
            }

            return await auth.login(email, password, callbackUrl);
          } finally {
            abortControllersRef.current.delete(operationKey);
          }
        },
        {
          timeout: loginTimeout,
          allowConcurrent: !preventDuplicateLogin
        }
      );

      return result;
    } catch (error) {
      handleError(error as Error, {
        context: { operation: 'login', email },
        severity: 'high'
      });
      throw error;
    } finally {
      operationCountRef.current--;
    }
  }, [auth, preventDuplicateLogin, loginTimeout, maxConcurrentOperations]);

  const safeLogout = useCallback(async () => {
    const operationKey = 'logout';
    
    try {
      operationCountRef.current++;

      await raceConditionManager.preventDuplicateRequest(
        operationKey,
        async (signal) => {
          abortControllersRef.current.set(operationKey, new AbortController());
          
          try {
            if (signal.aborted) {
              throw createAuthError(
                AuthErrorCode.SIGNOUT_FAILED,
                'Logout operation was cancelled',
                { retryable: false }
              );
            }

            return await auth.logout();
          } finally {
            abortControllersRef.current.delete(operationKey);
          }
        },
        {
          timeout: logoutTimeout,
          allowConcurrent: false
        }
      );
    } catch (error) {
      handleError(error as Error, {
        context: { operation: 'logout' },
        severity: 'medium'
      });
      throw error;
    } finally {
      operationCountRef.current--;
    }
  }, [auth, logoutTimeout]);

  const safeRefreshToken = useCallback(async () => {
    const operationKey = 'refresh_token';
    
    try {
      operationCountRef.current++;

      const result = await raceConditionManager.preventDuplicateRequest(
        operationKey,
        async (signal) => {
          abortControllersRef.current.set(operationKey, new AbortController());
          
          try {
            if (signal.aborted) {
              throw createAuthError(
                AuthErrorCode.REFRESH_FAILED,
                'Token refresh was cancelled',
                { retryable: true }
              );
            }

            return await auth.refreshAuthToken();
          } finally {
            abortControllersRef.current.delete(operationKey);
          }
        },
        {
          timeout: refreshTimeout,
          allowConcurrent: false
        }
      );

      return result;
    } catch (error) {
      handleError(error as Error, {
        context: { operation: 'refresh_token' },
        severity: 'high'
      });
      throw error;
    } finally {
      operationCountRef.current--;
    }
  }, [auth, refreshTimeout]);

  const profile = useUserProfile();
  
  const safeUpdateProfile = useCallback(async (profileData: any) => {
    const operationKey = `update_profile_${auth.user?.id || 'anonymous'}`;
    
    try {
      operationCountRef.current++;

      const result = await raceConditionManager.withStateLock(
        operationKey,
        'profile_update',
        async () => {
          return await profile.updateProfile(profileData);
        },
        5000
      );

      return result;
    } catch (error) {
      handleError(error as Error, {
        context: { operation: 'update_profile', userId: auth.user?.id },
        severity: 'medium'
      });
      throw error;
    } finally {
      operationCountRef.current--;
    }
  }, [auth, profile]);

  const cancelAllOperations = useCallback(() => {
    abortControllersRef.current.forEach(controller => {
      controller.abort();
    });
    abortControllersRef.current.clear();
    operationCountRef.current = 0;
  }, []);

  const getOperationStatus = useCallback(() => {
    return {
      activeOperations: operationCountRef.current,
      pendingOperations: Array.from(abortControllersRef.current.keys()),
      canStartNewOperation: operationCountRef.current < maxConcurrentOperations
    };
  }, [maxConcurrentOperations]);

  return {
    // Safe auth operations
    login: safeLogin,
    logout: safeLogout,
    refreshToken: safeRefreshToken,
    updateProfile: safeUpdateProfile,
    
    // Control functions
    cancelAllOperations,
    getOperationStatus,
    
    // Original auth state (read-only)
    user: auth.user,
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
    error: auth.error
  };
}

// Hook for sequential auth operations
export function useSequentialAuth() {
  const auth = useAuth();
  
  const executeSequentially = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> => {
    return raceConditionManager.executeInSequence(
      `auth_sequential_${operationName}`,
      operation,
      { timeout: 30000, maxConcurrentOperations: 1 }
    );
  }, []);

  const sequentialLogin = useCallback(async (
    email: string,
    password: string,
    callbackUrl?: string
  ) => {
    return executeSequentially(
      () => auth.login(email, password, callbackUrl),
      'login'
    );
  }, [auth, executeSequentially]);

  const sequentialLogout = useCallback(async () => {
    return executeSequentially(
      () => auth.logout(),
      'logout'
    );
  }, [auth, executeSequentially]);

  const sequentialRefresh = useCallback(async () => {
    return executeSequentially(
      () => auth.refreshAuthToken(),
      'refresh'
    );
  }, [auth, executeSequentially]);

  return {
    login: sequentialLogin,
    logout: sequentialLogout,
    refreshToken: sequentialRefresh,
    executeSequentially,
    
    // Original auth state
    user: auth.user,
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
    error: auth.error
  };
}

// Hook for debounced auth operations
export function useDebouncedAuth(delay: number = 300) {
  const auth = useAuth();
  const profile = useUserProfile();
  
  const debouncedLogin = useCallback(
    raceConditionManager.debounce(
      async (email: string, password: string, callbackUrl?: string) => {
        return auth.login(email, password, callbackUrl);
      },
      delay,
      'debounced_login'
    ),
    [auth, delay]
  );

  const debouncedUpdateProfile = useCallback(
    raceConditionManager.debounce(
      async (profileData: any) => {
        return profile.updateProfile(profileData);
      },
      delay,
      'debounced_update_profile'
    ),
    [profile, delay]
  );

  return {
    login: debouncedLogin,
    updateProfile: debouncedUpdateProfile,
    
    // Original auth state
    user: auth.user,
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
    error: auth.error
  };
}