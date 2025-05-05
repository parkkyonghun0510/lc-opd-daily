'use client';

import { useOffline } from '@/components/providers/OfflineProvider';
import { cn } from '@/lib/utils';
import { useEffect, useState, useCallback } from 'react';
import { WifiOff, CloudOff, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
import { Button } from './button';

interface OfflineStatusIndicatorProps {
    className?: string;
    retryInterval?: number; // in milliseconds
}

export function OfflineStatusIndicator({
    className,
    retryInterval = 30000 // default 30 seconds
}: OfflineStatusIndicatorProps) {
    const { isOffline, syncStatus, hasPendingSync, lastSyncTime } = useOffline();
    const [retrying, setRetrying] = useState(false);
    const [nextRetryTime, setNextRetryTime] = useState<number | null>(null);

    const attemptReconnect = useCallback(async () => {
        if (!isOffline) return;

        setRetrying(true);
        try {
            const response = await fetch('/api/health-check');
            if (response.ok) {
                // Force reload to restore online status
                window.location.reload();
            }
        } catch (error) {
            // Set next retry time
            setNextRetryTime(Date.now() + retryInterval);
        } finally {
            setRetrying(false);
        }
    }, [isOffline, retryInterval]);

    // Auto-retry logic
    useEffect(() => {
        if (!isOffline) {
            setNextRetryTime(null);
            return;
        }

        const retryTimer = setInterval(attemptReconnect, retryInterval);
        return () => clearInterval(retryTimer);
    }, [isOffline, retryInterval, attemptReconnect]);

    const getStatusIcon = () => {
        if (isOffline) return <WifiOff className="h-4 w-4" />;
        if (syncStatus === 'syncing') return <RefreshCw className="h-4 w-4 animate-spin" />;
        if (syncStatus === 'error') return <AlertCircle className="h-4 w-4" />;
        if (hasPendingSync) return <CloudOff className="h-4 w-4" />;
        return <Check className="h-4 w-4" />;
    };

    const getStatusText = () => {
        if (isOffline) return retrying ? 'Attempting to Reconnect...' : 'Offline Mode';
        if (syncStatus === 'syncing') return 'Syncing...';
        if (syncStatus === 'error') return 'Sync Error';
        if (hasPendingSync) return 'Changes Pending';
        return 'All Changes Synced';
    };

    const getStatusClass = () => {
        if (isOffline) return 'bg-yellow-100 text-yellow-800';
        if (syncStatus === 'syncing') return 'bg-blue-100 text-blue-800';
        if (syncStatus === 'error') return 'bg-red-100 text-red-800';
        if (hasPendingSync) return 'bg-orange-100 text-orange-800';
        return 'bg-green-100 text-green-800';
    };

    const getLastSyncText = () => {
        if (!lastSyncTime) return 'Never synced';
        const timeDiff = Date.now() - lastSyncTime;
        const minutes = Math.floor(timeDiff / 60000);
        if (minutes < 1) return 'Last synced less than a minute ago';
        if (minutes === 1) return 'Last synced 1 minute ago';
        return `Last synced ${minutes} minutes ago`;
    };

    const getRetryText = () => {
        if (!nextRetryTime) return '';
        const timeLeft = Math.ceil((nextRetryTime - Date.now()) / 1000);
        return timeLeft > 0 ? `Next retry in ${timeLeft}s` : '';
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger>
                    <div
                        className={cn(
                            'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium',
                            getStatusClass(),
                            className
                        )}
                    >
                        {getStatusIcon()}
                        <span className="hidden sm:inline">{getStatusText()}</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <div className="text-sm">
                        <p className="font-semibold">{getStatusText()}</p>
                        <p className="text-xs text-muted-foreground">{getLastSyncText()}</p>
                        {isOffline && nextRetryTime && (
                            <p className="text-xs text-muted-foreground mt-1">
                                {getRetryText()}
                            </p>
                        )}
                        {isOffline && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 w-full"
                                onClick={attemptReconnect}
                                disabled={retrying}
                            >
                                {retrying ? (
                                    <>
                                        <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                                        Checking Connection...
                                    </>
                                ) : (
                                    'Try to Reconnect'
                                )}
                            </Button>
                        )}
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}