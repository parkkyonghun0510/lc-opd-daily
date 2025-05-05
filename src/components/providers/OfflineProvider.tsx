'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useStore } from '@/store';
import { StoreSynchronizer } from './StoreSynchronizer';
import { toast } from '@/components/ui/use-toast';

interface OfflineContextType {
    isOffline: boolean;
    syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
    hasPendingSync: boolean;
    lastSyncTime: number | null;
}

const OfflineContext = createContext<OfflineContextType>({
    isOffline: false,
    syncStatus: 'idle',
    hasPendingSync: false,
    lastSyncTime: null,
});

export function OfflineProvider({ children }: { children: React.ReactNode }) {
    const {
        syncStatus,
        pendingSync,
        lastSyncTime,
        getOfflineData,
    } = useStore();

    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    // Monitor online/offline status
    useEffect(() => {
        const handleOnline = () => {
            setIsOffline(false);
            toast({
                title: "Back Online",
                description: "Syncing data...",
                variant: "default",
            });
        };

        const handleOffline = () => {
            setIsOffline(true);
            toast({
                title: "You're Offline",
                description: "Changes will sync when connection is restored",
                variant: "default",
            });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Load initial offline data
    useEffect(() => {
        getOfflineData();
    }, [getOfflineData]);

    const value = {
        isOffline,
        syncStatus,
        hasPendingSync: pendingSync,
        lastSyncTime,
    };

    return (
        <OfflineContext.Provider value={value}>
            <StoreSynchronizer
                syncInterval={300}
                syncOnFocus={true}
                syncOnReconnect={true}
                syncOnBackgroundSync={true}
            />
            {children}
        </OfflineContext.Provider>
    );
}

// Custom hook to use offline context
export function useOffline() {
    const context = useContext(OfflineContext);
    if (!context) {
        throw new Error('useOffline must be used within an OfflineProvider');
    }
    return context;
}