import { useEffect, useCallback, useRef } from 'react';
import { useErrorMonitoring } from './useErrorMonitoring';

interface WorkerMessage {
    type: string;
    payload: any;
}

export function useReportWorker() {
    const { logError } = useErrorMonitoring();
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            workerRef.current = new Worker(new URL('../workers/reports.worker.ts', import.meta.url));

            const handleError = (error: ErrorEvent) => {
                logError({
                    message: 'Web Worker Error',
                    componentName: 'ReportWorker',
                    context: { error: error.message }
                });
            };

            workerRef.current.addEventListener('error', handleError);

            return () => {
                if (workerRef.current) {
                    workerRef.current.removeEventListener('error', handleError);
                    workerRef.current.terminate();
                }
            };
        }
    }, [logError]);

    const processReports = useCallback((reports: any[]) => {
        return new Promise((resolve, reject) => {
            if (!workerRef.current) {
                reject(new Error('Web Worker not initialized'));
                return;
            }

            const handleMessage = (e: MessageEvent<WorkerMessage>) => {
                const { type, payload } = e.data;

                if (type === 'REPORTS_PROCESSED') {
                    workerRef.current?.removeEventListener('message', handleMessage);
                    resolve(payload);
                } else if (type === 'ERROR') {
                    workerRef.current?.removeEventListener('message', handleMessage);
                    reject(new Error(payload.message));
                }
            };

            workerRef.current.addEventListener('message', handleMessage);
            workerRef.current.postMessage({ type: 'PROCESS_REPORTS', payload: reports });
        });
    }, []);

    const cacheReports = useCallback((reports: any[]) => {
        return new Promise((resolve, reject) => {
            if (!workerRef.current) {
                reject(new Error('Web Worker not initialized'));
                return;
            }

            const handleMessage = (e: MessageEvent<WorkerMessage>) => {
                const { type, payload } = e.data;

                if (type === 'REPORTS_CACHED') {
                    workerRef.current?.removeEventListener('message', handleMessage);
                    resolve(payload);
                } else if (type === 'ERROR') {
                    workerRef.current?.removeEventListener('message', handleMessage);
                    reject(new Error(payload.message));
                }
            };

            workerRef.current.addEventListener('message', handleMessage);
            workerRef.current.postMessage({ type: 'CACHE_REPORTS', payload: reports });
        });
    }, []);

    const analyzeTrends = useCallback((reports: any[]) => {
        return new Promise((resolve, reject) => {
            if (!workerRef.current) {
                reject(new Error('Web Worker not initialized'));
                return;
            }

            const handleMessage = (e: MessageEvent<WorkerMessage>) => {
                const { type, payload } = e.data;

                if (type === 'TRENDS_ANALYZED') {
                    workerRef.current?.removeEventListener('message', handleMessage);
                    resolve(payload);
                } else if (type === 'ERROR') {
                    workerRef.current?.removeEventListener('message', handleMessage);
                    reject(new Error(payload.message));
                }
            };

            workerRef.current.addEventListener('message', handleMessage);
            workerRef.current.postMessage({ type: 'ANALYZE_TRENDS', payload: reports });
        });
    }, []);

    return {
        processReports,
        cacheReports,
        analyzeTrends
    };
}