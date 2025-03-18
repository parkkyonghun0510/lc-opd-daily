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
  PlusIcon,
  PencilIcon,
} from "lucide-react";
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
import { Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { CreateReportModal } from "./CreateReportModal";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KHCurrencyInput } from "@/components/ui/currency-input";
import { useReports } from "@/hooks/useReports";
import type {
  Report,
  Branch,
  ReportType,
  CreateReportData,
} from "@/types/reports";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export function ViewReports() {
  const { data: session } = useSession();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [editWriteOffs, setEditWriteOffs] = useState("");
  const [editNinetyPlus, setEditNinetyPlus] = useState("");
  const [editComments, setEditComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createReportType, setCreateReportType] = useState<"plan" | "actual">(
    "plan"
  );

  // Use the useReports hook for all data management
  const {
    date,
    setDate,
    reportType,
    setReportType,
    selectedBranchId,
    setSelectedBranchId,
    reports,
    isLoading,
    pagination,
    userBranches,
    handlePageChange,
    handleFilter,
    updateReport,
  } = useReports({
    initialDate: new Date(),
  });

  // If user has no branches assigned, show error message
  if (!userBranches || userBranches.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>
            <p>
              You are not assigned to any branches. Please contact your
              administrator to get access.
            </p>
            <p>
              If you are an administrator, please go to the{" "}
              <Link href="/admin/branches">branches {userBranches.length}</Link> page to assign
              branches to users.
            </p>
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleEditClick = (report: Report) => {
    // Only allow editing if user has access to the branch
    if (
      session?.user?.role !== "ADMIN" &&
      session?.user?.branchId !== report.branch.id
    ) {
      toast({
        title: "Access Denied",
        description: "You can only edit reports for your assigned branch.",
        variant: "destructive",
      });
      return;
    }

    setEditingReport(report);
    setEditWriteOffs(report.writeOffs.toString());
    setEditNinetyPlus(report.ninetyPlus.toString());
    setEditComments(report.comments || "");
    setIsEditModalOpen(true);
  };

  const handleUpdateReport = async () => {
    if (!editingReport) return;

    // Parse and validate the numeric inputs
    const writeOffsNum = editWriteOffs ? parseFloat(editWriteOffs) : 0;
    const ninetyPlusNum = editNinetyPlus ? parseFloat(editNinetyPlus) : 0;

    if (isNaN(writeOffsNum) || writeOffsNum < 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid Write-offs amount",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(ninetyPlusNum) || ninetyPlusNum < 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid 90+ Days amount",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const updateData: Partial<CreateReportData> = {
        date: editingReport.date,
        branchId: editingReport.branch.id,
        reportType: editingReport.reportType,
        writeOffs: writeOffsNum,
        ninetyPlus: ninetyPlusNum,
        comments: editComments
      };

      const success = await updateReport(editingReport.id, updateData);

      if (success) {
        setIsEditModalOpen(false);
        toast({
          title: "Success",
          description: "Report updated successfully",
        });
      }
    } catch {
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
    // For actual reports, check if plan exists
    if (type === "actual" && date) {
      const planExists = reports.some(
        (report) =>
          report.reportType === "plan" &&
          report.date === format(date, "yyyy-MM-dd") &&
          report.branch.id === selectedBranchId
      );

      if (!planExists) {
        toast({
          title: "Cannot Create Actual Report",
          description:
            "Morning plan must be submitted before evening actual report",
          variant: "destructive",
        });
        return;
      }
    }

    setCreateReportType(type);
    setIsCreateModalOpen(true);
  };

  const formatDate = (dateString: string) => {
    return dateString; // The date is already in YYYY-MM-DD format
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>View Reports</CardTitle>
        <CardDescription>
          Browse and filter{" "}
          {reportType === "plan" ? "morning plan" : "evening actual"} reports
        </CardDescription>
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

            {/* Branch selector for admin users or users with multiple branches */}
            {userBranches.length > 1 && (
              <Select
                value={selectedBranchId}
                onValueChange={setSelectedBranchId}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {userBranches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Reports table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Write-offs</TableHead>
                {reportType === "actual" && (
                  <TableHead>Write-offs (Plan)</TableHead>
                )}
                <TableHead>90+ Days</TableHead>
                {reportType === "actual" && (
                  <TableHead>90+ Days (Plan)</TableHead>
                )}
                <TableHead>Comments</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    No reports found for the selected filters
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>{formatDate(report.date)}</TableCell>
                    <TableCell>{report.branch.name}</TableCell>
                    <TableCell>{formatCurrency(report.writeOffs)}</TableCell>
                    {reportType === "actual" && (
                      <TableCell>
                        {report.writeOffsPlan !== null
                          ? formatCurrency(report.writeOffsPlan)
                          : "-"}
                      </TableCell>
                    )}
                    <TableCell>{formatCurrency(report.ninetyPlus)}</TableCell>
                    {reportType === "actual" && (
                      <TableCell>
                        {report.ninetyPlusPlan !== null
                          ? formatCurrency(report.ninetyPlusPlan)
                          : "-"}
                      </TableCell>
                    )}
                    <TableCell className="max-w-[200px] truncate">
                      {report.comments || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "text-white",
                          getStatusBadgeColor(report.status)
                        )}
                      >
                        {report.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditClick(report)}
                        disabled={
                          session?.user?.role !== "admin" &&
                          session?.user?.branchId !== report.branch.id
                        }
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

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {pagination.page} of {pagination.totalPages} pages
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Report</DialogTitle>
            <DialogDescription>
              Update the report details below
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="writeOffs">Write-offs</Label>
              <KHCurrencyInput
                id="writeOffs"
                value={editWriteOffs}
                onValueChange={setEditWriteOffs}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ninetyPlus">90+ Days</Label>
              <KHCurrencyInput
                id="ninetyPlus"
                value={editNinetyPlus}
                onValueChange={setEditNinetyPlus}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="comments">Comments</Label>
              <Textarea
                id="comments"
                value={editComments}
                onChange={(e) => setEditComments(e.target.value)}
                placeholder="Enter comments..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSubmitting}
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
                "Update Report"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Modal */}
      <CreateReportModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        reportType={createReportType}
        onSuccess={() => {
          // Refresh the reports list
          handleFilter();
        }}
        userBranches={userBranches}
      />
    </Card>
  );
}
