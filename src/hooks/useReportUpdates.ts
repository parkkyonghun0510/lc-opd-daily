import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/components/ui/use-toast';

interface ReportUpdate {
    type: 'new' | 'updated' | 'deleted';
    reportId?: string;
    branchId?: string;
}

export function useReportUpdates(onUpdate: () => void) {
    const [isConnected, setIsConnected] = useState(false);

    const setupSSE = useCallback((retryCount = 0) => {
        try {
            // Enhanced diagnostic logging
            console.log('[ReportUpdates] Setting up SSE connection...', {
                retryCount,
                browserSupport: typeof EventSource !== 'undefined',
                timestamp: new Date().toISOString(),
                url: '/api/reports/updates'
            });

            const eventSource = new EventSource('/api/reports/updates', {
                withCredentials: true // Include credentials if needed for authentication
            });

            eventSource.onopen = () => {
                setIsConnected(true);
                console.log('[ReportUpdates] SSE connection established', {
                    readyState: eventSource.readyState,
                    url: eventSource.url,
                    timestamp: new Date().toISOString()
                });
            };

            eventSource.onerror = (error) => {
                const errorDetails = {
                    error,
                    readyState: eventSource.readyState,
                    url: eventSource.url,
                    timestamp: new Date().toISOString(),
                    errorCode: error?.type || 'UNKNOWN',
                    statusCode: (error as any)?.status || 'N/A',
                    retryCount
                };
                
                console.error('[ReportUpdates] SSE connection error:', errorDetails);
                setIsConnected(false);
                eventSource.close();

                // Limit retry attempts to prevent infinite reconnection
                if (retryCount < 5) {
                    // Attempt to reconnect with exponential backoff
                    const retryDelay = Math.min(30000, Math.pow(2, retryCount) * 1000);
                    console.log(`[ReportUpdates] Attempting SSE reconnection in ${retryDelay}ms (attempt ${retryCount + 1})`);
                    setTimeout(() => setupSSE(retryCount + 1), retryDelay);
                } else {
                    console.error('[ReportUpdates] Max SSE reconnection attempts reached. Please refresh the page to retry.');
                    toast({
                        title: 'Connection Lost',
                        description: 'Unable to establish real-time updates. Please refresh the page.',
                        variant: 'destructive',
                    });
                }
            };

            eventSource.addEventListener('report-update', (event) => {
                try {
                    const update: ReportUpdate = JSON.parse(event.data);

                    switch (update.type) {
                        case 'new':
                            toast({
                                title: 'New Report Available',
                                description: 'A new report has been submitted for review.',
                                variant: 'default',
                            });
                            break;
                        case 'updated':
                            toast({
                                title: 'Report Updated',
                                description: 'A report has been updated.',
                                variant: 'default',
                            });
                            break;
                        case 'deleted':
                            toast({
                                title: 'Report Removed',
                                description: 'A report has been removed.',
                                variant: 'default',
                            });
                            break;
                    }

                    // Trigger refresh of reports list
                    onUpdate();
                } catch (error) {
                    console.error('Error processing SSE update:', error);
                }
            });

            return () => {
                eventSource.close();
                setIsConnected(false);
            };
        } catch (error) {
            const errorDetails = {
                error,
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                browserSupport: typeof EventSource !== 'undefined',
                timestamp: new Date().toISOString(),
                retryCount
            };
            
            console.error('[ReportUpdates] Error setting up SSE:', errorDetails);
            
            if (typeof EventSource === 'undefined') {
                console.warn('[ReportUpdates] EventSource (SSE) is not supported in this browser');
                toast({
                    title: 'Browser Not Supported',
                    description: 'Real-time updates are not supported in your browser. Please use a modern browser.',
                    variant: 'destructive',
                });
            } else {
                setIsConnected(false);
                
                // Retry setup on error with backoff
                if (retryCount < 5) {
                    const retryDelay = Math.min(30000, Math.pow(2, retryCount) * 1000);
                    console.log(`[ReportUpdates] Retrying SSE setup in ${retryDelay}ms (attempt ${retryCount + 1})`);
                    setTimeout(() => setupSSE(retryCount + 1), retryDelay);
                }
            }
        }
    }, [onUpdate]);

    useEffect(() => {
        const cleanup = setupSSE();
        return () => {
            if (cleanup) cleanup();
        };
    }, [setupSSE]);

    return { isConnected };
}