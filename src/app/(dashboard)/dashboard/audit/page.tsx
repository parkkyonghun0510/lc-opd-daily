"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Sheet, 
  SheetClose, 
  SheetContent, 
  SheetDescription, 
  SheetFooter, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
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
  ChevronRight
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
  const [meta, setMeta] = useState<AuditResponse['meta'] | null>(null);
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
      if (selectedAction && selectedAction !== "all") params.append("action", selectedAction);
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
      setError(err instanceof Error ? err.message : "An unknown error occurred");
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
  }, [status, page, searchQuery, logType, selectedAction, selectedUserId, dateRange, session]);

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
          description: "There are no audit logs to export with the current filters.",
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
          `"${typeof details === 'string' ? details.replace(/"/g, '""') : details}"`,
        ];
        
        csvContent += row.join(",") + "\n";
      });
      
      // Create download link
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `audit_logs_${format(new Date(), "yyyy-MM-dd")}.csv`);
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
    return action
      .replace(/_/g, " ")
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  // Get badge color based on action type
  const getActionBadgeColor = (action: string, type: string) => {
    const actionLower = action.toLowerCase();
    
    if (actionLower.includes("create") || actionLower.includes("add")) {
      return "bg-green-500 hover:bg-green-600";
    }
    
    if (actionLower.includes("update") || actionLower.includes("edit") || actionLower.includes("modify")) {
      return "bg-blue-500 hover:bg-blue-600";
    }
    
    if (actionLower.includes("delete") || actionLower.includes("remove")) {
      return "bg-red-500 hover:bg-red-600";
    }
    
    if (actionLower.includes("login") || actionLower.includes("auth")) {
      return "bg-purple-500 hover:bg-purple-600";
    }
    
    return "bg-gray-500 hover:bg-gray-600";
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
        <div className="flex flex-col lg:flex-row justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Audit Logs</h2>
            <p className="text-muted-foreground">
              View and search system activity and user actions
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchAuditLogs}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Refresh
            </Button>
            
            <PermissionGate permissions={[Permission.EXPORT_AUDIT_LOGS]}>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExport}
                disabled={loading || !auditLogs.length}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </PermissionGate>
          </div>
        </div>
        
        {/* Filters and search section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Filters</CardTitle>
            <CardDescription>
              Filter audit logs by type, action, user, and date
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label htmlFor="search" className="text-sm font-medium">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search in logs..."
                      className="pl-8"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="logType" className="text-sm font-medium">
                    Log Type
                  </label>
                  <Select value={logType} onValueChange={setLogType}>
                    <SelectTrigger id="logType">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Logs</SelectItem>
                      <SelectItem value="activity">Activity Logs</SelectItem>
                      <SelectItem value="userActivity">User Activity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="action" className="text-sm font-medium">
                    Action
                  </label>
                  <Select value={selectedAction} onValueChange={setSelectedAction}>
                    <SelectTrigger id="action">
                      <SelectValue placeholder="Select action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      {meta?.actions && Array.isArray(meta.actions) && meta.actions.map((action: any) => (
                        action.action && action.action.trim() !== "" ? (
                          <SelectItem key={action.action} value={action.action}>
                            {formatActionName(action.action)}
                          </SelectItem>
                        ) : null
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Date Range
                  </label>
                  <DatePickerWithRange 
                    date={dateRange}
                    setDate={(date) => setDateRange(date)}
                  />
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={clearFilters}
                  disabled={!searchQuery && logType === "all" && selectedAction === "all" && !dateRange?.from && !dateRange?.to}
                >
                  Clear Filters
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Filter className="mr-2 h-4 w-4" />
                      Apply Filters
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        
        {/* Logs table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Audit Log Results</CardTitle>
              {meta && (
                <div className="text-sm text-muted-foreground">
                  Showing {auditLogs.length} of {meta.total} entries
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : loading ? (
              <div className="h-96 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="h-32 flex items-center justify-center border rounded-md">
                <p className="text-muted-foreground">No audit logs found. Try adjusting your filters.</p>
              </div>
            ) : (
              <div className="relative overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Timestamp</TableHead>
                      <TableHead className="w-[150px]">User</TableHead>
                      <TableHead className="w-[200px]">Action</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="w-[100px]">Type</TableHead>
                      <TableHead className="w-[80px] text-right">View</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id} className="group">
                        <TableCell className="font-mono text-xs">
                          {formatTimestamp(log.timestamp)}
                        </TableCell>
                        <TableCell>
                          <UserDisplayName 
                            userId={log.userId} 
                            showAvatar
                          />
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-white font-normal", getActionBadgeColor(log.action, log.type))}>
                            {formatActionName(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate">
                          {typeof log.details === 'string' 
                            ? (log.details || '-') 
                            : '[Complex Data]'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            log.type === "activity" 
                              ? "bg-blue-50 text-blue-700 hover:bg-blue-100" 
                              : "bg-green-50 text-green-700 hover:bg-green-100"
                          )}>
                            {log.type === "activity" ? "Activity" : "User Action"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => viewLogDetails(log)}
                            className="opacity-70 group-hover:opacity-100"
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
            
            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
              <div className="mt-4 flex justify-between items-center">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
                <div className="text-sm">
                  Page {page} of {meta.totalPages}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPage(Math.min(meta.totalPages, page + 1))}
                  disabled={page >= meta.totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Log detail modal */}
        {selectedLog && (
          <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Audit Log Details</DialogTitle>
                <DialogDescription>
                  Detailed information about this activity
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">ID</h4>
                  <p className="text-sm font-mono bg-muted p-2 rounded">{selectedLog.id}</p>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Timestamp</h4>
                  <p className="text-sm font-mono bg-muted p-2 rounded">
                    {formatTimestamp(selectedLog.timestamp)}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">User</h4>
                  <div className="text-sm bg-muted p-2 rounded flex items-center">
                    <UserDisplayName userId={selectedLog.userId} showAvatar />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Action</h4>
                  <div className="text-sm bg-muted p-2 rounded">
                    <Badge className={cn("text-white", getActionBadgeColor(selectedLog.action, selectedLog.type))}>
                      {formatActionName(selectedLog.action)}
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">IP Address</h4>
                  <p className="text-sm font-mono bg-muted p-2 rounded">
                    {selectedLog.ipAddress || "Unknown"}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Log Type</h4>
                  <p className="text-sm bg-muted p-2 rounded">
                    <Badge variant="outline" className={cn(
                      selectedLog.type === "activity" 
                        ? "bg-blue-50 text-blue-700" 
                        : "bg-green-50 text-green-700"
                    )}>
                      {selectedLog.type === "activity" ? "System Activity" : "User Activity"}
                    </Badge>
                  </p>
                </div>
                
                <div className="col-span-1 md:col-span-2 space-y-2">
                  <h4 className="font-semibold text-sm">User Agent</h4>
                  <p className="text-xs font-mono bg-muted p-2 rounded-md overflow-x-auto whitespace-pre-wrap">
                    {selectedLog.userAgent || "Unknown"}
                  </p>
                </div>
                
                <div className="col-span-1 md:col-span-2 space-y-2">
                  <h4 className="font-semibold text-sm">Details</h4>
                  <pre className="text-xs font-mono bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {typeof selectedLog.details === 'string' 
                      ? (selectedLog.details || 'No details provided') 
                      : JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                  Close
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </PermissionGate>
  );
} 