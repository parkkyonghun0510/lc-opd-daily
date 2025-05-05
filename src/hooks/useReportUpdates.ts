import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/components/ui/use-toast';

interface ReportUpdate {
    type: 'new' | 'updated' | 'deleted';
    reportId?: string;
    branchId?: string;
}

export function useReportUpdates(onUpdate: () => void) {
    const [isConnected, setIsConnected] = useState(false);

    const setupSSE = useCallback(() => {
        try {
            const eventSource = new EventSource('/api/reports/updates');

            eventSource.onopen = () => {
                setIsConnected(true);
                console.log('SSE connection established');
            };

            eventSource.onerror = (error) => {
                console.error('SSE connection error:', error);
                setIsConnected(false);
                eventSource.close();

                // Attempt to reconnect after 5 seconds
                setTimeout(setupSSE, 5000);
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
            console.error('Error setting up SSE:', error);
            setIsConnected(false);
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