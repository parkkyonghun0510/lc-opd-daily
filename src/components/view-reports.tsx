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
import { cn } from "@/lib/utils";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { CreateReportModal } from "./reports/CreateReportModal";
import { PlusIcon } from "lucide-react";

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
  }, [pagination.page, date, reportType]);

  // Fetch branches on component mount
  useEffect(() => {
    const fetchBranches = async () => {
      if (!session?.user) return; // Don't fetch if no session

      try {
        if (session.user.role === "admin") {
          const response = await fetch("/api/branches");
          if (response.ok) {
            const data = await response.json();
            setUserBranches(data.branches || []);
          }
        } else if (session.user.branchId) {
          const response = await fetch(
            `/api/branches/${session.user.branchId}`
          );
          if (response.ok) {
            const branch = await response.json();
            setUserBranches([branch]);
          }
        }
      } catch (error) {
        console.error("Error fetching branches:", error);
      }
    };

    fetchBranches();
  }, [session]);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      let url = `/api/reports?page=${pagination.page}&limit=${pagination.limit}&type=${reportType}`;

      if (date) {
        url += `&date=${format(date, "yyyy-MM-dd")}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch reports");
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
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to load reports",
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

  // const formatCurrency = (amount: number) => {
  //   return new Intl.NumberFormat("km-KH", {
  //     style: "currency",
  //     currency: "KHR",
  //     currencyDisplay: "symbol",
  //     minimumFractionDigits: 3,
  //   }).format(amount);
  // };
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("km-KH", {
      style: "currency",
      currency: "KHR",
      currencyDisplay: "symbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(amount)
      .replace("KHR", "៛");
  };

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

    setIsSubmitting(true);
    try {
      // Create route.ts or report/[id]/route.ts doesn't exist, we'll use POST with method: 'PUT'
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
        throw new Error("Failed to update report");
      }

      // Update the reports list
      const updatedReport = await response.json();
      setReports(
        reports.map((r) => (r.id === updatedReport.id ? updatedReport : r))
      );

      toast({
        title: "Success",
        description: "Report updated successfully",
      });

      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Error updating report:", error);
      toast({
        title: "Error",
        description: "Failed to update report. Please try again.",
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
        {/* Responsive filter controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 space-y-4 md:space-y-0">
          <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-2">
            <div className="flex items-center space-x-4">
              <div className="relative group">
                <Button
                  variant={reportType === "plan" ? "default" : "outline"}
                  onClick={() => setReportType("plan")}
                  className="w-full md:w-auto"
                  title="Morning plan reports for write-offs and 90+ days"
                >
                  Morning Plan
                </Button>
                {reportType === "plan" && (
                  <div className="absolute right-0 top-full mt-2 invisible group-hover:visible z-50">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateClick("plan");
                      }}
                      className="bg-blue-600 hover:bg-blue-700 flex items-center shadow-lg"
                      size="sm"
                    >
                      <PlusIcon className="h-4 w-4 mr-1" />
                      Create Plan
                    </Button>
                  </div>
                )}
              </div>
              <div className="relative group">
                <Button
                  variant={reportType === "actual" ? "default" : "outline"}
                  onClick={() => setReportType("actual")}
                  className="w-full md:w-auto"
                  title="Evening actual reports for write-offs and 90+ days"
                >
                  Evening Actual
                </Button>
                {reportType === "actual" && (
                  <div className="absolute right-0 top-full mt-2 invisible group-hover:visible z-50">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateClick("actual");
                      }}
                      className="bg-green-600 hover:bg-green-700 flex items-center shadow-lg"
                      size="sm"
                    >
                      <PlusIcon className="h-4 w-4 mr-1" />
                      Create Actual
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full md:w-auto justify-start text-left font-normal",
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
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => handleCreateClick(reportType)}
              className={cn(
                "flex items-center shadow-lg",
                reportType === "plan"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-green-600 hover:bg-green-700"
              )}
              title={`Create a new ${reportType} report`}
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Create {reportType === "plan" ? "Plan" : "Actual"}
            </Button>
            <Button
              onClick={handleFilter}
              variant="outline"
              disabled={isLoading}
              title="Apply date and type filters"
            >
              {isLoading ? "Loading..." : "Filter"}
            </Button>
          </div>
        </div>

        {/* Responsive table with horizontal scroll on small screens */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Branch</TableHead>
                <TableHead className="whitespace-nowrap">Date</TableHead>
                <TableHead className="whitespace-nowrap">
                  {reportType === "plan"
                    ? "Write-offs Plan"
                    : "Write-offs Actual"}
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  {reportType === "plan" ? "90+ Days Plan" : "90+ Days Actual"}
                </TableHead>
                {reportType === "actual" && (
                  <>
                    <TableHead className="whitespace-nowrap">
                      Plan Achievement %
                    </TableHead>
                  </>
                )}
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="whitespace-nowrap">
                  Submitted By
                </TableHead>
                <TableHead className="whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={reportType === "actual" ? 8 : 7}
                    className="text-center py-4"
                  >
                    Loading reports...
                  </TableCell>
                </TableRow>
              ) : reports.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={reportType === "actual" ? 8 : 7}
                    className="text-center py-4"
                  >
                    No reports found
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="whitespace-nowrap">
                      {report.branch.code}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(report.date)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatCurrency(report.writeOffs)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatCurrency(report.ninetyPlus)}
                    </TableCell>
                    {reportType === "actual" && (
                      <TableCell className="whitespace-nowrap">
                        {report.writeOffsPlan && report.writeOffs
                          ? `${(
                              (report.writeOffs / report.writeOffsPlan) *
                              100
                            ).toFixed(1)}%`
                          : "N/A"}
                      </TableCell>
                    )}
                    <TableCell className="whitespace-nowrap">
                      <Badge className={getStatusBadgeColor(report.status)}>
                        {report.status.charAt(0).toUpperCase() +
                          report.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {report.submittedBy}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditClick(report)}
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

        {/* Pagination controls */}
        {pagination.totalPages > 0 && (
          <div className="flex items-center justify-center space-x-2 mt-4">
            <Button
              variant="outline"
              size="icon"
              disabled={pagination.page <= 1 || isLoading}
              onClick={() => handlePageChange(pagination.page - 1)}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={pagination.page >= pagination.totalPages || isLoading}
              onClick={() => handlePageChange(pagination.page + 1)}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        )}

        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                Edit {reportType === "plan" ? "Morning Plan" : "Evening Actual"}{" "}
                Report
              </DialogTitle>
              <DialogDescription>
                Update the {reportType} report details for{" "}
                {editingReport?.branch.name} ({editingReport?.branch.code})
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="writeOffs" className="col-span-4">
                  {reportType === "plan"
                    ? "Write-offs Plan"
                    : "Write-offs Actual"}{" "}
                  (Amount in KHR)
                </Label>
                <Input
                  id="writeOffs"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editWriteOffs}
                  onChange={(e) => setEditWriteOffs(e.target.value)}
                  className="col-span-4"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="ninetyPlus" className="col-span-4">
                  {reportType === "plan" ? "90+ Days Plan" : "90+ Days Actual"}{" "}
                  (Amount in KHR)
                </Label>
                <Input
                  id="ninetyPlus"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editNinetyPlus}
                  onChange={(e) => setEditNinetyPlus(e.target.value)}
                  className="col-span-4"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="comments" className="col-span-4">
                  Comments
                </Label>
                <Textarea
                  id="comments"
                  value={editComments}
                  onChange={(e) => setEditComments(e.target.value)}
                  className="col-span-4"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateReport} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
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
          defaultBranchId={session?.user?.branchId || undefined}
        />
      </CardContent>
    </Card>
  );
}
