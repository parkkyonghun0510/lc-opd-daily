import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useApiCache } from './useApiCache';
import { useErrorMonitoring } from './useErrorMonitoring';
import { fetchPendingReportsAction } from '@/app/_actions/report-actions';
import { raceConditionManager } from '@/lib/sync/race-condition-manager';

interface UseOptimizedReportDataProps {
    statusFilter: string;
    pollingInterval?: number;
    onNewReport?: (newCount: number) => void;
    enableBackgroundRefresh?: boolean;
    enableOptimisticUpdates?: boolean;
    prefetchRelatedData?: boolean;
    cacheStrategy?: 'aggressive' | 'conservative' | 'dynamic';
}

interface ReportCacheEntry {
    data: any[];
    timestamp: number;
    etag?: string;
    lastModified?: string;
    version: number;
}

interface ReportStats {
    totalReports: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    avgProcessingTime: number;
}

export function useOptimizedReportData({
    statusFilter,
    pollingInterval = 30000,
    onNewReport,
    enableBackgroundRefresh = true,
    enableOptimisticUpdates = true,
    prefetchRelatedData = true,
    cacheStrategy = 'dynamic'
}: UseOptimizedReportDataProps) {
    // Core state
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [trends, setTrends] = useState<any>(null);
    const [stats, setStats] = useState<ReportStats | null>(null);

    // Performance tracking
    const [fetchDuration, setFetchDuration] = useState<number>(0);
    const [cacheHitRate, setCacheHitRate] = useState<number>(0);
    const [backgroundUpdates, setBackgroundUpdates] = useState<number>(0);

    // Internal state
    const [isBackgroundFetching, setIsBackgroundFetching] = useState(false);
    const [pendingUpdates, setPendingUpdates] = useState<any[]>([]);

    // Refs for cleanup and state management
    const apiCache = useApiCache({ ttl: getCacheTTL(cacheStrategy, pollingInterval) });
    const { logError, measurePerformance } = useErrorMonitoring();
    const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastReportCountRef = useRef<number>(0);
    const cacheHitsRef = useRef<number>(0);
    const cacheMissesRef = useRef<number>(0);
    const mountedRef = useRef(true);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Dynamic cache key generation
    const cacheKey = useMemo(() => {
        const baseKey = `reports_${statusFilter}`;
        if (cacheStrategy === 'dynamic') {
            // Include timestamp for dynamic caching
            const roundedTime = Math.floor(Date.now() / (pollingInterval / 2));
            return `${baseKey}_${roundedTime}`;
        }
        return baseKey;
    }, [statusFilter, cacheStrategy, pollingInterval]);

    // Cache TTL calculation based on strategy
    function getCacheTTL(strategy: string, interval: number): number {
        switch (strategy) {
            case 'aggressive': return interval * 3; // Cache for 3x polling interval
            case 'conservative': return interval / 2; // Cache for half polling interval
            case 'dynamic': return interval; // Cache for exactly polling interval
            default: return interval;
        }
    }

    // Optimistic update for immediate UI feedback
    const applyOptimisticUpdate = useCallback((reportId: string, changes: Partial<any>) => {
        if (!enableOptimisticUpdates) return;

        setReports(prevReports => 
            prevReports.map(report => 
                report.id === reportId ? { ...report, ...changes } : report
            )
        );

        // Store pending update for rollback if needed
        setPendingUpdates(prev => [...prev, { reportId, changes, timestamp: Date.now() }]);
    }, [enableOptimisticUpdates]);

    // Enhanced fetch with intelligent caching and background updates
    const fetchReports = useCallback(async (
        force = false,
        isBackground = false
    ): Promise<any[]> => {
        const startTime = performance.now();
        
        try {
            // Cancel previous request if still running
            if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
                abortControllerRef.current.abort();
            }

            // Create new abort controller
            abortControllerRef.current = new AbortController();
            const { signal } = abortControllerRef.current;

            // Check cache unless forced refresh
            if (!force) {
                const cachedEntry = apiCache.get(cacheKey) as ReportCacheEntry;
                if (cachedEntry && Date.now() - cachedEntry.timestamp < getCacheTTL(cacheStrategy, pollingInterval)) {
                    cacheHitsRef.current++;
                    
                    if (!isBackground) {
                        setReports(cachedEntry.data);
                        setLoading(false);
                    }
                    
                    // Still fetch in background if enabled and not loading initially
                    if (enableBackgroundRefresh && !loading && !isBackground) {
                        setBackgroundUpdates(prev => prev + 1);
                        setTimeout(() => fetchReports(true, true), 100);
                    }
                    
                    return cachedEntry.data;
                }
                cacheMissesRef.current++;
            }

            // Set loading state only for foreground requests
            if (!isBackground && mountedRef.current) {
                setIsBackgroundFetching(isBackground);
                if (!isBackground) setLoading(true);
            }

            // Fetch data with race condition protection
            const result = await raceConditionManager.preventDuplicateRequest(
                `fetch-reports-${statusFilter}`,
                async () => {
                    if (signal.aborted) throw new Error('Request aborted');
                    return await fetchPendingReportsAction(statusFilter);
                },
                { allowConcurrent: isBackground }
            );

            if (signal.aborted) return reports; // Return current reports if aborted

            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch reports');
            }

            const fetchedReports = result.reports || [];

            // Calculate stats
            const newStats: ReportStats = {
                totalReports: fetchedReports.length,
                pendingCount: fetchedReports.filter((r: any) => r.status === 'pending_approval').length,
                approvedCount: fetchedReports.filter((r: any) => r.status === 'approved').length,
                rejectedCount: fetchedReports.filter((r: any) => r.status === 'rejected').length,
                avgProcessingTime: 0 // Calculate based on submission to approval time
            };

            // Check for new reports
            const previousCount = lastReportCountRef.current;
            if (previousCount > 0 && fetchedReports.length > previousCount) {
                const newReportsCount = fetchedReports.length - previousCount;
                onNewReport?.(newReportsCount);
            }
            lastReportCountRef.current = fetchedReports.length;

            // Update cache with enhanced entry
            const cacheEntry: ReportCacheEntry = {
                data: fetchedReports,
                timestamp: Date.now(),
                version: Date.now(), // Use timestamp as version
            };
            apiCache.set(cacheKey, cacheEntry);

            // Update state only if component is mounted
            if (mountedRef.current) {
                setReports(fetchedReports);
                setStats(newStats);
                setLastUpdated(new Date());
                setError(null);
                
                // Clear pending optimistic updates on successful fetch
                setPendingUpdates([]);
            }

            // Measure performance
            const endTime = performance.now();
            const duration = endTime - startTime;
            setFetchDuration(duration);
            measurePerformance('optimized_reports_fetch_time', duration);

            // Prefetch related data if enabled
            if (prefetchRelatedData && !isBackground) {
                setTimeout(() => prefetchRelatedDataAsync(fetchedReports), 500);
            }

            return fetchedReports;

        } catch (error) {
            if (abortControllerRef.current?.signal.aborted) {
                console.log('Fetch request was aborted');
                return reports;
            }

            const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
            
            if (mountedRef.current) {
                setError(errorMessage);
                
                // Rollback optimistic updates on error
                if (pendingUpdates.length > 0) {
                    setReports(prevReports => {
                        // Remove optimistic updates
                        let rolledBackReports = [...prevReports];
                        pendingUpdates.forEach(update => {
                            const index = rolledBackReports.findIndex(r => r.id === update.reportId);
                            if (index !== -1) {
                                // Remove the optimistic changes
                                const original = { ...rolledBackReports[index] };
                                Object.keys(update.changes).forEach(key => {
                                    delete original[key];
                                });
                                rolledBackReports[index] = original;
                            }
                        });
                        return rolledBackReports;
                    });
                    setPendingUpdates([]);
                }
            }

            logError({
                message: errorMessage,
                componentName: 'useOptimizedReportData',
                context: { 
                    statusFilter, 
                    isBackground, 
                    force,
                    cacheStrategy,
                    cacheKey
                }
            });

            return reports; // Return current reports on error
        } finally {
            if (mountedRef.current) {
                setLoading(false);
                setIsBackgroundFetching(false);
            }
        }
    }, [
        statusFilter, 
        apiCache, 
        cacheKey, 
        cacheStrategy, 
        pollingInterval,
        enableBackgroundRefresh,
        loading,
        reports,
        onNewReport,
        prefetchRelatedData,
        measurePerformance,
        logError,
        pendingUpdates
    ]);

    // Prefetch related data (branches, users, etc.)
    const prefetchRelatedDataAsync = useCallback(async (reportsData: any[]) => {
        try {
            // Extract unique branch IDs and user IDs for prefetching
            const branchIds = [...new Set(reportsData.map(r => r.branchId))];
            const userIds = [...new Set(reportsData.map(r => r.submittedBy).filter(Boolean))];

            // Prefetch in background without blocking UI
            Promise.allSettled([
                // Prefetch branch data
                ...branchIds.slice(0, 10).map(id => 
                    raceConditionManager.preventDuplicateRequest(
                        `prefetch-branch-${id}`,
                        () => fetch(`/api/branches/${id}`).then(r => r.json()),
                        { allowConcurrent: true }
                    )
                ),
                // Prefetch user data
                ...userIds.slice(0, 10).map(id =>
                    raceConditionManager.preventDuplicateRequest(
                        `prefetch-user-${id}`,
                        () => fetch(`/api/users/${id}`).then(r => r.json()),
                        { allowConcurrent: true }
                    )
                )
            ]).then(results => {
                console.log('Prefetched related data:', results.length, 'requests');
            });
        } catch (error) {
            console.warn('Prefetch failed:', error);
        }
    }, []);

    // Enhanced polling with adaptive intervals
    useEffect(() => {
        let currentInterval = pollingInterval;
        
        const adaptivePolling = () => {
            // Reduce polling frequency when tab is not visible
            if (typeof document !== 'undefined' && document.hidden) {
                currentInterval = pollingInterval * 3;
            } else if (error) {
                // Increase frequency temporarily after errors
                currentInterval = Math.max(pollingInterval / 2, 5000);
            } else {
                currentInterval = pollingInterval;
            }

            pollingTimeoutRef.current = setTimeout(() => {
                fetchReports(true, true).then(() => {
                    if (mountedRef.current) {
                        adaptivePolling();
                    }
                });
            }, currentInterval);
        };

        // Initial fetch
        fetchReports(false, false);

        // Start adaptive polling
        adaptivePolling();

        // Listen for visibility changes
        const handleVisibilityChange = () => {
            if (!document.hidden && mountedRef.current) {
                // Fetch immediately when tab becomes visible
                fetchReports(true, false);
            }
        };

        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', handleVisibilityChange);
        }

        return () => {
            if (pollingTimeoutRef.current) {
                clearTimeout(pollingTimeoutRef.current);
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            if (typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            }
        };
    }, [fetchReports, pollingInterval, error]);

    // Cleanup on unmount
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Calculate cache hit rate
    const currentCacheHitRate = useMemo(() => {
        const total = cacheHitsRef.current + cacheMissesRef.current;
        return total > 0 ? (cacheHitsRef.current / total) * 100 : 0;
    }, [reports]); // Recalculate when reports change

    useEffect(() => {
        setCacheHitRate(currentCacheHitRate);
    }, [currentCacheHitRate]);

    // Force refresh method
    const refresh = useCallback(() => {
        apiCache.clear();
        return fetchReports(true, false);
    }, [apiCache, fetchReports]);

    // Invalidate specific cache entries
    const invalidateCache = useCallback((pattern?: string) => {
        if (pattern) {
            apiCache.invalidate(pattern);
        } else {
            apiCache.clear();
        }
    }, [apiCache]);

    return {
        // Core data
        reports,
        loading,
        error,
        lastUpdated,
        trends,
        stats,

        // Performance metrics
        fetchDuration,
        cacheHitRate,
        backgroundUpdates,
        isBackgroundFetching,

        // Control methods
        refresh,
        invalidateCache,
        applyOptimisticUpdate,

        // Cache management
        cacheKey,
        pendingUpdates: pendingUpdates.length,
    };
}