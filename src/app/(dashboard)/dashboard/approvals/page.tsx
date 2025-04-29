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
  LayoutList
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// Import dashboard events types if needed in the future
// import { DashboardEventTypes } from "@/lib/events/dashboardEvents";
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
    }
  }>;
}

// Type for the processed report with proper status type
interface ProcessedReport {
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
    }
  }>;
}

interface Branch {
  id: string;
  name: string;
}

export default function ApprovalsPage() {
  const { toast } = useToast();
  const { } = useUserData(); // Keep the hook but don't use userData directly
  const [reports, setReports] = useState<ProcessedReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<ProcessedReport[]>([]);
  const [branches, setBranches] = useState<Record<string, Branch>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newReportNotification, setNewReportNotification] = useState<boolean>(false);
  // Initialize view mode from localStorage if available
  const [viewMode, setViewMode] = useState<"card" | "table">(() => {
    // Only run in browser environment
    if (typeof window !== "undefined") {
      const savedViewMode = localStorage.getItem("approvalsViewMode");
      return (savedViewMode === "table" ? "table" : "card");
    }
    return "card";
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReports, setTotalReports] = useState(0);
  const reportsPerPage = 10;

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [reportTypeFilter, setReportTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [dateRange, setDateRange] = useState<{
    from?: Date;
    to?: Date;
  }>({});

  // Reference to track if auto-refresh is needed
  const autoRefreshNeeded = useRef(false);

  // Import the hybrid realtime hook to enable active polling when needed
  const { enableActivePolling } = useHybridRealtime();

  // Enable active polling when user performs actions that require updates
  const enablePollingForAction = useCallback((action: string) => {
    enableActivePolling(`approvals page - ${action}`);
  }, [enableActivePolling]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use the server action to fetch reports with the current status filter
      const result = await fetchPendingReportsAction(statusFilter);

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch reports");
      }

      const apiReports = result.reports || [];

      // Process and convert API reports to ProcessedReport type
      // Using type assertion since we know the structure matches
      const processedReports = apiReports.map(report => ({
        ...report,
        status: report.status as ReportStatus,
        // Convert Decimal objects to numbers
        writeOffs: typeof report.writeOffs === 'object' ? Number(report.writeOffs) : report.writeOffs,
        ninetyPlus: typeof report.ninetyPlus === 'object' ? Number(report.ninetyPlus) : report.ninetyPlus,
      })) as ProcessedReport[];

      // Store all reports for filtering
      setReports(processedReports);

      // Fetch branch data for each report if needed
      const branchesRecord: Record<string, Branch> = { ...branches };
      for (const report of processedReports) {
        if (report.branchId && !branchesRecord[report.branchId]) {
          try {
            // Only fetch if we don't already have the branch data from the API
            if (!report.branch) {
              const branchData = await getBranchById(report.branchId);
              branchesRecord[report.branchId] = branchData;
            } else {
              branchesRecord[report.branchId] = {
                id: report.branchId,
                name: report.branch.name,
              };
            }
          } catch (error) {
            console.error(
              `Failed to fetch branch ${report.branchId}:`,
              error
            );
            branchesRecord[report.branchId] = {
              id: report.branchId,
              name: report.branch?.name || "Unknown Branch",
            };
          }
        }
      }
      setBranches(branchesRecord);
    } catch (error) {
      console.error("Error fetching reports:", error);
      setError(error instanceof Error ? error.message : "Unknown error occurred");
      toast({
        title: "Error",
        description: "Failed to load reports. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, branches, toast, setLoading, setError, setReports, setRefreshing]);

  // Define handleApprovalComplete after loadReports is defined
  const handleApprovalComplete = useCallback(() => {
    enablePollingForAction('approval complete');
    loadReports();
  }, [enablePollingForAction, loadReports]);

  const handleRefresh = () => {
    setRefreshing(true);
    enablePollingForAction('manual refresh');
    loadReports();
  };

  // Apply filters and sorting
  useEffect(() => {
    if (!reports.length) return;

    // Use a function to avoid recreating the filter logic
    const applyFiltersAndSorting = () => {
      let results = [...reports];

      // Apply filters in memory
      results = results.filter(report => {
        // Apply branch filter
        if (branchFilter !== "all" && report.branchId !== branchFilter) {
          return false;
        }

        // Apply report type filter
        if (reportTypeFilter !== "all" && report.reportType !== reportTypeFilter) {
          return false;
        }

        // Apply date range filter
        if (dateRange.from || dateRange.to) {
          const reportDate = new Date(report.date);
          if (dateRange.from && reportDate < dateRange.from) {
            return false;
          }
          if (dateRange.to && reportDate > dateRange.to) {
            return false;
          }
        }

        // Apply search filter
        if (searchTerm) {
          const search = searchTerm.toLowerCase();
          return (
            report.branch.name.toLowerCase().includes(search) ||
            (report.user?.name || "").toLowerCase().includes(search) ||
            (report.user?.username || "").toLowerCase().includes(search) ||
            report.date.includes(search)
          );
        }

        return true;
      });

      // Apply sorting with proper type handling
      results.sort((a, b) => {
        let valueA: string | number | Date;
        let valueB: string | number | Date;

        switch (sortField) {
          case "date":
            // Convert string dates to Date objects for comparison
            valueA = new Date(a.date);
            valueB = new Date(b.date);
            break;
          case "branch":
            valueA = a.branch.name;
            valueB = b.branch.name;
            break;
          case "created":
            valueA = new Date(a.submittedAt);
            valueB = new Date(b.submittedAt);
            break;
          case "writeOffs":
            valueA = a.writeOffs;
            valueB = b.writeOffs;
            break;
          case "ninetyPlus":
            valueA = a.ninetyPlus;
            valueB = b.ninetyPlus;
            break;
          default:
            valueA = new Date(a.date);
            valueB = new Date(b.date);
        }

        if (sortDirection === "asc") {
          if (valueA instanceof Date && valueB instanceof Date) {
            return valueA.getTime() - valueB.getTime();
          }
          return typeof valueA === 'string'
            ? valueA.localeCompare(valueB as string)
            : (valueA as number) - (valueB as number);
        } else {
          if (valueA instanceof Date && valueB instanceof Date) {
            return valueB.getTime() - valueA.getTime();
          }
          return typeof valueA === 'string'
            ? (valueB as string).localeCompare(valueA)
            : (valueB as number) - (valueA as number);
        }
      });

      // Calculate pagination
      const total = results.length;
      const calculatedTotalPages = Math.ceil(total / reportsPerPage);
      const start = (currentPage - 1) * reportsPerPage;
      const end = start + reportsPerPage;

      // Apply pagination
      const paginatedResults = results.slice(start, end);

      return {
        filteredResults: paginatedResults,
        total,
        calculatedTotalPages
      };
    };

    // Apply filters and update state in a single batch
    const { filteredResults, total, calculatedTotalPages } = applyFiltersAndSorting();

    setFilteredReports(filteredResults);
    setTotalReports(total);
    setTotalPages(calculatedTotalPages);
  }, [
    reports,
    searchTerm,
    sortField,
    sortDirection,
    branchFilter,
    reportTypeFilter,
    dateRange,
    currentPage
  ]);

  // We're using the Zustand hybrid realtime system with smart polling
  // This means polling only happens when needed (after user actions or when events are received)

  // Memoize the event handler to prevent unnecessary re-renders
  // This is used by the hybrid realtime system when events are received
  // We're keeping this function for future use with the Zustand hybrid realtime system
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const handleDashboardUpdate = useCallback((data: any) => {
    // Handle report submission events
    if (data && data.type === 'reportSubmitted') {
      console.log('New report submitted:', data);
      // Set the notification flag
      setNewReportNotification(true);
      // Mark that we need to refresh data
      autoRefreshNeeded.current = true;
      // Enable active polling for new reports
      enablePollingForAction('new report submitted event');

      // Show a toast notification
      toast({
        title: "New Report Submitted",
        description: `${data.branchName} submitted a new ${data.reportType} report that needs approval.`,
        duration: 5000,
      });
    }
    // Handle report status update events (approval/rejection)
    else if (data && (data.type === 'reportApproved' || data.type === 'reportRejected')) {
      console.log('Report status updated:', data);
      // Enable active polling for status updates
      enablePollingForAction('report status update event');

      // Show a toast notification about the status change
      const statusText = data.status === 'approved' ? 'approved' : 'rejected';
      toast({
        title: `Report ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`,
        description: `A report from ${data.branchName} has been ${statusText}.`,
        duration: 5000,
      });

      // Use a small delay to avoid UI flicker
      setTimeout(() => {
        loadReports();
      }, 300);
    }
  }, [toast, loadReports, enablePollingForAction]);

  // Create a ref to track initial render
  const isInitialRender = useRef(true);

  // Combined effect for initial load and filter changes
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      loadReports();
      return;
    }

    // For subsequent renders, only reload when filters change
    // Enable active polling when filters change
    enablePollingForAction('filter change');
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchFilter, reportTypeFilter, statusFilter, currentPage]);

  // Separate effect for date range changes to avoid dependency cycles
  useEffect(() => {
    if (!isInitialRender.current) {
      enablePollingForAction('date range change');
      loadReports();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  // Effect to handle auto-refresh when needed
  useEffect(() => {
    // Check if auto-refresh is needed
    if (autoRefreshNeeded.current) {
      enablePollingForAction('auto refresh');
      loadReports();
      autoRefreshNeeded.current = false;
      setNewReportNotification(false);
    }
  }, [enablePollingForAction, loadReports]);

  // Handle new report notification with a separate effect
  useEffect(() => {
    if (newReportNotification) {
      // Add a small delay to avoid multiple refreshes
      const timer = setTimeout(() => {
        enablePollingForAction('new report notification');
        loadReports();
        setNewReportNotification(false);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [newReportNotification, enablePollingForAction, loadReports]);

  // Save view mode preference to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("approvalsViewMode", viewMode);
    }
  }, [viewMode]);

  const toggleSortDirection = () => {
    setSortDirection(sortDirection === "asc" ? "desc" : "asc");
  };

  // Get unique branches for filter dropdown
  const uniqueBranches = Object.values(branches).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div>
      <DashboardHeader
        heading="Report Approvals"
        text="Review, approve, and manage all reports in a unified interface."
      />

      <div className="mt-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <div className="flex items-center gap-2">
            <div className="border rounded-md p-1">
              <Button
                variant={viewMode === "card" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("card")}
                className="h-8 px-2"
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                Cards
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className="h-8 px-2"
              >
                <LayoutList className="h-4 w-4 mr-1" />
                Table
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {newReportNotification && (
              <div className="flex items-center text-amber-500 animate-pulse">
                <Bell className="h-4 w-4 mr-1" />
                <span className="text-xs font-medium">New report available</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1"
            >
              <RefreshCw className={cn(
                "h-4 w-4",
                refreshing && "animate-spin"
              )} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>
        {/* Filters and Search */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-md flex items-center">
              <Filter className="h-4 w-4 mr-2" />
              Filter Reports
            </CardTitle>
            <CardDescription>
              Filter reports by status, branch, type, and date range
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Search className="h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search branch, user..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-500">Branch</p>
                <Select
                  value={branchFilter}
                  onValueChange={setBranchFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {uniqueBranches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-500">Report Type</p>
                <Select
                  value={reportTypeFilter}
                  onValueChange={setReportTypeFilter}
                >
                  <SelectTrigger>
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
                <p className="text-sm font-medium text-gray-500">Status</p>
                <Select
                  value={statusFilter}
                  onValueChange={setStatusFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="pending_approval">Pending Approval</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-500">Date Range</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "LLL dd, y")} -{" "}
                            {format(dateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(dateRange.from, "LLL dd, y")
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
                      defaultMonth={dateRange?.from}
                      selected={dateRange as any}
                      onSelect={(range) => setDateRange(range as any)}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-gray-500">
                {totalReports} reports found, showing page {currentPage} of {totalPages}
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setBranchFilter("all");
                    setReportTypeFilter("all");
                    setStatusFilter("all");
                    setDateRange({});
                    setCurrentPage(1);
                  }}
                  className="text-xs mr-2"
                >
                  <FilterX className="h-3 w-3 mr-1" />
                  Reset Filters
                </Button>

                <p className="text-sm font-medium mr-2">Sort by:</p>
                <Select value={sortField} onValueChange={setSortField}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Sort by Date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Report Date</SelectItem>
                    <SelectItem value="created">Submission Date</SelectItem>
                    <SelectItem value="branch">Branch</SelectItem>
                    <SelectItem value="writeOffs">Write-offs</SelectItem>
                    <SelectItem value="ninetyPlus">90+ Days</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSortDirection}
                >
                  {sortDirection === "asc" ? (
                    <SortAsc className="h-4 w-4" />
                  ) : (
                    <SortDesc className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="space-y-4">
            {viewMode === "card" ? (
              // Card view loading skeleton
              [...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[250px]" />
                      <Skeleton className="h-4 w-[200px]" />
                      <div className="flex gap-2 mt-4">
                        <Skeleton className="h-8 w-[100px]" />
                        <Skeleton className="h-8 w-[100px]" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              // Table view loading skeleton
              <Card>
                <CardContent className="pt-6">
                  <Skeleton className="h-10 w-full mb-2" />
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full mb-2" />
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        ) : filteredReports.length === 0 ? (
          <Card>
            <CardContent className="pt-6 pb-6 text-center">
              <div className="py-8 text-gray-500">
                <p className="text-lg font-medium mb-2">No Reports Found</p>
                <p className="text-sm">
                  There are no reports that match your filters.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {viewMode === "card" ? (
              // Card view
              <div className="space-y-4">
                {filteredReports.map((report) => (
                  <PendingReport
                    key={report.id}
                    report={{
                      id: report.id,
                      date: report.date,
                      branchId: report.branchId,
                      writeOffs: typeof report.writeOffs === 'object' ? Number(report.writeOffs) : report.writeOffs,
                      ninetyPlus: typeof report.ninetyPlus === 'object' ? Number(report.ninetyPlus) : report.ninetyPlus,
                      status: report.status,
                      reportType: report.reportType,
                      content: report.content,
                      submittedBy: report.submittedBy,
                      comments: report.comments || undefined,
                      user: report.user,
                      createdAt: report.createdAt.toString(),
                      updatedAt: report.updatedAt.toString(),
                      // Convert ReportComment dates to strings
                      ReportComment: report.ReportComment?.map(comment => ({
                        ...comment,
                        createdAt: comment.createdAt.toString(),
                        updatedAt: comment.updatedAt.toString()
                      }))
                    }}
                    branchName={report.branch?.name || "Unknown Branch"}
                    onApprovalComplete={handleApprovalComplete}
                  />
                ))}
              </div>
            ) : (
              // Table view
              <ApprovalsTable
                reports={filteredReports.map(report => ({
                  id: report.id,
                  date: report.date,
                  branchId: report.branchId,
                  writeOffs: typeof report.writeOffs === 'object' ? Number(report.writeOffs) : report.writeOffs,
                  ninetyPlus: typeof report.ninetyPlus === 'object' ? Number(report.ninetyPlus) : report.ninetyPlus,
                  status: report.status,
                  reportType: report.reportType,
                  content: report.content,
                  submittedBy: report.submittedBy,
                  comments: report.comments || undefined,
                  user: report.user,
                  createdAt: report.createdAt.toString(),
                  updatedAt: report.updatedAt.toString(),
                  branch: report.branch,
                  // Convert ReportComment dates to strings
                  ReportComment: report.ReportComment?.map(comment => ({
                    ...comment,
                    createdAt: comment.createdAt.toString(),
                    updatedAt: comment.updatedAt.toString()
                  }))
                }))}
                onApprovalComplete={handleApprovalComplete}
              />
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center my-6">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
