"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useUserData } from "@/contexts/UserDataContext";
import { PendingReport } from "@/components/reports/PendingReport";
import { getBranchById } from "@/lib/api/branches";
import { useHybridRealtime } from "@/auth/store";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Filter,
  Search,
  SortAsc,
  SortDesc,
  RefreshCw,
  Bell,
  Calendar,
  FilterX,
  LayoutGrid,
  LayoutList,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchPendingReportsAction } from "@/app/_actions/report-actions";
import { Pagination } from "@/components/ui/pagination";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ApprovalsTable } from "@/components/reports/ApprovalsTable";
import { useApprovalFilterReducer } from "@/hooks/useApprovalFilterReducer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useReportUpdates } from "@/hooks/useReportUpdates";
import { useErrorMonitoring } from "@/hooks/useErrorMonitoring";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { ShortcutHelpDialog } from "@/components/ShortcutHelpDialog";
import { PerformanceMonitor } from "@/components/PerformanceMonitor";
import { useApiCache } from "@/hooks/useApiCache";
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
import type { UseReactToPrintOptions } from "react-to-print";

// Types
export type FilterState = {
  searchTerm: string;
  branchFilter: string;
  reportTypeFilter: string;
  statusFilter: string;
  dateRange: {
    from?: Date;
    to?: Date;
  };
  sortField: "date" | "created" | "branch" | "writeOffs" | "ninetyPlus";
  sortDirection: "asc" | "desc";
  currentPage: number;
};

export type ViewMode = "card" | "table";

const sortOptions = {
  date: "Report Date",
  created: "Submission Date",
  branch: "Branch",
  writeOffs: "Write-offs",
  ninetyPlus: "90+ Days",
} as const;

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

type ReportStatus = "pending" | "pending_approval" | "approved" | "rejected";

// API response report type - matches the server response
// Used as a reference for the ProcessedReport interface
// We keep this as documentation even though it's not directly used
/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
interface ApiReport {
  id: string;
  branchId: string;
  writeOffs: number;
  ninetyPlus: number;
  status: string;
  reportType: string;
  content?: string;
  submittedBy?: string;
  date: string; // API returns date as string
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
    };
  }>;
}

// Type for the processed report with proper status type
export interface ProcessedReport {
  id: string;
  branchId: string;
  writeOffs: number;
  ninetyPlus: number;
  status: ReportStatus;
  reportType: string;
  content?: string;
  submittedBy?: string;
  date: string; // Keep as string for consistency
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
    };
  }>;
}

interface Branch {
  id: string;
  name: string;
  code?: string;
}

export default function ApprovalsPage() {
  const { toast } = useToast();
  const { logError, trackEvent, measurePerformance } = useErrorMonitoring();
  const printRef = useRef<HTMLDivElement>(null);

  // Use the filter reducer first to avoid reference issues
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
    resetFilters,
  } = useApprovalFilterReducer();

  // Load report data with proper filter dependency
  const { reports, loading, error, lastUpdated, trends, refresh } =
    useReportData({
      statusFilter: filters.statusFilter,
      pollingInterval: 30000,
      onNewReport: () => setNewReportNotification(true),
    });

  const [branches, setBranches] = useState<Record<string, Branch>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [newReportNotification, setNewReportNotification] =
    useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [printOptions, setPrintOptions] = useState({
    includeAnalytics: true,
    includeComments: true,
  });

  // Handle refresh with proper dependency
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setNewReportNotification(false);
    refresh().finally(() => {
      setRefreshing(false);
    });
  }, [refresh]);

  const { isConnected } = useReportUpdates(handleRefresh);

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Reports_${new Date().toISOString().split("T")[0]}`,
    onBeforePrint: async () => {
      await Promise.resolve(); // Ensure it returns a Promise
      trackEvent("reports_printed", {
        reportCount: memoizedSortedData.length,
        options: printOptions,
      });
    },
    onPrintError: (error: Error | string) => {
      console.error("Print error:", error);
      toast({
        title: "Print Failed",
        description: "Failed to generate printable report",
        variant: "destructive",
      });
      logError({
        message: "Print failed",
        componentName: "ApprovalsPage",
        context: { error: typeof error === "string" ? error : error.message },
      });
    },
  } as UseReactToPrintOptions);

  const handlePrintWithOptions = useCallback(
    (options: typeof printOptions) => {
      setPrintOptions(options);
      handlePrint();
    },
    [handlePrint],
  );

  // View mode state
  const [viewMode, setViewMode] = useState<"card" | "table">(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("approvalsViewMode") === "table"
        ? "table"
        : "card";
    }
    return "card";
  });

  // Update keyboard shortcuts to properly type the error parameter
  const { getShortcutDescriptions } = useKeyboardShortcuts([
    {
      key: "r",
      ctrl: true,
      action: handleRefresh,
      description: "Refresh reports",
    },
    {
      key: "f",
      ctrl: true,
      action: () =>
        document
          .querySelector<HTMLInputElement>('input[placeholder*="Search"]')
          ?.focus(),
      description: "Focus search",
    },
    {
      key: "v",
      ctrl: true,
      action: () =>
        handleViewModeChange(viewMode === "card" ? "table" : "card"),
      description: "Toggle view mode",
    },
    {
      key: "c",
      ctrl: true,
      action: resetFilters,
      description: "Clear all filters",
    },
    {
      key: "ArrowLeft",
      alt: true,
      action: () => setPage(Math.max(1, filters.currentPage - 1)),
      description: "Previous page",
    },
    {
      key: "ArrowRight",
      alt: true,
      action: () =>
        setPage(
          Math.min(
            Math.ceil(memoizedSortedData.length / 10),
            filters.currentPage + 1,
          ),
        ),
      description: "Next page",
    },
    {
      key: "e",
      ctrl: true,
      action: () => handleExport("xlsx"),
      description: "Export as Excel",
    },
    {
      key: "e",
      ctrl: true,
      shift: true,
      action: () => handleExport("csv"),
      description: "Export as CSV",
    },
    {
      key: "p",
      ctrl: true,
      action: () =>
        handlePrintWithOptions({
          includeAnalytics: true,
          includeComments: true,
        }),
      description: "Print full report",
    },
    {
      key: "p",
      ctrl: true,
      shift: true,
      action: () =>
        handlePrintWithOptions({
          includeAnalytics: false,
          includeComments: false,
        }),
      description: "Print basic report",
    },
  ]);

  // Memoize filtered and transformed data
  const memoizedFilteredData = useMemo(() => {
    if (!reports.length) return [];
    return reports.filter((report) => {
      if (
        filters.branchFilter !== "all" &&
        report.branchId !== filters.branchFilter
      )
        return false;
      if (
        filters.reportTypeFilter !== "all" &&
        report.reportType !== filters.reportTypeFilter
      )
        return false;

      if (filters.dateRange.from || filters.dateRange.to) {
        const reportDate = new Date(report.date);
        if (filters.dateRange.from && reportDate < filters.dateRange.from)
          return false;
        if (filters.dateRange.to && reportDate > filters.dateRange.to)
          return false;
      }

      if (filters.searchTerm) {
        const search = filters.searchTerm.toLowerCase();
        return (
          report.branch.name.toLowerCase().includes(search) ||
          (report.user?.name || "").toLowerCase().includes(search) ||
          (report.user?.username || "").toLowerCase().includes(search) ||
          report.date.includes(search)
        );
      }
      return true;
    });
  }, [reports, filters]);

  const memoizedSortedData = useMemo(() => {
    return [...memoizedFilteredData].sort((a, b) => {
      const getValue = (item: ProcessedReport) => {
        switch (filters.sortField) {
          case "date":
            return new Date(item.date);
          case "branch":
            return item.branch.name;
          case "created":
            return new Date(item.submittedAt);
          case "writeOffs":
            return Number(item.writeOffs);
          case "ninetyPlus":
            return Number(item.ninetyPlus);
          default:
            return new Date(item.date);
        }
      };

      const valueA = getValue(a);
      const valueB = getValue(b);

      if (valueA instanceof Date && valueB instanceof Date) {
        return filters.sortDirection === "asc"
          ? valueA.getTime() - valueB.getTime()
          : valueB.getTime() - valueA.getTime();
      }

      return filters.sortDirection === "asc"
        ? String(valueA).localeCompare(String(valueB))
        : String(valueB).localeCompare(String(valueA));
    });
  }, [memoizedFilteredData, filters.sortField, filters.sortDirection]);

  const memoizedPaginatedData = useMemo(() => {
    const startIndex = (filters.currentPage - 1) * 10;
    const endIndex = startIndex + 10;
    return memoizedSortedData.slice(startIndex, endIndex);
  }, [memoizedSortedData, filters.currentPage]);

  const handleApprovalComplete = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleFilterChange = useCallback(
    (filterType: string, value: any) => {
      trackEvent("filter_changed", {
        filterType,
        value,
        currentFilters: filters,
      });

      switch (filterType) {
        case "search":
          setSearch(value);
          break;
        case "branch":
          setBranchFilter(value);
          break;
        case "reportType":
          setReportTypeFilter(value);
          break;
        case "status":
          setStatusFilter(value);
          break;
        case "dateRange":
          setDateRange(value);
          break;
      }
    },
    [
      filters,
      setSearch,
      setBranchFilter,
      setReportTypeFilter,
      setStatusFilter,
      setDateRange,
      trackEvent,
    ],
  );

  const handleViewModeChange = useCallback(
    (mode: "card" | "table") => {
      trackEvent("view_mode_changed", { mode });
      setViewMode(mode);
    },
    [trackEvent],
  );

  const handleExport = useCallback(
    async (format: "csv" | "xlsx") => {
      setIsExporting(true);
      setExportProgress(0);

      try {
        const result = await exportReports(memoizedSortedData, trends, {
          format,
          includeAnalytics: true,
          onProgress: (progress) => setExportProgress(progress),
        });

        if (result.success) {
          toast({
            title: "Export Successful",
            description: `Reports exported as ${result.fileName}`,
          });
          trackEvent("reports_exported", {
            format,
            reportCount: memoizedSortedData.length,
            includeAnalytics: true,
          });
        } else {
          throw new Error(result.error || "Export failed");
        }
      } catch (error) {
        console.error("Export error:", error);
        toast({
          title: "Export Failed",
          description:
            error instanceof Error ? error.message : "Failed to export reports",
          variant: "destructive",
        });
        logError({
          message: "Export failed",
          componentName: "ApprovalsPage",
          context: {
            format,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      } finally {
        setIsExporting(false);
        setExportProgress(0);
      }
    },
    [memoizedSortedData, trends, toast, trackEvent, logError],
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("approvalsViewMode", viewMode);
    }
  }, [viewMode]);

  const processReport = (report: ProcessedReport) => ({
    ...report,
    createdAt: report.createdAt.toString(),
    updatedAt: report.updatedAt.toString(),
    submittedAt: report.submittedAt.toString(),
    ReportComment: report.ReportComment?.map((comment) => ({
      ...comment,
      createdAt: comment.createdAt.toString(),
      updatedAt: comment.updatedAt.toString(),
    })),
  });

  return (
    <PerformanceMonitor pageId="approvals">
      <ErrorBoundary>
        <main role="main" aria-label="Approvals Dashboard">
          <DashboardHeader
            heading="Report Approvals"
            text="Review, approve, and manage all reports in a unified interface."
          />

          <div className="mt-6 space-y-4">
            {/* Add trends summary before the filters card */}
            {/* {trends && <TrendsSummary trends={trends} />} */}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="border rounded-md p-1"
                  role="group"
                  aria-label="View mode selection"
                >
                  <Button
                    variant={viewMode === "card" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleViewModeChange("card")}
                    className="h-8 px-2"
                    aria-pressed={viewMode === "card"}
                    aria-label="Card view"
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
                  >
                    <LayoutList className="h-4 w-4 mr-1" aria-hidden="true" />
                    Table
                  </Button>
                </div>
                <ShortcutHelpDialog shortcuts={getShortcutDescriptions()} />
              </div>

              <div className="flex items-center gap-2">
                {!isConnected && (
                  <div
                    className="flex items-center text-yellow-500"
                    role="status"
                  >
                    <AlertCircle className="h-4 w-4 mr-1" aria-hidden="true" />
                    <span className="text-xs font-medium">Connecting...</span>
                  </div>
                )}
                {newReportNotification && (
                  <div
                    className="flex items-center text-amber-500 animate-pulse"
                    role="status"
                  >
                    <Bell className="h-4 w-4 mr-1" aria-hidden="true" />
                    <span className="text-xs font-medium">
                      New report available
                    </span>
                  </div>
                )}
                <PrintDialog
                  onPrint={handlePrintWithOptions}
                  disabled={loading || reports.length === 0}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1"
                      disabled={loading || reports.length === 0}
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                      Export as Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("csv")}>
                      Export as CSV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="flex items-center gap-1"
                  aria-label={
                    refreshing ? "Refreshing reports" : "Refresh reports"
                  }
                >
                  <RefreshCw
                    className={cn("h-4 w-4", refreshing && "animate-spin")}
                    aria-hidden="true"
                  />
                  {refreshing ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            </div>

            {/* Filters Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-md flex items-center">
                  <Filter className="h-4 w-4 mr-2" aria-hidden="true" />
                  Filter Reports
                </CardTitle>
                <CardDescription>
                  Filter reports by status, branch, type, and date range
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="grid grid-cols-1 md:grid-cols-3 gap-4"
                  role="search"
                >
                  <div className="flex items-center space-x-2">
                    <Search
                      className="h-4 w-4 text-gray-500"
                      aria-hidden="true"
                    />
                    <Input
                      placeholder="Search branch, user..."
                      value={filters.searchTerm}
                      onChange={(e) =>
                        handleFilterChange("search", e.target.value)
                      }
                      className="flex-1"
                      aria-label="Search reports"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      id="branch-filter-label"
                      className="text-sm font-medium text-gray-500"
                    >
                      Branch
                    </label>
                    <Select
                      value={filters.branchFilter}
                      onValueChange={(value) =>
                        handleFilterChange("branch", value)
                      }
                      aria-labelledby="branch-filter-label"
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-label="Filter by Branch"
                      >
                        <SelectValue placeholder="All Branches" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Branches</SelectItem>
                        {Object.values(branches)
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label
                      id="report-type-filter-label"
                      className="text-sm font-medium text-gray-500"
                    >
                      Report Type
                    </label>
                    <Select
                      value={filters.reportTypeFilter}
                      onValueChange={(value) =>
                        handleFilterChange("reportType", value)
                      }
                      aria-labelledby="report-type-filter-label"
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-label="Filter by Report Type"
                      >
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="plan">Plan</SelectItem>
                        <SelectItem value="actual">Actual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-1">
                    <label
                      id="status-filter-label"
                      className="text-sm font-medium text-gray-500"
                    >
                      Status
                    </label>
                    <Select
                      value={filters.statusFilter}
                      onValueChange={(value) =>
                        handleFilterChange("status", value)
                      }
                      aria-labelledby="status-filter-label"
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-label="Filter by Status"
                      >
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label
                      id="date-range-filter-label"
                      className="text-sm font-medium text-gray-500"
                    >
                      Date Range
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                          aria-labelledby="date-range-filter-label"
                        >
                          <Calendar
                            className="mr-2 h-4 w-4"
                            aria-hidden="true"
                          />
                          {filters.dateRange?.from ? (
                            filters.dateRange.to ? (
                              <>
                                {format(filters.dateRange.from, "LLL dd, y")} -{" "}
                                {format(filters.dateRange.to, "LLL dd, y")}
                              </>
                            ) : (
                              format(filters.dateRange.from, "LLL dd, y")
                            )
                          ) : (
                            <span>Pick a date range</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          initialFocus
                          mode="range"
                          defaultMonth={filters.dateRange?.from}
                          selected={filters.dateRange as any}
                          onSelect={(range) =>
                            handleFilterChange("dateRange", range as any)
                          }
                          numberOfMonths={2}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-gray-500" role="status">
                    {memoizedSortedData.length} reports found, showing page{" "}
                    {filters.currentPage} of{" "}
                    {Math.ceil(memoizedSortedData.length / 10)}
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetFilters}
                      className="text-xs mr-2"
                      aria-label="Reset all filters"
                    >
                      <FilterX className="h-3 w-3 mr-1" aria-hidden="true" />
                      Reset Filters
                    </Button>

                    <label
                      id="sort-select-label"
                      className="text-sm font-medium mr-2"
                    >
                      Sort by:
                    </label>
                    <Select
                      value={filters.sortField}
                      onValueChange={setSortField}
                      aria-labelledby="sort-select-label"
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Sort by Date" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(sortOptions).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleSortDirection}
                      aria-label={`Sort ${filters.sortDirection === "asc" ? "ascending" : "descending"}`}
                    >
                      {filters.sortDirection === "asc" ? (
                        <SortAsc className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <SortDesc className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {error && (
              <Alert variant="destructive" role="alert">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {loading ? (
              <LoadingSpinner />
            ) : memoizedPaginatedData.length === 0 ? (
              <Card>
                <CardContent className="pt-6 pb-6 text-center">
                  <div className="py-8 text-gray-500" role="status">
                    <p className="text-lg font-medium mb-2">No Reports Found</p>
                    <p className="text-sm">
                      There are no reports that match your filters.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <section aria-label="Reports List">
                {viewMode === "card" ? (
                  <div className="space-y-4">
                    {memoizedPaginatedData.map((report) => (
                      <PendingReport
                        key={report.id}
                        report={processReport(report)}
                        branchName={report.branch?.name || "Unknown Branch"}
                        branchCode={report.branch?.code || ""}
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
                  <nav
                    className="flex justify-center my-6"
                    aria-label="Pagination"
                  >
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

          {/* Add hidden printable content */}
          <div className="hidden">
            <PrintableReport
              ref={printRef}
              reports={memoizedSortedData}
              trends={trends}
              printOptions={printOptions}
            />
          </div>

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
