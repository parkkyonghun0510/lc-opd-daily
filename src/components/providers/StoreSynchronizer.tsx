'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/auth/store';
import { toast } from '@/components/ui/use-toast';

interface StoreSynchronizerProps {
    syncInterval?: number; // in seconds
    syncOnFocus?: boolean;
    syncOnReconnect?: boolean;
    syncOnBackgroundSync?: boolean;
}

export function StoreSynchronizer({
    syncInterval = 300, // 5 minutes default
    syncOnFocus = true,
    syncOnReconnect = true,
    syncOnBackgroundSync = true,
}: StoreSynchronizerProps) {
    const lastSyncTime = useRef<number>(0);
    const { isAuthenticated } = useStore();

    // Since we don't have the actual offline store functions,
    // we'll create stub implementations that do nothing
    const getOfflineData = useCallback(async () => [], []);
    const syncOfflineData = useCallback(async (_data: any[]) => ({ success: true }), []);
    const updateSyncStatus = useCallback((status: string) => {
        console.log('Sync status updated:', status);
    }, []);

    const performSync = useCallback(async () => {
        if (!isAuthenticated) return;

        try {
            const offlineData = await getOfflineData();
            if (offlineData.length === 0) return;

            updateSyncStatus('syncing');
            const result = await syncOfflineData(offlineData);

            if (result.success) {
                toast({
                    title: 'Sync successful',
                    description: 'Offline data synchronized successfully'
                });
                lastSyncTime.current = Date.now();
                updateSyncStatus('synced');
            } else {
                throw new Error('Sync failed');
            }
        } catch (error) {
            console.error('Sync error:', error);
            toast({
                title: 'Sync failed',
                description: 'Failed to sync offline data',
                variant: 'destructive'
            });
            updateSyncStatus('error');
        }
    }, [isAuthenticated, getOfflineData, syncOfflineData, updateSyncStatus, toast]);

    // Regular sync interval
    useEffect(() => {
        if (!isAuthenticated) return;

        const syncTimer = setInterval(() => {
            const now = Date.now();
            if (now - lastSyncTime.current >= syncInterval * 1000) {
                performSync();
            }
        }, 60000); // Check every minute

        return () => clearInterval(syncTimer);
    }, [isAuthenticated, syncInterval, performSync]);

    // Sync on window focus
    useEffect(() => {
        if (!isAuthenticated || !syncOnFocus) return;

        const handleFocus = () => {
            const now = Date.now();
            if (now - lastSyncTime.current >= 10000) { // At least 10s between syncs
                performSync();
            }
        };

        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [isAuthenticated, syncOnFocus, performSync]);

    // Sync on network reconnection
    useEffect(() => {
        if (!isAuthenticated || !syncOnReconnect) return;

        const handleOnline = () => {
            performSync();
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [isAuthenticated, syncOnReconnect, performSync]);

    // Listen for sync events from service worker
    useEffect(() => {
        if (!isAuthenticated || !syncOnBackgroundSync) return;

        const handleSync = (event: Event) => {
            if ((event as CustomEvent).detail?.type === 'sync-complete') {
                performSync();
            }
        };

        window.addEventListener('sync-event', handleSync);
        return () => window.removeEventListener('sync-event', handleSync);
    }, [isAuthenticated, syncOnBackgroundSync, performSync]);

    // Component doesn't render anything
    return null;
}