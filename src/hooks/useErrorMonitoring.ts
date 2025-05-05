import { useCallback } from 'react';

interface ErrorDetails {
    message: string;
    stack?: string;
    componentName?: string;
    context?: Record<string, unknown>;
}

export function useErrorMonitoring() {
    const logError = useCallback(async (error: ErrorDetails) => {
        try {
            await fetch('/api/monitoring/error', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    timestamp: new Date().toISOString(),
                    ...error,
                }),
            });
        } catch (e) {
            console.error('Failed to log error:', e);
        }
    }, []);

    const trackEvent = useCallback(async (eventName: string, data?: Record<string, unknown>) => {
        try {
            await fetch('/api/monitoring/event', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    eventName,
                    timestamp: new Date().toISOString(),
                    data,
                }),
            });
        } catch (e) {
            console.error('Failed to track event:', e);
        }
    }, []);

    const measurePerformance = useCallback((metric: string, value: number) => {
        try {
            if (window.performance && window.performance.mark) {
                window.performance.mark(metric);
            }

            fetch('/api/monitoring/performance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    metric,
                    value,
                    timestamp: new Date().toISOString(),
                }),
            });
        } catch (e) {
            console.error('Failed to log performance metric:', e);
        }
    }, []);

    return {
        logError,
        trackEvent,
        measurePerformance,
    };
}