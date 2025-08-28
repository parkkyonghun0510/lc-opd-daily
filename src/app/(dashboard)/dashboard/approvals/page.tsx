"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useUserData } from "@/contexts/UserDataContext";
import { PendingReport } from "@/components/reports/PendingReport";
import { getBranchById } from "@/lib/api/branches";
import { useHybridRealtime } from "@/auth/store";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import {
  AlertCircle,
  RefreshCw,
  Bell,
  LayoutGrid,
  LayoutList,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Pagination } from "@/components/ui/pagination";
import { ApprovalsTable } from "@/components/reports/ApprovalsTable";
import { MobileApprovalFilters } from "@/components/reports/MobileApprovalFilters";
import { useApprovalFilterReducer } from "@/hooks/useApprovalFilterReducer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useErrorMonitoring } from "@/hooks/useErrorMonitoring";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { ShortcutHelpDialog } from "@/components/ShortcutHelpDialog";
import { PerformanceMonitor } from "@/components/PerformanceMonitor";
import { useReportData } from "@/hooks/useReportData";
import { exportReports } from "@/utils/exportReports";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PrintDialog } from "@/components/reports/PrintDialog";
import { PrintableReport } from "@/components/reports/PrintableReport";
import { useReactToPrint } from "react-to-print";
import { flushSync } from "react-dom";
import { raceConditionManager } from "@/lib/sync/race-condition-manager";

// Enhanced types with better validation
export type FilterState = {
  searchTerm: string;
  branchFilter: string;
  reportTypeFilter: string;
  statusFilter: string;
  dateRange: {
    from?: Date;
    to?: Date;
  };
  sortField: 'date' | 'created' | 'branch' | 'writeOffs' | 'ninetyPlus';
  sortDirection: 'asc' | 'desc';
  currentPage: number;
};

export type ViewMode = 'card' | 'table';

type ReportStatus = "pending" | "pending_approval" | "approved" | "rejected";

export interface ProcessedReport {
  id: string;
  branchId: string;
  writeOffs: number;
  ninetyPlus: number;
  status: ReportStatus;
  reportType: string;
  content?: string;
  submittedBy?: string;
  date: string;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  comments: string | null;
  planReportId: string | null;
  branch: {
    id: string;
    name: string;
    code: string;
  };
  user?: {
    id: string;
    name: string;
    username: string;
  };
  ReportComment: Array<{
    id: string;
    content: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
    reportId: string;
    user: {
      id: string;
      name: string;
      username: string;
    }
  }>;
}

interface Branch {
  id: string;
  name: string;
  code?: string;
}

// Enhanced state management with stability improvements
interface StableState {
  isRefreshing: boolean;
  lastRefreshTime: number;
  operationInProgress: boolean;
  criticalError: string | null;
}

export default function EnhancedApprovalsPage() {
  const { isConnected } = useHybridRealtime();
  const { toast } = useToast();
  const { logError, trackEvent, measurePerformance } = useErrorMonitoring();
  const printRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const operationLockRef = useRef<Set<string>>(new Set());

  // Enhanced filter state with race condition protection
  const {
    state: filters,
    setSearch,
    setBranchFilter,
    setReportTypeFilter,
    setStatusFilter,
    setSortField,
    toggleSortDirection,
    setDateRange,
    setPage,
    resetFilters
  } = useApprovalFilterReducer();

  // Enhanced report data loading with stability improvements
  const {
    reports,
    loading,
    error,
    lastUpdated,
    trends,
    refresh
  } = useReportData({
    statusFilter: filters.statusFilter,
    pollingInterval: 30000,
    onNewReport: () => setNewReportNotification(true)
  });

  // Enhanced state management
  const [branches, setBranches] = useState<Record<string, Branch>>({});
  const [stableState, setStableState] = useState<StableState>({
    isRefreshing: false,
    lastRefreshTime: 0,
    operationInProgress: false,
    criticalError: null
  });
  const [newReportNotification, setNewReportNotification] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [printOptions, setPrintOptions] = useState({
    includeAnalytics: true,
    includeComments: true
  });

  // View mode with proper persistence
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("approvalsViewMode");
        return (saved === "table" ? "table" : "card") as ViewMode;
      } catch {
        return "card";
      }
    }
    return "card";
  });

  // Race condition safe refresh with operation locking
  const handleRefresh = useCallback(async () => {
    const operationKey = 'refresh-reports';
    
    if (operationLockRef.current.has(operationKey)) {
      console.log('Refresh already in progress, skipping...');
      return;
    }

    try {
      operationLockRef.current.add(operationKey);
      
      // Use race condition manager for safe execution
      await raceConditionManager.withStateLock(
        'approval-refresh',
        'data-refresh',
        async () => {
          if (!mountedRef.current) return;
          
          setStableState(prev => ({ 
            ...prev, 
            isRefreshing: true,
            operationInProgress: true 
          }));
          setNewReportNotification(false);
          
          await refresh();
          
          if (mountedRef.current) {
            setStableState(prev => ({ 
              ...prev, 
              lastRefreshTime: Date.now(),
              criticalError: null
            }));
          }
        },
        10000 // 10 second timeout
      );
    } catch (error) {
      console.error('Error refreshing reports:', error);
      if (mountedRef.current) {
        setStableState(prev => ({ 
          ...prev, 
          criticalError: error instanceof Error ? error.message : 'Refresh failed'
        }));
        toast({
          title: 'Refresh Failed',
          description: 'Unable to refresh reports. Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      operationLockRef.current.delete(operationKey);
      if (mountedRef.current) {
        setStableState(prev => ({ 
          ...prev, 
          isRefreshing: false,
          operationInProgress: false 
        }));
      }
    }
  }, [refresh, toast]);

  // Enhanced print handling with proper state management
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Reports_${new Date().toISOString().split('T')[0]}`,
    onBeforePrint: async () => {
      await Promise.resolve();
      trackEvent('reports_printed', {
        reportCount: memoizedSortedData.length,
        options: printOptions
      });
    },
    onPrintError: (error: Error | string) => {
      console.error('Print error:', error);
      toast({
        title: 'Print Failed',
        description: 'Failed to generate printable report',
        variant: 'destructive',
      });
      logError({
        message: 'Print failed',
        componentName: 'EnhancedApprovalsPage',
        context: { error: typeof error === 'string' ? error : error.message }
      });
    }
  } as any); // Temporary fix for type compatibility

  const handlePrintWithOptions = useCallback((options: typeof printOptions) => {
    try {
      flushSync(() => {
        setPrintOptions(options);
      });
      handlePrint();
    } catch (error) {
      console.error('Print options error:', error);
      toast({
        title: 'Print Error',
        description: 'Unable to set print options',
        variant: 'destructive',
      });
    }
  }, [handlePrint, toast]);

  // Enhanced data processing with validation
  const memoizedFilteredData = useMemo(() => {
    if (!reports || !Array.isArray(reports)) return [];
    
    try {
      return reports.filter(report => {
        // Validate report structure
        if (!report || typeof report !== 'object') return false;
        if (!report.id || !report.branchId) return false;
        
        // Apply filters with proper validation
        if (filters.branchFilter !== "all" && report.branchId !== filters.branchFilter) return false;
        if (filters.reportTypeFilter !== "all" && report.reportType !== filters.reportTypeFilter) return false;

        if (filters.dateRange.from || filters.dateRange.to) {
          try {
            const reportDate = new Date(report.date);
            if (isNaN(reportDate.getTime())) return false;
            if (filters.dateRange.from && reportDate < filters.dateRange.from) return false;
            if (filters.dateRange.to && reportDate > filters.dateRange.to) return false;
          } catch {
            return false;
          }
        }

        if (filters.searchTerm) {
          const search = filters.searchTerm.toLowerCase();
          try {
            return (
              (report.branch?.name || "").toLowerCase().includes(search) ||
              (report.user?.name || "").toLowerCase().includes(search) ||
              (report.user?.username || "").toLowerCase().includes(search) ||
              (report.date || "").includes(search)
            );
          } catch {
            return false;
          }
        }
        return true;
      });
    } catch (error) {
      console.error('Error filtering data:', error);
      logError({
        message: 'Data filtering failed',
        componentName: 'EnhancedApprovalsPage',
        context: { filtersCount: Object.keys(filters).length }
      });
      return [];
    }
  }, [reports, filters, logError]);

  const memoizedSortedData = useMemo(() => {
    if (!Array.isArray(memoizedFilteredData)) return [];
    
    try {
      return [...memoizedFilteredData].sort((a, b) => {
        const getValue = (item: ProcessedReport) => {
          try {
            switch (filters.sortField) {
              case "date": return new Date(item.date);
              case "branch": return item.branch?.name || "";
              case "created": return new Date(item.submittedAt);
              case "writeOffs": return Number(item.writeOffs) || 0;
              case "ninetyPlus": return Number(item.ninetyPlus) || 0;
              default: return new Date(item.date);
            }
          } catch {
            return new Date(0); // Fallback for invalid dates
          }
        };

        const valueA = getValue(a);
        const valueB = getValue(b);

        try {
          if (valueA instanceof Date && valueB instanceof Date) {
            const timeA = valueA.getTime();
            const timeB = valueB.getTime();
            return filters.sortDirection === "asc" ? timeA - timeB : timeB - timeA;
          }

          return filters.sortDirection === "asc"
            ? String(valueA).localeCompare(String(valueB))
            : String(valueB).localeCompare(String(valueA));
        } catch {
          return 0; // Fallback for comparison errors
        }
      });
    } catch (error) {
      console.error('Error sorting data:', error);
      return memoizedFilteredData;
    }
  }, [memoizedFilteredData, filters.sortField, filters.sortDirection]);

  const memoizedPaginatedData = useMemo(() => {
    try {
      const startIndex = (filters.currentPage - 1) * 10;
      const endIndex = startIndex + 10;
      return memoizedSortedData.slice(startIndex, endIndex);
    } catch (error) {
      console.error('Error paginating data:', error);
      return [];
    }
  }, [memoizedSortedData, filters.currentPage]);

  // Enhanced approval completion handler with race protection
  const handleApprovalComplete = useCallback(async () => {
    const operationKey = 'approval-complete';
    
    if (operationLockRef.current.has(operationKey)) {
      console.log('Approval refresh already in progress');
      return;
    }

    try {
      operationLockRef.current.add(operationKey);
      
      await raceConditionManager.executeInSequence(
        'approval-operations',
        async () => {
          if (mountedRef.current) {
            await refresh();
          }
        },
        { timeout: 15000 }
      );
    } catch (error) {
      console.error('Error handling approval completion:', error);
      if (mountedRef.current) {
        toast({
          title: 'Update Failed',
          description: 'Failed to refresh after approval',
          variant: 'destructive',
        });
      }
    } finally {
      operationLockRef.current.delete(operationKey);
    }
  }, [refresh, toast]);

  // Enhanced filter change handler with debouncing
  const handleFilterChange = useCallback(
    raceConditionManager.debounce((filterType: string, value: any) => {
      if (!mountedRef.current) return;
      
      try {
        trackEvent('filter_changed', {
          filterType,
          value,
          currentFilters: filters
        });

        switch (filterType) {
          case 'search':
            setSearch(value);
            break;
          case 'branch':
            setBranchFilter(value);
            break;
          case 'reportType':
            setReportTypeFilter(value);
            break;
          case 'status':
            setStatusFilter(value);
            break;
          case 'dateRange':
            setDateRange(value);
            break;
          default:
            console.warn('Unknown filter type:', filterType);
        }
      } catch (error) {
        console.error('Error changing filter:', error);
        logError({
          message: 'Filter change failed',
          componentName: 'EnhancedApprovalsPage',
          context: { filterType, error: error instanceof Error ? error.message : String(error) }
        });
      }
    }, 300),
    [filters, setSearch, setBranchFilter, setReportTypeFilter, setStatusFilter, setDateRange, trackEvent, logError]
  );

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    try {
      trackEvent('view_mode_changed', { mode });
      setViewMode(mode);
      localStorage.setItem("approvalsViewMode", mode);
    } catch (error) {
      console.error('Error changing view mode:', error);
    }
  }, [trackEvent]);

  // Enhanced export with better error handling
  const handleExport = useCallback(async (format: 'csv' | 'xlsx') => {
    if (isExporting) {
      toast({
        title: 'Export in Progress',
        description: 'Please wait for the current export to complete',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    try {
      const result = await exportReports(memoizedSortedData, trends, {
        format,
        includeAnalytics: true,
        onProgress: (progress) => {
          if (mountedRef.current) {
            setExportProgress(progress);
          }
        }
      });

      if (result.success) {
        toast({
          title: 'Export Successful',
          description: `Reports exported as ${result.fileName}`,
        });
        trackEvent('reports_exported', {
          format,
          reportCount: memoizedSortedData.length,
          includeAnalytics: true
        });
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to export reports';
      toast({
        title: 'Export Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      logError({
        message: 'Export failed',
        componentName: 'EnhancedApprovalsPage',
        context: {
          format,
          error: errorMessage,
          reportCount: memoizedSortedData.length
        }
      });
    } finally {
      if (mountedRef.current) {
        setIsExporting(false);
        setExportProgress(0);
      }
    }
  }, [memoizedSortedData, trends, toast, trackEvent, logError, isExporting]);

  // Enhanced keyboard shortcuts
  const { getShortcutDescriptions } = useKeyboardShortcuts([
    {
      key: 'r',
      ctrl: true,
      action: handleRefresh,
      description: 'Refresh reports'
    },
    {
      key: 'f',
      ctrl: true,
      action: () => {
        try {
          const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]');
          searchInput?.focus();
        } catch (error) {
          console.error('Error focusing search:', error);
        }
      },
      description: 'Focus search'
    },
    {
      key: 'v',
      ctrl: true,
      action: () => handleViewModeChange(viewMode === 'card' ? 'table' : 'card'),
      description: 'Toggle view mode'
    },
    {
      key: 'c',
      ctrl: true,
      action: resetFilters,
      description: 'Clear all filters'
    }
  ]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      operationLockRef.current.clear();
    };
  }, []);

  // Safe report processing with validation
  const processReport = useCallback((report: ProcessedReport) => {
    try {
      return {
        ...report,
        createdAt: new Date(report.createdAt).toString(),
        updatedAt: new Date(report.updatedAt).toString(),
        submittedAt: new Date(report.submittedAt).toString(),
        ReportComment: (report.ReportComment || []).map((comment) => ({
          ...comment,
          createdAt: new Date(comment.createdAt).toString(),
          updatedAt: new Date(comment.updatedAt).toString()
        }))
      };
    } catch (error) {
      console.error('Error processing report:', error);
      return {
        ...report,
        createdAt: new Date().toString(),
        updatedAt: new Date().toString(),
        submittedAt: new Date().toString(),
        ReportComment: []
      }; // Return safe fallback
    }
  }, []);

  return (
    <PerformanceMonitor pageId="enhanced-approvals">
      <ErrorBoundary>
        <main role="main" aria-label="Enhanced Approvals Dashboard">
          <DashboardHeader
            heading="Report Approvals"
            text="Review, approve, and manage all reports with enhanced stability."
          />

          <div className="mt-6 space-y-4">
            {/* Enhanced Status Indicators */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
              <div className="flex items-center gap-2">
                <div className="border rounded-md p-1" role="group" aria-label="View mode selection">
                  <Button
                    variant={viewMode === "card" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleViewModeChange("card")}
                    className="h-8 px-2"
                    aria-pressed={viewMode === "card"}
                    aria-label="Card view"
                    disabled={stableState.operationInProgress}
                  >
                    <LayoutGrid className="h-4 w-4 mr-1" aria-hidden="true" />
                    Cards
                  </Button>
                  <Button
                    variant={viewMode === "table" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleViewModeChange("table")}
                    className="h-8 px-2"
                    aria-pressed={viewMode === "table"}
                    aria-label="Table view"
                    disabled={stableState.operationInProgress}
                  >
                    <LayoutList className="h-4 w-4 mr-1" aria-hidden="true" />
                    Table
                  </Button>
                </div>
                <ShortcutHelpDialog shortcuts={getShortcutDescriptions()} />
              </div>

              <div className="flex items-center gap-2">
                {!isConnected && (
                  <div className="flex items-center text-yellow-500" role="status">
                    <AlertCircle className="h-4 w-4 mr-1" aria-hidden="true" />
                    <span className="text-xs font-medium">Connecting...</span>
                  </div>
                )}
                {newReportNotification && (
                  <div className="flex items-center text-amber-500 animate-pulse" role="status">
                    <Bell className="h-4 w-4 mr-1" aria-hidden="true" />
                    <span className="text-xs font-medium">New report available</span>
                  </div>
                )}
                {stableState.operationInProgress && (
                  <div className="flex items-center text-blue-500" role="status">
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" />
                    <span className="text-xs font-medium">Processing...</span>
                  </div>
                )}
                
                <PrintDialog
                  onPrint={handlePrintWithOptions}
                  disabled={loading || reports.length === 0 || stableState.operationInProgress}
                />
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1"
                      disabled={loading || reports.length === 0 || isExporting || stableState.operationInProgress}
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleExport('xlsx')}>
                      Export as Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport('csv')}>
                      Export as CSV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={stableState.isRefreshing || stableState.operationInProgress}
                  className="flex items-center gap-1"
                  aria-label={stableState.isRefreshing ? "Refreshing reports" : "Refresh reports"}
                >
                  <RefreshCw
                    className={cn("h-4 w-4", stableState.isRefreshing && "animate-spin")}
                    aria-hidden="true"
                  />
                  {stableState.isRefreshing ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            </div>

            {/* Enhanced Error Display */}
            {(error || stableState.criticalError) && (
              <Alert variant="destructive" role="alert">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {error || stableState.criticalError}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleRefresh}
                    className="ml-2"
                  >
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Enhanced Filters */}
            <MobileApprovalFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              onResetFilters={resetFilters}
              onToggleSortDirection={toggleSortDirection}
              onSetSortField={setSortField}
              branches={branches}
              resultsCount={memoizedSortedData.length}
              currentPage={filters.currentPage}
              totalPages={Math.ceil(memoizedSortedData.length / 10)}
            />

            {/* Enhanced Content Display */}
            {loading ? (
              <LoadingSpinner />
            ) : memoizedPaginatedData.length === 0 ? (
              <Card>
                <CardContent className="pt-6 pb-6 text-center">
                  <div className="py-8 text-gray-500" role="status">
                    <p className="text-lg font-medium mb-2">No Reports Found</p>
                    <p className="text-sm">
                      {error ? 'Please try refreshing the page.' : 'There are no reports that match your filters.'}
                    </p>
                    {error && (
                      <Button 
                        variant="outline" 
                        onClick={handleRefresh}
                        className="mt-4"
                        disabled={stableState.isRefreshing}
                      >
                        Try Again
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <section aria-label="Reports List">
                {viewMode === "card" ? (
                  <div className="space-y-4">
                    {memoizedPaginatedData.map((report) => (
                      <PendingReport
                        key={`${report.id}-${report.updatedAt}`} // Enhanced key for better updates
                        report={processReport(report)}
                        branchName={report.branch?.name || "Unknown Branch"}
                        branchCode={report.branch?.code || ''}
                        onApprovalComplete={handleApprovalComplete}
                      />
                    ))}
                  </div>
                ) : (
                  <ApprovalsTable
                    reports={memoizedPaginatedData.map(processReport)}
                    onApprovalComplete={handleApprovalComplete}
                  />
                )}

                {Math.ceil(memoizedSortedData.length / 10) > 1 && (
                  <nav className="flex justify-center my-6" aria-label="Pagination">
                    <Pagination
                      currentPage={filters.currentPage}
                      totalPages={Math.ceil(memoizedSortedData.length / 10)}
                      onPageChange={setPage}
                    />
                  </nav>
                )}
              </section>
            )}
          </div>

          {/* Enhanced Printable Content */}
          <div className="absolute -left-[9999px] -top-[9999px] h-0 w-0 overflow-hidden">
            <PrintableReport
              ref={printRef}
              reports={memoizedSortedData}
              trends={trends}
              printOptions={printOptions}
            />
          </div>

          {/* Enhanced Progress Indicator */}
          <ProgressIndicator
            isOpen={isExporting}
            progress={exportProgress}
            message={`Exporting reports... ${exportProgress}%`}
          />
        </main>
      </ErrorBoundary>
    </PerformanceMonitor>
  );
}