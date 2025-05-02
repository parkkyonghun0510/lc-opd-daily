import { useState, useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { ProcessedReport } from '@/types/reports';

export type FilterState = {
    searchTerm: string;
    branchFilter: string;
    reportTypeFilter: string;
    statusFilter: string;
    sortField: string;
    sortDirection: 'asc' | 'desc';
    dateRange: {
        from?: Date;
        to?: Date;
    };
    currentPage: number;
};

export const useApprovalFilters = (initialReports: ProcessedReport[] = []) => {
    // Persist filter preferences
    const [filterState, setFilterState] = useLocalStorage<FilterState>('approvalFilters', {
        searchTerm: '',
        branchFilter: 'all',
        reportTypeFilter: 'all',
        statusFilter: 'pending_approval',
        sortField: 'date',
        sortDirection: 'desc',
        dateRange: {},
        currentPage: 1,
    });

    // Memoize filter functions
    const filterReports = useCallback((reports: ProcessedReport[]) => {
        return reports.filter(report => {
            if (filterState.branchFilter !== 'all' && report.branchId !== filterState.branchFilter) {
                return false;
            }

            if (filterState.reportTypeFilter !== 'all' && report.reportType !== filterState.reportTypeFilter) {
                return false;
            }

            if (filterState.dateRange.from || filterState.dateRange.to) {
                const reportDate = new Date(report.date);
                if (filterState.dateRange.from && reportDate < filterState.dateRange.from) {
                    return false;
                }
                if (filterState.dateRange.to && reportDate > filterState.dateRange.to) {
                    return false;
                }
            }

            if (filterState.searchTerm) {
                const search = filterState.searchTerm.toLowerCase();
                return (
                    report.branch.name.toLowerCase().includes(search) ||
                    (report.user?.name || '').toLowerCase().includes(search) ||
                    (report.user?.username || '').toLowerCase().includes(search) ||
                    report.date.includes(search)
                );
            }

            return true;
        });
    }, [filterState]);

    // Memoize sort function
    const sortReports = useCallback((reports: ProcessedReport[]) => {
        return [...reports].sort((a, b) => {
            let valueA: string | number | Date;
            let valueB: string | number | Date;

            switch (filterState.sortField) {
                case 'date':
                    valueA = new Date(a.date);
                    valueB = new Date(b.date);
                    break;
                case 'branch':
                    valueA = a.branch.name;
                    valueB = b.branch.name;
                    break;
                case 'created':
                    valueA = new Date(a.submittedAt);
                    valueB = new Date(b.submittedAt);
                    break;
                case 'writeOffs':
                    valueA = a.writeOffs;
                    valueB = b.writeOffs;
                    break;
                case 'ninetyPlus':
                    valueA = a.ninetyPlus;
                    valueB = b.ninetyPlus;
                    break;
                default:
                    valueA = new Date(a.date);
                    valueB = new Date(b.date);
            }

            const compareResult = valueA instanceof Date && valueB instanceof Date
                ? valueA.getTime() - valueB.getTime()
                : typeof valueA === 'string'
                    ? valueA.localeCompare(valueB as string)
                    : (valueA as number) - (valueB as number);

            return filterState.sortDirection === 'asc' ? compareResult : -compareResult;
        });
    }, [filterState.sortField, filterState.sortDirection]);

    // Memoize filtered and sorted reports
    const processedReports = useMemo(() => {
        const filtered = filterReports(initialReports);
        return sortReports(filtered);
    }, [initialReports, filterReports, sortReports]);

    const updateFilter = useCallback((key: keyof FilterState, value: any) => {
        setFilterState(prev => ({
            ...prev,
            [key]: value,
            // Reset to first page when filters change
            currentPage: key !== 'currentPage' ? 1 : prev.currentPage,
        }));
    }, [setFilterState]);

    const resetFilters = useCallback(() => {
        setFilterState({
            searchTerm: '',
            branchFilter: 'all',
            reportTypeFilter: 'all',
            statusFilter: 'pending_approval',
            sortField: 'date',
            sortDirection: 'desc',
            dateRange: {},
            currentPage: 1,
        });
    }, [setFilterState]);

    return {
        filters: filterState,
        processedReports,
        updateFilter,
        resetFilters,
    };
};