'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useAuth } from '@/auth/hooks/useAuth';
import toast from 'react-hot-toast';
import { useEffect } from 'react';

// Query keys for consistent cache management
export const sessionQueryKeys = {
  session: ['session'] as const,
  user: ['session', 'user'] as const,
  permissions: ['session', 'permissions'] as const,
};

// Session data fetcher with error handling
const fetchSession = async () => {
  const response = await fetch('/api/auth/session', {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    // Handle different error types
    if (response.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    if (response.status === 403) {
      throw new Error('FORBIDDEN');
    }
    if (response.status >= 500) {
      throw new Error('SERVER_ERROR');
    }
    throw new Error('FETCH_ERROR');
  }

  const session = await response.json();
  return session;
};

// Enhanced session hook with TanStack Query
export function useSessionQuery() {
  const { data: nextAuthSession, status } = useSession();
  const queryClient = useQueryClient();
  const auth = useAuth();

  const sessionQuery = useQuery({
    queryKey: sessionQueryKeys.session,
    queryFn: fetchSession,
    enabled: status !== 'loading', // Don't fetch until NextAuth is ready
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on auth errors
      if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
        return false;
      }
      // Retry up to 3 times for other errors
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Handle success and error cases with useEffect
  useEffect(() => {
    if (sessionQuery.data) {
      // Sync with auth store
      if (sessionQuery.data?.user) {
        auth.setUser(sessionQuery.data.user);
        auth.updateLastActivity();
      } else {
        auth.setUser(null);
      }
    }
  }, [sessionQuery.data, auth]);

  useEffect(() => {
    if (sessionQuery.error) {
      console.error('Session query error:', sessionQuery.error);
      
      // Handle specific error types
      if ((sessionQuery.error as Error).message === 'UNAUTHORIZED') {
        auth.setUser(null);
        // Don't show toast for unauthorized - this is expected when not logged in
      } else if ((sessionQuery.error as Error).message === 'SERVER_ERROR') {
        toast.error('Server error. Please try again later.');
      } else if ((sessionQuery.error as Error).message === 'FETCH_ERROR') {
        toast.error('Network error. Please check your connection.');
      }
    }
  }, [sessionQuery.error, auth]);

  // Sync NextAuth session with our query cache
  useEffect(() => {
    if (nextAuthSession) {
      queryClient.setQueryData(sessionQueryKeys.session, nextAuthSession);
    }
  }, [nextAuthSession, queryClient]);

  return {
    ...sessionQuery,
    session: sessionQuery.data,
    user: sessionQuery.data?.user || null,
    isAuthenticated: !!sessionQuery.data?.user,
    isSessionLoading: sessionQuery.isLoading || status === 'loading',
  };
}

// Login mutation with enhanced error handling
export function useLoginMutation() {
  const queryClient = useQueryClient();
  const auth = useAuth();

  return useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      if (!result?.ok) {
        throw new Error('LOGIN_FAILED');
      }

      return result;
    },
    onMutate: () => {
      auth.setLoading(true);
      auth.clearError();
    },
    onSuccess: async () => {
      // Invalidate and refetch session
      await queryClient.invalidateQueries({ queryKey: sessionQueryKeys.session });
      
      auth.setLoading(false);
      toast.success('Login successful!');
    },
    onError: (error: Error) => {
      auth.setLoading(false);
      
      let errorMessage = 'Login failed. Please try again.';
      
      if (error.message === 'CredentialsSignin') {
        errorMessage = 'Invalid username or password';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      toast.error(errorMessage);
    },
    retry: (failureCount, error) => {
      // Don't retry credential errors
      if (error.message === 'CredentialsSignin') {
        return false;
      }
      // Retry network errors up to 2 times
      return failureCount < 2;
    },
    retryDelay: 1000,
  });
}

// Logout mutation
export function useLogoutMutation() {
  const queryClient = useQueryClient();
  const auth = useAuth();

  return useMutation({
    mutationFn: async () => {
      await signOut({ redirect: false });
    },
    onMutate: () => {
      auth.setLoading(true);
    },
    onSuccess: () => {
      // Clear all queries
      queryClient.clear();
      
      // Reset auth store
      auth.setUser(null);
      auth.setLoading(false);
      auth.clearError();
      
      toast.success('Logged out successfully');
      
      // Redirect
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    },
    onError: (error) => {
      auth.setLoading(false);
      toast.error('Logout failed. Please try again.');
    },
  });
}

// Session refresh mutation
export function useSessionRefreshMutation() {
  const queryClient = useQueryClient();
  const auth = useAuth();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('REFRESH_FAILED');
      }

      return response.json();
    },
    onSuccess: (session) => {
      // Update query cache
      queryClient.setQueryData(sessionQueryKeys.session, session);
      
      // Update auth store
      if (session?.user) {
        auth.setUser(session.user);
        auth.updateLastActivity();
      }
    },
    onError: (error) => {
      console.error('Failed to refresh session:', error);
    },
    retry: 1,
    retryDelay: 1000,
  });
}

// Hook for automatic session refresh
export function useSessionAutoRefresh() {
  const auth = useAuth();
  const refreshMutation = useSessionRefreshMutation();

  useEffect(() => {
    const interval = setInterval(() => {
      if (auth.isAuthenticated && auth.needsTokenRefresh() && !auth.refreshInProgress) {
        refreshMutation.mutate();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [auth, refreshMutation]);

  return refreshMutation;
}

// Hook for online/offline status
export function useOnlineStatus() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOnline = () => {
      // Refetch queries when coming back online
      queryClient.refetchQueries({ queryKey: sessionQueryKeys.session });
    };

    const handleOffline = () => {
      // Handle offline state
      console.log('Application is offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queryClient]);

  return navigator.onLine;
}