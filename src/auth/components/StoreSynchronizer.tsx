"use client";

import { useEffect, useRef } from 'react';
import { useStore } from '@/auth/store';
import { synchronizeUserData } from '@/auth/store/actions';
import { useSession } from 'next-auth/react';

interface StoreSynchronizerProps {
  // Sync interval in seconds
  syncInterval?: number;
  // Whether to sync on window focus
  syncOnFocus?: boolean;
  // Whether to sync on network reconnection
  syncOnReconnect?: boolean;
}

/**
 * StoreSynchronizer component
 *
 * Synchronizes the Zustand store with the server at regular intervals
 * and on specific events like window focus and network reconnection.
 */
export function StoreSynchronizer({
  syncInterval = 300, // 5 minutes
  syncOnFocus = true,
  syncOnReconnect = true,
}: StoreSynchronizerProps) {
  const { data: session, status } = useSession();
  const { isAuthenticated, setUser } = useStore();
  const lastSyncTime = useRef<number>(0);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync NextAuth session with Zustand store
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      setUser({
        id: session.user.id,
        name: session.user.name || '',
        email: session.user.email || '',
        role: session.user.role || '',
        branchId: session.user.branchId,
        image: session.user.image,
      });
    } else if (status === 'unauthenticated') {
      setUser(null);
    }
  }, [session, status, setUser]);

  // Sync user data at regular intervals
  useEffect(() => {
    if (!isAuthenticated) return;

    const syncData = async () => {
      const now = Date.now();
      // Only sync if it's been at least 10 seconds since the last sync
      if (now - lastSyncTime.current >= 10000) {
        // Check if token needs refresh
        if (useStore.getState().needsTokenRefresh()) {
          // Try to silently refresh the token
          await useStore.getState().refreshAuthToken();
        }

        // Sync user data
        await synchronizeUserData();
        lastSyncTime.current = now;
      }
    };

    // Initial sync
    syncData();

    // Set up interval for regular syncing
    syncIntervalRef.current = setInterval(syncData, syncInterval * 1000);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [isAuthenticated, syncInterval]);

  // Sync on window focus
  useEffect(() => {
    if (!isAuthenticated || !syncOnFocus) return;

    const handleFocus = async () => {
      const now = Date.now();
      // Only sync if it's been at least 10 seconds since the last sync
      if (now - lastSyncTime.current >= 10000) {
        // Check if token needs refresh
        if (useStore.getState().needsTokenRefresh()) {
          // Try to silently refresh the token
          await useStore.getState().refreshAuthToken();
        }

        // Check if session has expired
        if (useStore.getState().isSessionExpired()) {
          // Handle session timeout
          await import('@/auth/store/actions').then(async ({ handleSessionTimeout }) => {
            await handleSessionTimeout();
          });
          return;
        }

        // Sync user data
        await synchronizeUserData();
        lastSyncTime.current = now;
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [isAuthenticated, syncOnFocus]);

  // Sync on network reconnection
  useEffect(() => {
    if (!isAuthenticated || !syncOnReconnect) return;

    const handleOnline = async () => {
      // Check if token needs refresh
      if (useStore.getState().needsTokenRefresh()) {
        // Try to silently refresh the token
        await useStore.getState().refreshAuthToken();
      }

      // Check if session has expired
      if (useStore.getState().isSessionExpired()) {
        // Handle session timeout
        await import('@/auth/store/actions').then(async ({ handleSessionTimeout }) => {
          await handleSessionTimeout();
        });
        return;
      }

      // Sync user data
      await synchronizeUserData();
      lastSyncTime.current = Date.now();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [isAuthenticated, syncOnReconnect]);

  // This component doesn't render anything
  return null;
}
