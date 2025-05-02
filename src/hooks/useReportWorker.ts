import { useEffect, useCallback } from 'react';
import { useErrorMonitoring } from './useErrorMonitoring';

interface WorkerMessage {
    type: string;
    payload: any;
}

export function useReportWorker() {
    const { logError } = useErrorMonitoring();
    const worker = new Worker(new URL('../workers/reports.worker.ts', import.meta.url));

    const processReports = useCallback((reports: any[]) => {
        return new Promise((resolve, reject) => {
            const handleMessage = (e: MessageEvent<WorkerMessage>) => {
                const { type, payload } = e.data;

                if (type === 'REPORTS_PROCESSED') {
                    worker.removeEventListener('message', handleMessage);
                    resolve(payload);
                } else if (type === 'ERROR') {
                    worker.removeEventListener('message', handleMessage);
                    reject(new Error(payload.message));
                }
            };

            worker.addEventListener('message', handleMessage);
            worker.postMessage({ type: 'PROCESS_REPORTS', payload: reports });
        });
    }, [worker]);

    const cacheReports = useCallback((reports: any[]) => {
        return new Promise((resolve, reject) => {
            const handleMessage = (e: MessageEvent<WorkerMessage>) => {
                const { type, payload } = e.data;

                if (type === 'REPORTS_CACHED') {
                    worker.removeEventListener('message', handleMessage);
                    resolve(payload);
                } else if (type === 'ERROR') {
                    worker.removeEventListener('message', handleMessage);
                    reject(new Error(payload.message));
                }
            };

            worker.addEventListener('message', handleMessage);
            worker.postMessage({ type: 'CACHE_REPORTS', payload: reports });
        });
    }, [worker]);

    const analyzeTrends = useCallback((reports: any[]) => {
        return new Promise((resolve, reject) => {
            const handleMessage = (e: MessageEvent<WorkerMessage>) => {
                const { type, payload } = e.data;

                if (type === 'TRENDS_ANALYZED') {
                    worker.removeEventListener('message', handleMessage);
                    resolve(payload);
                } else if (type === 'ERROR') {
                    worker.removeEventListener('message', handleMessage);
                    reject(new Error(payload.message));
                }
            };

            worker.addEventListener('message', handleMessage);
            worker.postMessage({ type: 'ANALYZE_TRENDS', payload: reports });
        });
    }, [worker]);

    // Handle worker errors
    useEffect(() => {
        const handleError = (error: ErrorEvent) => {
            logError({
                message: 'Web Worker Error',
                componentName: 'ReportWorker',
                context: { error: error.message }
            });
        };

        worker.addEventListener('error', handleError);

        return () => {
            worker.removeEventListener('error', handleError);
            worker.terminate();
        };
    }, [worker, logError]);

    return {
        processReports,
        cacheReports,
        analyzeTrends
    };
}