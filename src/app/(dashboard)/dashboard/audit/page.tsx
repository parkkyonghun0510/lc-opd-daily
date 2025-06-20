"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserDisplayName } from "@/components/user/UserDisplayName";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  Search,
  Filter,
  Download,
  Info,
  AlertCircle,
  Loader2,
  FileText,
  RefreshCw,
  User,
  Calendar as CalendarIcon,
  ArrowDown,
  ArrowUp,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Permission, UserRole, checkPermission } from "@/lib/auth/roles";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { DateRange } from "react-day-picker";

interface AuditLog {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    username: string;
    email: string;
  };
  action: string;
  details: string | any;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: string;
  type: "activity" | "userActivity";
}

interface AuditResponse {
  auditLogs: AuditLog[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    actions: string[];
  };
}

export default function AuditPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [meta, setMeta] = useState<AuditResponse["meta"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [logType, setLogType] = useState("all");
  const [selectedAction, setSelectedAction] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: undefined,
    to: undefined,
  });
  const [page, setPage] = useState(1);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [sortBy, setSortBy] = useState("timestamp");
  const [sortOrder, setSortOrder] = useState("desc");

  // Check for required permissions
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      const userRole = session?.user?.role as string;
      const canViewAuditLogs =
        userRole === "ADMIN" ||
        userRole === "BRANCH_MANAGER" ||
        checkPermission(userRole, Permission.VIEW_AUDIT_LOGS);

      if (!canViewAuditLogs) {
        router.push("/dashboard");
        toast({
          title: "Access Denied",
          description: "You don't have permission to view audit logs",
          variant: "destructive",
        });
      }
    }
  }, [status, session, router]);

  // Fetch audit logs
  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (logType !== "all") params.append("type", logType);
      if (selectedAction && selectedAction !== "all")
        params.append("action", selectedAction);
      if (selectedUserId) params.append("userId", selectedUserId);
      if (dateRange?.from) params.append("from", dateRange.from.toISOString());
      if (dateRange?.to) params.append("to", dateRange.to.toISOString());
      params.append("page", page.toString());

      const response = await fetch(`/api/audit?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch audit logs: ${response.statusText}`);
      }

      const data: AuditResponse = await response.json();
      setAuditLogs(data.auditLogs);
      setMeta(data.meta);
    } catch (err) {
      console.error("Error fetching audit logs:", err);
      setError(
        err instanceof Error ? err.message : "An unknown error occurred",
      );
      toast({
        title: "Error",
        description: "Failed to load audit logs. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fix permissions checks in the component
  // Remove or update the conditional that uses session.user.permissions
  useEffect(() => {
    const handleInitialFetch = async () => {
      // Use the same role-based permission check that we established earlier
      if (status === "authenticated") {
        const userRole = session?.user?.role as string;
        const canViewAuditLogs =
          userRole === "ADMIN" ||
          userRole === "BRANCH_MANAGER" ||
          checkPermission(userRole, Permission.VIEW_AUDIT_LOGS);

        if (canViewAuditLogs) {
          await fetchAuditLogs();
        }
      }
    };

    handleInitialFetch();
  }, [
    status,
    page,
    searchQuery,
    logType,
    selectedAction,
    selectedUserId,
    dateRange,
    session,
  ]);

  // Handle search form submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Reset to first page
    fetchAuditLogs();
  };

  // Handle clearing all filters
  const clearFilters = () => {
    setSearchQuery("");
    setLogType("all");
    setSelectedAction("all");
    setSelectedUserId("");
    setDateRange({ from: undefined, to: undefined });
    setPage(1);
  };

  // Format timestamp to readable date
  const formatTimestamp = (timestamp: string) => {
    try {
      return format(new Date(timestamp), "MMM d, yyyy h:mm:ss a");
    } catch (e) {
      return timestamp;
    }
  };

  // Format details for display
  const formatDetails = (details: any, type: string) => {
    if (!details) return "-";

    if (typeof details === "string") {
      return details || "-";
    }

    if (typeof details === "object") {
      try {
        return JSON.stringify(details, null, 2);
      } catch (e) {
        return "Invalid JSON";
      }
    }

    return String(details);
  };

  // Handle export to CSV
  const handleExport = async () => {
    if (status === "authenticated") {
      const userRole = session?.user?.role as string;
      const canExportAuditLogs =
        userRole === "ADMIN" ||
        checkPermission(userRole, Permission.EXPORT_AUDIT_LOGS);

      if (!canExportAuditLogs) {
        toast({
          title: "Permission Denied",
          description: "You don't have permission to export audit logs",
          variant: "destructive",
        });
        return;
      }

      if (!auditLogs.length) {
        toast({
          title: "No data to export",
          description:
            "There are no audit logs to export with the current filters.",
          variant: "default",
        });
        return;
      }

      // Create CSV content
      let csvContent = "ID,Timestamp,User,Action,Type,IP Address,Details\n";

      auditLogs.forEach((log) => {
        const userName = log.user?.name || log.user?.username || "Unknown";
        const details = formatDetails(log.details, log.type);
        const timestamp = formatTimestamp(log.timestamp);

        // Escape fields that might contain commas
        const row = [
          log.id,
          `"${timestamp}"`,
          `"${userName}"`,
          `"${log.action}"`,
          log.type,
          log.ipAddress || "unknown",
          `"${typeof details === "string" ? details.replace(/"/g, '""') : details}"`,
        ];

        csvContent += row.join(",") + "\n";
      });

      // Create download link
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `audit_logs_${format(new Date(), "yyyy-MM-dd")}.csv`,
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export successful",
        description: "Audit logs have been exported to CSV.",
        variant: "default",
      });
    }
  };

  // View log details
  const viewLogDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setIsDetailOpen(true);
  };

  // Format action name for display
  const formatActionName = (action: string) => {
    if (!action || typeof action !== "string") {
      return "Unknown Action";
    }

    return action
      .replace(/_/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  // Get badge color based on action type
  const getActionBadgeColor = (action: string, type: string) => {
    if (!action || typeof action !== "string") {
      return "default";
    }

    const actionLower = action.toLowerCase();

    if (actionLower.includes("create") || actionLower.includes("add")) {
      return "success";
    }

    if (
      actionLower.includes("update") ||
      actionLower.includes("edit") ||
      actionLower.includes("modify")
    ) {
      return "default";
    }

    if (actionLower.includes("delete") || actionLower.includes("remove")) {
      return "destructive";
    }

    if (actionLower.includes("login") || actionLower.includes("auth")) {
      return "secondary";
    }

    return "outline";
  };

  // If user doesn't have permission, show access denied
  if (status === "authenticated") {
    const userRole = session?.user?.role as string;
    const canViewAuditLogs =
      userRole === "ADMIN" ||
      userRole === "BRANCH_MANAGER" ||
      checkPermission(userRole, Permission.VIEW_AUDIT_LOGS);

    if (!canViewAuditLogs) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to view audit logs.
            </CardDescription>
          </CardHeader>
        </Card>
      );
    }
  }

  return (
    <PermissionGate
      permissions={[Permission.VIEW_AUDIT_LOGS]}
      fallback={<div>Loading...</div>}
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b dark:border-gray-700">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Audit Logs
            </h2>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
              View system and user activity logs
            </p>
          </div>

          <Button
            onClick={handleExport}
            disabled={loading || !auditLogs.length}
            className="w-full sm:w-auto flex items-center justify-center gap-2 mt-2 sm:mt-0"
          >
            <Download className="h-4 w-4" />
            <span>Export Logs</span>
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error}
              <Button
                onClick={fetchAuditLogs}
                variant="link"
                className="p-0 h-auto font-normal ml-2"
              >
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Filter Logs</CardTitle>
              <CardDescription>
                Refine the audit logs based on various criteria
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="w-full sm:w-2/3">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
                      <Input
                        type="search"
                        placeholder="Search by user, action, or details..."
                        className="pl-8 w-full"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-1/3">
                    <Button type="submit" className="w-full sm:w-1/2">
                      Search
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={clearFilters}
                      className="w-full sm:w-1/2"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Log Type
                    </label>
                    <Select value={logType} onValueChange={setLogType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select log type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="activity">
                          System Activity
                        </SelectItem>
                        <SelectItem value="userActivity">
                          User Activity
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Action
                    </label>
                    <Select
                      value={selectedAction}
                      onValueChange={setSelectedAction}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select action" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Actions</SelectItem>
                        {meta?.actions.map((action) => (
                          <SelectItem key={action} value={action}>
                            {formatActionName(action)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Date Range
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
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
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={dateRange?.from}
                          selected={dateRange}
                          onSelect={setDateRange}
                          numberOfMonths={1}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Sort By
                    </label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between"
                        >
                          {sortBy === "timestamp"
                            ? "Date"
                            : sortBy === "action"
                              ? "Action"
                              : "User"}
                          {sortOrder === "asc" ? (
                            <ArrowUp className="ml-2 h-4 w-4" />
                          ) : (
                            <ArrowDown className="ml-2 h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Sort Options</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => {
                            setSortBy("timestamp");
                            setSortOrder("desc");
                          }}
                        >
                          Date (Newest First)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSortBy("timestamp");
                            setSortOrder("asc");
                          }}
                        >
                          Date (Oldest First)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setSortBy("action");
                            setSortOrder("asc");
                          }}
                        >
                          Action (A-Z)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSortBy("action");
                            setSortOrder("desc");
                          }}
                        >
                          Action (Z-A)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setSortBy("user");
                            setSortOrder("asc");
                          }}
                        >
                          User (A-Z)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSortBy("user");
                            setSortOrder("desc");
                          }}
                        >
                          User (Z-A)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Audit Results</CardTitle>
              <CardDescription>
                {loading
                  ? "Loading audit logs..."
                  : auditLogs.length === 0
                    ? "No audit logs found matching your criteria."
                    : `Showing ${auditLogs.length} of ${meta?.total || 0} logs`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-96 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-center px-4">
                  <AlertCircle className="h-8 w-8 text-gray-400 dark:text-gray-600 mb-2" />
                  <p className="text-gray-500 dark:text-gray-400 mb-2">
                    No audit logs found
                  </p>
                  <Button variant="outline" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px] sm:w-[180px]">
                          Date & Time
                        </TableHead>
                        <TableHead className="w-[80px] sm:w-[120px]">
                          User
                        </TableHead>
                        <TableHead className="w-[100px] sm:w-[150px]">
                          Action
                        </TableHead>
                        <TableHead className="hidden sm:table-cell">
                          Details
                        </TableHead>
                        <TableHead className="w-[60px] sm:w-[80px]">
                          View
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id} className="group">
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {formatTimestamp(log.timestamp)}
                          </TableCell>
                          <TableCell className="truncate max-w-[80px] sm:max-w-[120px]">
                            <UserDisplayName
                              userId={log.userId}
                              fallback={log.user?.username || "System"}
                            />
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={getActionBadgeColor(
                                log.action,
                                log.type,
                              )}
                              className="whitespace-nowrap"
                            >
                              {formatActionName(log.action)}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell max-w-[300px] truncate">
                            {formatDetails(log.details, log.action)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => viewLogDetails(log)}
                              className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t dark:border-gray-700">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Page {meta.page} of {meta.totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page > 1 ? page - 1 : 1)}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="sr-only sm:not-sr-only sm:ml-2">
                      Previous
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage(
                        page < meta.totalPages ? page + 1 : meta.totalPages,
                      )
                    }
                    disabled={page >= meta.totalPages}
                  >
                    <span className="sr-only sm:not-sr-only sm:mr-2">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Log Details Dialog */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Audit Log Details</DialogTitle>
              <DialogDescription>
                Complete information about the selected audit log
              </DialogDescription>
            </DialogHeader>

            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Timestamp
                    </h4>
                    <p className="mt-1 text-sm font-mono dark:text-gray-300">
                      {formatTimestamp(selectedLog.timestamp)}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      User
                    </h4>
                    <p className="mt-1 text-sm dark:text-gray-300">
                      <UserDisplayName
                        userId={selectedLog.userId}
                        fallback={selectedLog.user?.username || "System"}
                      />
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Action
                    </h4>
                    <Badge
                      variant={getActionBadgeColor(
                        selectedLog.action,
                        selectedLog.type,
                      )}
                      className="mt-1"
                    >
                      {formatActionName(selectedLog.action)}
                    </Badge>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Details
                  </h4>
                  <Card className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 overflow-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </Card>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      IP Address
                    </h4>
                    <p className="mt-1 text-sm font-mono dark:text-gray-300">
                      {selectedLog.ipAddress || "Not available"}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      User Agent
                    </h4>
                    <p className="mt-1 text-sm text-gray-800 dark:text-gray-300 overflow-hidden text-ellipsis">
                      {selectedLog.userAgent || "Not available"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => setIsDetailOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGate>
  );
}
