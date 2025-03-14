"use client";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@radix-ui/react-icons";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn, formatKHRCurrency } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PencilIcon } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { CreateReportModal } from "./reports/CreateReportModal";
import { PlusIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KHCurrencyInput } from "@/components/ui/currency-input";

type Report = {
  id: string;
  date: string;
  branch: {
    id: string;
    code: string;
    name: string;
  };
  writeOffs: number;
  ninetyPlus: number;
  writeOffsPlan?: number;
  ninetyPlusPlan?: number;
  reportType: "plan" | "actual";
  status: string;
  submittedBy: string;
  submittedAt: string;
  comments?: string;
};

type PaginationInfo = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type Branch = {
  id: string;
  code: string;
  name: string;
};

export default function ViewReports() {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [reportType, setReportType] = useState<"plan" | "actual">("actual");
  const [selectedBranchId, setSelectedBranchId] = useState<string | undefined>(
    undefined
  );
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [editWriteOffs, setEditWriteOffs] = useState("");
  const [editNinetyPlus, setEditNinetyPlus] = useState("");
  const [editComments, setEditComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: session } = useSession();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createReportType, setCreateReportType] = useState<"plan" | "actual">(
    "plan"
  );
  const [userBranches, setUserBranches] = useState<Branch[]>([]);

  // Fetch reports on component mount and when filters change
  useEffect(() => {
    fetchReports();
  }, [pagination.page, date, reportType, selectedBranchId]);

  // Fetch branches on component mount
  useEffect(() => {
    const fetchBranches = async () => {
      if (!session?.user) return; // Don't fetch if no session

      try {
        // For both admin and regular users, fetch from the API
        // The API will handle permissions and return only branches the user has access to
        const response = await fetch("/api/branches");
        if (response.ok) {
          const data = await response.json();
          // Handle both array and object with branches property
          const branchesData = Array.isArray(data) ? data : data.branches || [];
          setUserBranches(branchesData);

          // If user has only one branch and no selection yet, select it
          if (branchesData.length === 1 && !date) {
            // Auto-select current date for convenience
            setDate(new Date());
          }
        } else {
          console.error("Failed to fetch branches:", await response.text());
        }
      } catch (error) {
        console.error("Error fetching branches:", error);
      }
    };

    fetchBranches();
  }, [session]);

  // Initialize selectedBranchId based on user role and branches
  useEffect(() => {
    if (!session?.user) return;

    if (
      session.user.role !== "admin" &&
      session.user.branchId &&
      userBranches.length === 1
    ) {
      // For non-admin users with a single branch, automatically select it
      setSelectedBranchId(session.user.branchId);
    } else if (userBranches.length === 1) {
      // For any user with just one branch, select it
      setSelectedBranchId(userBranches[0].id);
    } else if (userBranches.length > 1 && session.user.branchId) {
      // For users with multiple branches but a default branch, use it
      // Only if the branch exists in the available branches
      if (userBranches.some((b) => b.id === session.user.branchId)) {
        setSelectedBranchId(session.user.branchId);
      } else {
        // If default branch doesn't exist in available branches, use undefined for "All branches"
        setSelectedBranchId(undefined);
      }
    } else if (userBranches.length > 1) {
      // For users with multiple branches but no default, use undefined for "All branches"
      setSelectedBranchId(undefined);
    }
  }, [session, userBranches]);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      let url = `/api/reports?page=${pagination.page}&limit=${pagination.limit}&type=${reportType}`;

      if (date) {
        url += `&date=${format(date, "yyyy-MM-dd")}`;
      }

      // Only add branchId to URL if a specific branch is selected
      if (selectedBranchId) {
        url += `&branchId=${selectedBranchId}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || "Failed to fetch reports";
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setReports(data.reports ?? []);
      setPagination(
        data.pagination ?? {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        }
      );
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast({
        title: "Error Loading Reports",
        description:
          error instanceof Error
            ? error.message
            : "Failed to load reports. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilter = () => {
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page when applying filters
    fetchReports();
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "yyyy-MM-dd");
  };

  const formatCurrency = formatKHRCurrency;

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-500";
      case "pending":
        return "bg-yellow-500";
      case "rejected":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const handleEditClick = (report: Report) => {
    setEditingReport(report);
    setEditWriteOffs(report.writeOffs.toString());
    setEditNinetyPlus(report.ninetyPlus.toString());
    setEditComments(report.comments || "");
    setIsEditModalOpen(true);
  };

  const handleUpdateReport = async () => {
    if (!editingReport) return;

    // Validate inputs before submitting
    if (!editWriteOffs || parseInt(editWriteOffs) < 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid Write-offs amount",
        variant: "destructive",
      });
      return;
    }

    if (!editNinetyPlus || parseInt(editNinetyPlus) < 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid 90+ Days amount",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/reports/${editingReport.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          writeOffs: parseFloat(editWriteOffs),
          ninetyPlus: parseFloat(editNinetyPlus),
          comments: editComments,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || "Failed to update report";
        throw new Error(errorMessage);
      }

      // Update the reports list
      const updatedReport = await response.json();
      setReports(
        reports.map((r) => (r.id === updatedReport.id ? updatedReport : r))
      );

      toast({
        title: "Report Updated",
        description: "The report has been successfully updated",
      });

      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Error updating report:", error);
      toast({
        title: "Update Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update report. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateClick = (type: "plan" | "actual") => {
    setCreateReportType(type);
    setIsCreateModalOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>View Reports</CardTitle>
        <CardDescription>Browse and filter daily reports</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Responsive filter controls with enhanced visual design */}
        <div className="flex flex-col space-y-4 mb-6">
          {/* Report type and create controls in one row */}
          <div className="flex items-center justify-between">
            {/* Enhanced tabs with larger clickable area */}
            <div className="flex-1">
              <Tabs
                className="w-full max-w-md"
                value={reportType}
                onValueChange={(value: string) => {
                  if (value === "plan" || value === "actual") {
                    setReportType(value);
                  }
                }}
              >
                <TabsList className="w-full grid grid-cols-2 p-1 h-12">
                  <TabsTrigger
                    value="plan"
                    className={cn(
                      "flex items-center justify-center gap-1 py-3 data-[state=active]:text-white",
                      "data-[state=active]:bg-blue-600 data-[state=active]:shadow"
                    )}
                  >
                    <span className="text-sm font-medium">Morning Plan</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="actual"
                    className={cn(
                      "flex items-center justify-center gap-1 py-3 data-[state=active]:text-white",
                      "data-[state=active]:bg-green-600 data-[state=active]:shadow"
                    )}
                  >
                    <span className="text-sm font-medium">Evening Actual</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Single, prominent create button that adjusts to the selected report type */}
            <Button
              onClick={() => handleCreateClick(reportType)}
              className={cn(
                "ml-4 flex items-center shadow transition-all duration-200 h-12 px-6",
                reportType === "plan"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-green-600 hover:bg-green-700"
              )}
              title={`Create a new ${reportType} report`}
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              <span className="font-medium">
                Create {reportType === "plan" ? "Plan" : "Actual"}
              </span>
            </Button>
          </div>

          {/* Filters in one row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Date selector with clearer label */}
            <div className="flex items-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full md:w-auto justify-start text-left font-normal border-gray-300 dark:border-gray-600 h-10",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Select a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Branch selector with improved styling */}
            {userBranches.length > 1 && (
              <div className="flex items-center">
                <Select
                  value={selectedBranchId || "all"}
                  onValueChange={(value) =>
                    setSelectedBranchId(value === "all" ? undefined : value)
                  }
                >
                  <SelectTrigger
                    className={cn(
                      "w-full md:w-[200px] h-10",
                      "border-gray-300 dark:border-gray-600"
                    )}
                  >
                    <SelectValue placeholder="All branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {userBranches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        <span className="font-medium">{branch.code}</span> -{" "}
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Apply filters button */}
            <Button
              onClick={handleFilter}
              variant="outline"
              disabled={isLoading}
              className="h-10"
              title="Apply filters"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  <span>Filtering...</span>
                </div>
              ) : (
                <span>Apply Filters</span>
              )}
            </Button>
          </div>
        </div>

        {/* Enhanced table title with visual separator */}
        <div className="mb-4 pb-3 border-b">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center flex-wrap">
            <span
              className={cn(
                "inline-flex items-center justify-center w-5 h-5 rounded-full mr-2",
                reportType === "plan" ? "bg-blue-600" : "bg-green-600"
              )}
            >
              <span className="text-white text-xs">
                {reportType === "plan" ? "P" : "A"}
              </span>
            </span>
            <span className="font-semibold">
              {reportType === "plan" ? "Morning Plan" : "Evening Actual"}{" "}
              Reports
            </span>
            {date && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                for {format(date, "PPP")}
              </span>
            )}
            {selectedBranchId && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                in{" "}
                <Badge variant="outline" className="ml-1 font-medium">
                  {userBranches.find((b) => b.id === selectedBranchId)?.code ||
                    "selected branch"}
                </Badge>
              </span>
            )}
          </h3>
        </div>

        {/* Responsive table with enhanced styling */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow
                className={cn(
                  reportType === "plan"
                    ? "bg-blue-50 dark:bg-blue-950/20"
                    : "bg-green-50 dark:bg-green-950/20"
                )}
              >
                <TableHead className="whitespace-nowrap font-medium">
                  Branch
                </TableHead>
                <TableHead className="whitespace-nowrap font-medium">
                  Date
                </TableHead>
                <TableHead className="whitespace-nowrap font-medium">
                  {reportType === "plan"
                    ? "Write-offs Plan"
                    : "Write-offs Actual"}
                </TableHead>
                <TableHead className="whitespace-nowrap font-medium">
                  {reportType === "plan" ? "90+ Days Plan" : "90+ Days Actual"}
                </TableHead>
                {reportType === "actual" && (
                  <>
                    <TableHead className="whitespace-nowrap font-medium">
                      Plan Achievement %
                    </TableHead>
                  </>
                )}
                <TableHead className="whitespace-nowrap font-medium">
                  Status
                </TableHead>
                <TableHead className="whitespace-nowrap font-medium">
                  Submitted By
                </TableHead>
                <TableHead className="whitespace-nowrap font-medium text-center">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={reportType === "actual" ? 8 : 7}
                    className="text-center py-10"
                  >
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="h-10 w-10 mb-3 animate-spin text-gray-400" />
                      <span className="text-gray-500 font-medium">
                        Loading reports...
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : reports.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={reportType === "actual" ? 8 : 7}
                    className="text-center py-12"
                  >
                    <div className="flex flex-col items-center justify-center p-4">
                      <div
                        className={cn(
                          "w-14 h-14 rounded-full mb-4 flex items-center justify-center",
                          reportType === "plan"
                            ? "bg-blue-100 text-blue-600"
                            : "bg-green-100 text-green-600"
                        )}
                      >
                        {reportType === "plan" ? (
                          <CalendarIcon className="h-7 w-7" />
                        ) : (
                          <CalendarIcon className="h-7 w-7" />
                        )}
                      </div>
                      <span className="text-gray-700 dark:text-gray-300 text-lg font-medium mb-2">
                        No {reportType === "plan" ? "plan" : "actual"} reports
                        found
                      </span>
                      <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 max-w-md text-center">
                        {date
                          ? `No ${reportType} reports found for ${format(
                              date,
                              "PPP"
                            )}${
                              selectedBranchId ? " in the selected branch" : ""
                            }.`
                          : "Select a date to view reports or create a new report."}
                      </p>
                      <Button
                        size="lg"
                        onClick={() => handleCreateClick(reportType)}
                        className={cn(
                          "shadow-sm",
                          reportType === "plan"
                            ? "bg-blue-600 hover:bg-blue-700"
                            : "bg-green-600 hover:bg-green-700"
                        )}
                      >
                        <PlusIcon className="h-5 w-5 mr-2" />
                        Create a {reportType} report
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((report) => (
                  <TableRow
                    key={report.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <TableCell className="whitespace-nowrap font-medium">
                      <div className="flex items-center">
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full mr-2",
                            reportType === "plan"
                              ? "bg-blue-500"
                              : "bg-green-500"
                          )}
                        ></span>
                        {report.branch.code}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(report.date)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono">
                      {formatCurrency(report.writeOffs)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono">
                      {formatCurrency(report.ninetyPlus)}
                    </TableCell>
                    {reportType === "actual" && (
                      <TableCell className="whitespace-nowrap">
                        {report.writeOffsPlan && report.writeOffs ? (
                          <span
                            className={cn(
                              "font-medium px-2 py-1 rounded-md text-xs",
                              (report.writeOffs / report.writeOffsPlan) * 100 >
                                100
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                            )}
                          >
                            {(
                              (report.writeOffs / report.writeOffsPlan) *
                              100
                            ).toFixed(1)}
                            %
                          </span>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="whitespace-nowrap">
                      <Badge
                        className={cn(
                          getStatusBadgeColor(report.status),
                          "capitalize"
                        )}
                      >
                        {report.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {report.submittedBy}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditClick(report)}
                        className="hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full h-8 w-8 p-0"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Enhanced pagination controls */}
        {pagination.totalPages > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between sm:justify-between space-y-3 sm:space-y-0 sm:space-x-4 mt-4 px-2">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Showing {reports.length} of {pagination.total} reports
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1 || isLoading}
                onClick={() => handlePageChange(pagination.page - 1)}
                className={cn(
                  "h-8 px-3 border-gray-200",
                  reportType === "plan"
                    ? "hover:border-blue-500 hover:text-blue-600"
                    : "hover:border-green-500 hover:text-green-600"
                )}
              >
                <ChevronLeftIcon className="h-4 w-4 mr-1" />
                Previous
              </Button>

              <div className="text-sm text-gray-700 dark:text-gray-300 px-2">
                <span className="font-medium">{pagination.page}</span>
                <span className="mx-1">of</span>
                <span className="font-medium">{pagination.totalPages}</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages || isLoading}
                onClick={() => handlePageChange(pagination.page + 1)}
                className={cn(
                  "h-8 px-3 border-gray-200",
                  reportType === "plan"
                    ? "hover:border-blue-500 hover:text-blue-600"
                    : "hover:border-green-500 hover:text-green-600"
                )}
              >
                Next
                <ChevronRightIcon className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Empty state when no filters are applied */}
        {!date && reports.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg mt-4">
            <div className="text-gray-400 dark:text-gray-500 mb-3">
              <CalendarIcon className="h-12 w-12" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              No date selected
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
              Select a date and click Filter to view reports
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setDate(new Date());
                setTimeout(() => handleFilter(), 100);
              }}
              className={cn(
                "text-sm",
                reportType === "plan" ? "text-blue-600" : "text-green-600"
              )}
            >
              Use today&apos;s date
            </Button>
          </div>
        )}

        {/* Enhanced Edit Report Dialog */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <span
                  className={cn(
                    "inline-flex items-center justify-center w-6 h-6 rounded-full mr-2",
                    editingReport?.reportType === "plan"
                      ? "bg-blue-600"
                      : "bg-green-600"
                  )}
                >
                  <PencilIcon className="h-3 w-3 text-white" />
                </span>
                <span className="text-xl">
                  Edit{" "}
                  {editingReport?.reportType === "plan"
                    ? "Morning Plan"
                    : "Evening Actual"}{" "}
                  Report
                </span>
              </DialogTitle>
              <DialogDescription className="text-sm mt-2">
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center">
                    <span className="font-medium mr-2">Branch:</span>
                    <Badge variant="outline" className="font-medium">
                      {editingReport?.branch.code} -{" "}
                      {editingReport?.branch.name}
                    </Badge>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium mr-2">Date:</span>
                    <span>
                      {editingReport
                        ? format(new Date(editingReport.date), "PPP")
                        : ""}
                    </span>
                  </div>
                </div>
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 py-4">
              <div className="grid gap-4">
                <Label
                  htmlFor="writeOffs"
                  className="flex items-center text-base"
                >
                  <span
                    className={cn(
                      "inline-block w-3 h-3 rounded-full mr-2",
                      editingReport?.reportType === "plan"
                        ? "bg-blue-600"
                        : "bg-green-600"
                    )}
                  ></span>
                  {editingReport?.reportType === "plan"
                    ? "Write-offs Plan"
                    : "Write-offs Actual"}
                </Label>
                <div className="relative">
                  <KHCurrencyInput
                    value={editWriteOffs}
                    onValueChange={(rawValue: string) =>
                      setEditWriteOffs(rawValue)
                    }
                    className={cn(
                      "font-mono text-base",
                      editingReport?.reportType === "plan"
                        ? "border-blue-200 focus:border-blue-500"
                        : "border-green-200 focus:border-green-500"
                    )}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Amount in Cambodian Riel (KHR)
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <Label
                  htmlFor="ninetyPlus"
                  className="flex items-center text-base"
                >
                  <span
                    className={cn(
                      "inline-block w-3 h-3 rounded-full mr-2",
                      editingReport?.reportType === "plan"
                        ? "bg-blue-600"
                        : "bg-green-600"
                    )}
                  ></span>
                  {editingReport?.reportType === "plan"
                    ? "90+ Days Plan"
                    : "90+ Days Actual"}
                </Label>
                <div className="relative">
                  <KHCurrencyInput
                    value={editNinetyPlus}
                    onValueChange={(rawValue: string) =>
                      setEditNinetyPlus(rawValue)
                    }
                    className={cn(
                      "font-mono text-base",
                      editingReport?.reportType === "plan"
                        ? "border-blue-200 focus:border-blue-500"
                        : "border-green-200 focus:border-green-500"
                    )}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Amount in Cambodian Riel (KHR)
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <Label
                  htmlFor="comments"
                  className="flex items-center text-base"
                >
                  <span className="inline-block w-3 h-3 rounded-full mr-2 bg-gray-400"></span>
                  Comments
                </Label>
                <Textarea
                  id="comments"
                  value={editComments}
                  onChange={(e) => setEditComments(e.target.value)}
                  className={cn(
                    "min-h-[120px] text-base",
                    editingReport?.reportType === "plan"
                      ? "border-blue-200 focus:border-blue-500"
                      : "border-green-200 focus:border-green-500"
                  )}
                  placeholder="Add any additional details or notes about this report..."
                />
              </div>
            </div>

            <DialogFooter className="flex-col space-y-2 sm:space-y-0 sm:flex-row sm:justify-between border-t pt-4">
              {editingReport?.status === "approved" && (
                <div className="flex items-center text-sm text-gray-600">
                  <Badge
                    variant="outline"
                    className="mr-2 bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400"
                  >
                    Approved
                  </Badge>
                  This report has been approved by management
                </div>
              )}

              <div className="flex space-x-2 w-full sm:w-auto justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateReport}
                  disabled={isSubmitting}
                  className={cn(
                    "px-4",
                    editingReport?.reportType === "plan"
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-green-600 hover:bg-green-700"
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <CreateReportModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          reportType={createReportType}
          onSuccess={fetchReports}
          userBranches={userBranches}
          isAdmin={session?.user?.role === "admin" || false}
          defaultBranchId={
            selectedBranchId || session?.user?.branchId || undefined
          }
        />
      </CardContent>
    </Card>
  );
}
