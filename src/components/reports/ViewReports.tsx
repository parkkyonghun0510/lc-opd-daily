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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  PencilIcon,
  Eye,
  MessageSquare,
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
import { CreateReportModal } from "@/components/reports/CreateReportModal";
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
import { UserDisplayName } from "@/components/user/UserDisplayName";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PaginationControl } from "@/components/ui/pagination-control";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { ReportDetailModal, CommentConversation } from "@/components/reports/ReportDetailModal";
import { CommentItem as CommentItemType } from "@/types/reports";
import { useAccessibleBranches } from "@/hooks/useAccessibleBranches";

// Define an extended type for reports with user information
interface ReportWithUser extends Report {
  user?: {
    id: string;
    name: string;
    username?: string;
  } | null;
}

export function ViewReports() {
  const { data: session } = useSession();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [editWriteOffs, setEditWriteOffs] = useState("");
  const [editNinetyPlus, setEditNinetyPlus] = useState("");
  const [editComments, setEditComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createReportType, setCreateReportType] = useState<"plan" | "actual">("plan");
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingReport, setViewingReport] = useState<ReportWithUser | null>(null);

  // Use the useAccessibleBranches hook for robust, DRY access
  const { branches: accessibleBranches, loading: branchesLoading, error: branchesError } = useAccessibleBranches();

  // Use the useReports hook for all data management
  const {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    reportType,
    setReportType,
    selectedBranchId,
    setSelectedBranchId,
    selectedUserId,
    setSelectedUserId,
    reports,
    isLoading,
    pagination,
    userBranches,
    handlePageChange,
    goToPage,
    setPageSize,
    handleFilter,
    clearFilters,
    updateReport,
    exportReportsToCSV,
    exportReportsToPDF,
    isExporting,
  } = useReports({
    initialStartDate: new Date(),
    initialEndDate: undefined,
  });

  // Prefer accessibleBranches, fallback to userBranches for backward compatibility
  const branchesToUse = accessibleBranches && accessibleBranches.length > 0 ? accessibleBranches : (userBranches || []);

  // If user has no branches assigned, show error message
  if (!branchesToUse || branchesToUse.length === 0) {
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
    // Only check date for rejected reports that need resubmission
    if (report.status === "rejected") {
      // Check if the report is from today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const reportDate = new Date(report.date);
      reportDate.setHours(0, 0, 0, 0);

      if (reportDate.getTime() !== today.getTime()) {
        toast({
          title: "Cannot Edit Report",
          description: "You can only edit rejected reports from today's session.",
          variant: "destructive",
        });
        return;
      }
    }

    // Only allow editing if user has access to the branch
    if (
      session?.user?.role !== "ADMIN" &&
      !branchesToUse.some((b) => b.id === report.branch.id)
    ) {
      toast({
        title: "Access Denied",
        description: "You can only edit reports for your accessible branches.",
        variant: "destructive",
      });
      return;
    }

    // If report is rejected, show rejection comments
    if (report.status === "rejected") {
      toast({
        title: "Report Rejected",
        description: report.comments || "This report was rejected. Please make the necessary corrections and resubmit.",
        variant: "destructive",
      });
    }

    setEditingReport(report);
    setEditWriteOffs(report.writeOffs.toString());
    setEditNinetyPlus(report.ninetyPlus.toString());
    // Start with empty comment text for new input instead of pre-filling with existing comments
    setEditComments("");
    setIsEditModalOpen(true);
  };

  const handleViewDetailsClick = (report: Report) => {
    // Create a ReportWithUser from the Report type to match what the modal expects
    const reportWithUser: ReportWithUser = {
      ...report,
      // Add any additional properties needed for ReportWithUser type
      user: null // The actual user data will be displayed via UserDisplayName component
    };

    setViewingReport(reportWithUser);
    setIsViewModalOpen(true);
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

    // Skip update if no changes were made
    if (
      writeOffsNum === editingReport.writeOffs &&
      ninetyPlusNum === editingReport.ninetyPlus &&
      !editComments.trim()
    ) {
      toast({
        title: "No Changes",
        description: "No changes were made to the report.",
      });
      setIsEditModalOpen(false);
      return;
    }

    setIsSubmitting(true);

    try {
      // Only include comments in the update if they were actually added
      const updatePayload: any = {
        id: editingReport.id,
        writeOffs: writeOffsNum,
        ninetyPlus: ninetyPlusNum,
      };

      // Only add comments to payload if user entered some text
      if (editComments.trim()) {
        // Format the comment as part of the conversation
        const timestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");
        const userName = session?.user?.name || "User";

        // If there are existing comments, append to them in conversation format
        if (editingReport.comments) {
          if (editingReport.status === "rejected") {
            // For rejected reports, format as a resubmission
            updatePayload.comments = `${editingReport.comments}\n[RESUBMISSION ${timestamp}]: ${editComments.trim()}`;
          } else {
            // For other reports, format as a regular comment
            updatePayload.comments = `${editingReport.comments}\n[COMMENT ${timestamp} by ${userName}]: ${editComments.trim()}`;
          }
        } else {
          // If no existing comments, just use the new comment
          updatePayload.comments = editComments.trim();
        }
      }

      const response = await fetch(`/api/reports`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatePayload),
      });



      if (!response.ok) {
        console.log('Resubmitting report:', {
          reportId: editingReport.id,
          reportStatus: editingReport.status,
          currentUser: session?.user?.id,
          submittedBy: editingReport.submittedBy
        });
        const error = await response.json();
        throw new Error(error.error || "Failed to update report");
      }

      const result = await response.json();

      toast({
        title: "Success",
        description: editingReport.status === "rejected"
          ? "Report resubmitted successfully. Waiting for approval."
          : "Report updated successfully",
      });

      setIsEditModalOpen(false);
      setEditingReport(null);
      // Refresh the reports list
      handleFilter();
    } catch (error) {
      console.error("Error updating report:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update report",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateClick = async (type: "plan" | "actual") => {
    if (type === "actual" && startDate) {
      setIsSubmitting(true);
      try {
        // Check if branch ID is valid before making the request
        if (!selectedBranchId) {
          toast({
            title: "Branch Required",
            description: "Please select a branch before creating a report.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }

        const formattedDate = format(startDate, "yyyy-MM-dd");
        const response = await fetch(
          `/api/reports?date=${formattedDate}&branchId=${selectedBranchId || session?.user?.branchId}&reportType=plan`
        );

        if (!response.ok) {
          throw new Error("No plan report exists for this date");
        }

        const planData = await response.json();
        if (!planData.data || planData.data.length === 0) {
          throw new Error("No plan report exists for this date");
        }

        // Plan report exists, now we can create an actual report
        setCreateReportType(type);
        setIsCreateModalOpen(true);
      } catch (error) {
        console.error("Error checking for plan report:", error);
        toast({
          title: "Plan Report Required",
          description:
            "A plan report must exist before you can create an actual report. Please create a plan report first.",
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setCreateReportType(type);
      setIsCreateModalOpen(true);
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM d, yyyy");
  };

  const formatCurrency = formatKHRCurrency;

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500 text-white";
      case "pending_approval":
        return "bg-blue-500 text-white";
      case "approved":
        return "bg-green-500 text-white";
      case "rejected":
        return "bg-red-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter section with its collapsible functionality */}
      <ReportFilters
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        selectedBranchId={selectedBranchId}
        setSelectedBranchId={setSelectedBranchId}
        selectedUserId={selectedUserId}
        setSelectedUserId={setSelectedUserId}
        reportType={reportType}
        setReportType={setReportType}
        status={status}
        setStatus={setStatus}
        handleFilter={handleFilter}
        clearFilters={clearFilters}
        exportToCSV={exportReportsToCSV}
        exportToPDF={exportReportsToPDF}
        isLoading={isLoading}
        isExporting={isExporting}
      />

      {/* Action buttons and results summary */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-2 gap-2">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {reports.length > 0 ? (
            <span>Showing {reports.length} reports {startDate && `from ${format(startDate, "MMM d, yyyy")}`}</span>
          ) : !isLoading ? (
            <span>No reports match your filter criteria</span>
          ) : null}
        </div>

        <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <Button
            onClick={() => handleCreateClick("plan")}
            variant="outline"
            className="flex-1 sm:flex-none bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/30"
          >
            <PlusIcon className="mr-1 h-4 w-4" />
            Plan Report
          </Button>
          <Button
            onClick={() => handleCreateClick("actual")}
            className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white"
          >
            <PlusIcon className="mr-1 h-4 w-4" />
            Actual Report
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center p-8 text-gray-500 dark:text-gray-400">
            <div className="mb-2">No reports found for the selected filters.</div>
            <div className="text-sm">Try adjusting your filter criteria or create a new report.</div>
          </div>
        ) : (
          <>
            {/* Regular table for larger screens */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Write-offs</TableHead>
                    <TableHead>90+ Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>{format(new Date(report.date), "MMM d, yyyy")}</TableCell>
                      <TableCell>{report.branch.name}</TableCell>
                      <TableCell className="capitalize">{report.reportType}</TableCell>
                      <TableCell>{formatKHRCurrency(report.writeOffs)}</TableCell>
                      <TableCell>{formatKHRCurrency(report.ninetyPlus)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            report.status === "approved" ? "default" :
                              report.status === "rejected" ? "destructive" :
                                "secondary"
                          }
                          className="capitalize"
                        >
                          {report.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <UserDisplayName userId={report.submittedBy} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleViewDetailsClick(report)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View Details</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {(report.status === "pending" ||
                            report.status === "rejected") && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleEditClick(report)}
                                    >
                                      <PencilIcon className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Edit Report</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>

            {/* Card view for mobile screens */}
            <div className="md:hidden space-y-4 p-4">
              {reports.map((report) => (
                <div key={report.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-medium">{format(new Date(report.date), "MMM d, yyyy")}</div>
                      <div className="text-sm text-gray-500">{report.branch.name}</div>
                    </div>
                    <Badge
                      variant={
                        report.status === "approved" ? "default" :
                          report.status === "rejected" ? "destructive" :
                            "secondary"
                      }
                      className="capitalize"
                    >
                      {report.status.replace("_", " ")}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <div className="text-xs text-gray-500">Write-offs</div>
                      <div className="font-medium">{formatKHRCurrency(report.writeOffs)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">90+ Days</div>
                      <div className="font-medium">{formatKHRCurrency(report.ninetyPlus)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Type</div>
                      <div className="capitalize">{report.reportType}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Submitted By</div>
                      <div className="text-sm">
                        <UserDisplayName userId={report.submittedBy} />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetailsClick(report)}
                      className="flex items-center"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>

                    {(report.status === "pending" || report.status === "rejected") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditClick(report)}
                        className="flex items-center"
                      >
                        <PencilIcon className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <PaginationControl
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                pageSize={pagination.limit}
                onPageChange={goToPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </>
        )}
      </div>

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
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="comments" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Comment History
                </Label>
                <Badge variant="outline" className="text-xs">
                  Conversation Thread
                </Badge>
              </div>
              {editingReport && editingReport.comments && (
                <div className="mb-2 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm">
                  <CommentConversation
                    comments={editingReport.comments}
                    commentArray={editingReport.commentArray}
                    reportId={editingReport.id}
                    onReplyAdded={() => { }}
                  />
                </div>
              )}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="response" className="text-sm font-medium flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5 mr-1" />
                    {editingReport && editingReport.status === "rejected" ? (
                      <>Add Your Response<span className="text-red-500">*</span></>
                    ) : (
                      "Add to Conversation"
                    )}
                  </Label>
                  {editingReport && editingReport.status === "rejected" && (
                    <Badge variant="destructive" className="text-xs">
                      Resubmission Required
                    </Badge>
                  )}
                </div>

                <div className="flex items-start gap-3 mb-2">
                  {/* User Avatar */}
                  <Avatar className="h-8 w-8 ring-2 ring-transparent hover:ring-blue-200 dark:hover:ring-blue-800 transition-all duration-200">
                    <AvatarImage
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${session?.user?.name || 'User'}`}
                      alt={session?.user?.name || 'User'}
                    />
                    <AvatarFallback className="bg-gradient-to-br from-blue-400 to-blue-600 text-white">
                      {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : 'U'}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <Textarea
                      id="response"
                      value={editComments}
                      onChange={(e) => setEditComments(e.target.value)}
                      placeholder={editingReport && editingReport.status === "rejected"
                        ? "Explain how you've addressed the rejection feedback..."
                        : "Add your comment to the conversation..."}
                      className="min-h-[100px] resize-none border-gray-300 focus:border-blue-500"
                    />

                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-500">
                        {editingReport && editingReport.status === "rejected"
                          ? "Your response will be added to the conversation thread."
                          : "Your comment will be added to the conversation history."}
                      </p>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-gray-500 hover:text-blue-600"
                        >
                          <span className="sr-only">Add emoji</span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-smile"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" x2="9.01" y1="9" y2="9" /><line x1="15" x2="15.01" y1="9" y2="9" /></svg>
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-gray-500 hover:text-blue-600"
                        >
                          <span className="sr-only">Attach file</span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-paperclip"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
            <Button
              onClick={handleUpdateReport}
              disabled={isSubmitting}
              variant={editingReport && editingReport.status === "rejected" ? "default" : "default"}
              className={editingReport && editingReport.status === "rejected"
                ? "bg-green-600 hover:bg-green-700 text-white"
                : ""}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {editingReport && editingReport.status === "rejected" ? "Resubmitting..." : "Updating..."}
                </>
              ) : (
                <>
                  {editingReport && editingReport.status === "rejected" && (
                    <MessageSquare className="mr-2 h-4 w-4" />
                  )}
                  {editingReport && editingReport.status === "rejected" ? "Resubmit Report" : "Update Report"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReportDetailModal
        report={viewingReport}
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        onEdit={handleEditClick}
      />

      <CreateReportModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        reportType={createReportType}
        onSuccess={() => {
          // Refresh reports after creating a new one
          handleFilter();
        }}
        userBranches={userBranches}
        selectedDate={startDate}
      />
    </div>
  );
}
