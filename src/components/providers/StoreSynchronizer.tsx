'use client';

import { useCallback, useEffect } from 'react';
import { useStore } from '@/store';

interface StoreSynchronizerProps {
    syncInterval: number;
    syncOnFocus: boolean;
    syncOnReconnect: boolean;
    syncOnBackgroundSync: boolean;
}

export function StoreSynchronizer({
    syncInterval,
    syncOnFocus,
    syncOnReconnect,
    syncOnBackgroundSync,
}: StoreSynchronizerProps) {
    const { syncOfflineData, offlineData, getOfflineData } = useStore();

    // Initial data load
    useEffect(() => {
        getOfflineData();
    }, [getOfflineData]);

    // Sync logic
    const handleSync = useCallback(async () => {
        if (offlineData.length > 0) {
            await syncOfflineData(offlineData);
        }
    }, [offlineData, syncOfflineData]);

    // Interval-based sync
    useEffect(() => {
        if (syncInterval > 0) {
            const intervalId = setInterval(handleSync, syncInterval * 1000);
            return () => clearInterval(intervalId);
        }
    }, [syncInterval, handleSync]);

    // Sync on window focus
    useEffect(() => {
        if (syncOnFocus) {
            window.addEventListener('focus', handleSync);
            return () => window.removeEventListener('focus', handleSync);
        }
    }, [syncOnFocus, handleSync]);

    // Sync on network reconnect
    useEffect(() => {
        if (syncOnReconnect) {
            window.addEventListener('online', handleSync);
            return () => window.removeEventListener('online', handleSync);
        }
    }, [syncOnReconnect, handleSync]);

    // Background sync
    useEffect(() => {
        if (syncOnBackgroundSync && 'serviceWorker' in navigator) {
            const handleBackgroundSync = (event: Event) => {
                const syncEvent = event as ServiceWorkerMessageEvent;
                if (syncEvent.tag === 'sync-offline-data') {
                    syncEvent.waitUntil(handleSync());
                }
            };
            navigator.serviceWorker.addEventListener('sync', handleBackgroundSync);
            return () =>
                navigator.serviceWorker.removeEventListener(
                    'sync',
                    handleBackgroundSync
                );
        }
    }, [syncOnBackgroundSync, handleSync]);

    return null;
}

interface ServiceWorkerMessageEvent extends Event {
    readonly tag: string;
    waitUntil(f: Promise<void>): void;
}