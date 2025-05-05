import { useState, useEffect, useCallback, useRef } from 'react';
import { useApiCache } from './useApiCache';
import { useErrorMonitoring } from './useErrorMonitoring';
import { fetchPendingReportsAction } from '@/app/_actions/report-actions';
import { useReportWorker } from './useReportWorker';

interface UseReportDataProps {
    statusFilter: string;
    pollingInterval?: number; // in milliseconds
    onNewReport?: () => void;
}

export function useReportData({
    statusFilter,
    pollingInterval = 30000, // 30 seconds default
    onNewReport
}: UseReportDataProps) {
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [trends, setTrends] = useState<any>(null);

    const apiCache = useApiCache({ ttl: pollingInterval });
    const { logError, measurePerformance } = useErrorMonitoring();
    const { processReports, cacheReports, analyzeTrends } = useReportWorker();
    const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastReportCountRef = useRef<number>(0);

    const fetchReports = useCallback(async (force = false) => {
        const startTime = performance.now();
        const cacheKey = `reports_${statusFilter}`;

        try {
            // Check cache unless forced refresh
            if (!force) {
                const cachedData = apiCache.get(cacheKey);
                if (cachedData) {
                    setReports(cachedData as any[]);
                    setLoading(false);
                    return;
                }
            }

            const result = await fetchPendingReportsAction(statusFilter);

            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch reports');
            }

            // Process reports in web worker
            const processedReports = await processReports(result.reports || []);

            // Cache the processed reports
            await cacheReports(processedReports as any[]);

            // Analyze trends in background
            analyzeTrends(processedReports as any[]).then(trendsData => {
                setTrends(trendsData);
            }).catch(error => {
                console.error('Failed to analyze trends:', error);
            });

            // Check for new reports
            const typedReports = processedReports as any[];
            if (lastReportCountRef.current && typedReports.length > lastReportCountRef.current) {
                onNewReport?.();
            }

            lastReportCountRef.current = typedReports.length;
            apiCache.set(cacheKey, typedReports);
            setReports(typedReports);
            setLastUpdated(new Date());
            setError(null);

            // Measure performance
            const endTime = performance.now();
            measurePerformance('reports_fetch_time', endTime - startTime);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
            setError(errorMessage);
            logError({
                message: errorMessage,
                componentName: 'useReportData',
                context: { statusFilter }
            });
        } finally {
            setLoading(false);
        }
    }, [statusFilter, apiCache, logError, measurePerformance, onNewReport, processReports, cacheReports, analyzeTrends]);

    // Set up polling
    useEffect(() => {
        // Initial fetch
        fetchReports();

        // Set up polling interval
        pollingTimeoutRef.current = setInterval(() => {
            fetchReports(true); // Force fetch on poll
        }, pollingInterval);

        return () => {
            if (pollingTimeoutRef.current) {
                clearInterval(pollingTimeoutRef.current);
            }
        };
    }, [fetchReports, pollingInterval]);

    // Force refresh method
    const refresh = useCallback(() => {
        apiCache.clear();
        return fetchReports(true);
    }, [apiCache, fetchReports]);

    return {
        reports,
        loading,
        error,
        lastUpdated,
        trends, // Add trends to the returned values
        refresh
    };
}