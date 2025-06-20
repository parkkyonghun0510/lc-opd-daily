"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  RefreshCw,
  MessageSquare,
  Clock,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { formatKHRCurrency, cn, formatDate } from "@/lib/utils";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { Permission, UserRole } from "@/lib/auth/roles";
import { Label } from "@/components/ui/label";
import { approveReportAction } from "@/app/_actions/report-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ReportCommentsList } from "@/components/reports/ReportCommentsList";
import { Report, ReportStatus, ReportCommentType } from "@/types/reports";
import { format, parseISO, isValid } from "date-fns";

interface EnhancedReportApprovalProps {
  report: Report;
  onApprovalComplete: () => void;
}

// Helper function to safely format dates with improved performance
const safeFormatDate = (
  dateValue: string | Date | null | undefined,
): string => {
  if (!dateValue) return "N/A";

  try {
    // If it's already a string in ISO format, try to parse and format it
    if (typeof dateValue === "string") {
      // Check if it's already in the desired format (yyyy-MM-dd)
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        return dateValue;
      }

      // Try to parse as ISO date
      const parsedDate = parseISO(dateValue);
      if (isValid(parsedDate)) {
        return format(parsedDate, "yyyy-MM-dd");
      }

      // If not a valid ISO date, return as is
      return dateValue;
    }

    // If it's a Date object, format it
    if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
      return format(dateValue, "yyyy-MM-dd");
    }

    // Try to convert to Date and format
    const date = new Date(dateValue as any);
    if (!isNaN(date.getTime())) {
      return format(date, "yyyy-MM-dd");
    }

    return String(dateValue);
  } catch (error) {
    console.error("Error formatting date:", error);
    return String(dateValue);
  }
};

export function EnhancedReportApproval({
  report,
  onApprovalComplete,
}: EnhancedReportApprovalProps) {
  const { data: session } = useSession();
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processedReport, setProcessedReport] = useState<Report | null>(null);

  const branchName = report.branch?.name || "Unknown Branch";
  const userRole = (session?.user?.role as UserRole) || UserRole.USER;

  // Process the report to ensure all dates are strings using useMemo for better performance
  const processedReportData = useMemo(() => {
    if (!report) return null;

    // Create a deep copy of the report with dates converted to strings
    return {
      ...report,
      date: safeFormatDate(report.date),
      submittedAt:
        typeof report.submittedAt === "string"
          ? report.submittedAt
          : safeFormatDate(report.submittedAt),
      updatedAt: report.updatedAt
        ? safeFormatDate(report.updatedAt)
        : undefined,
      // Process ReportComment dates if they exist
      ReportComment: report.ReportComment
        ? report.ReportComment.map((comment) => ({
            ...comment,
            createdAt:
              typeof comment.createdAt === "string"
                ? comment.createdAt
                : safeFormatDate(comment.createdAt),
            updatedAt:
              typeof comment.updatedAt === "string"
                ? comment.updatedAt
                : safeFormatDate(comment.updatedAt),
          }))
        : undefined,
    };
  }, [report]);

  // Update the processed report state when the memoized data changes
  useEffect(() => {
    if (processedReportData) {
      setProcessedReport(processedReportData);
    }
  }, [processedReportData]);

  const handleApprovalAction = useCallback(async () => {
    // Validate remarks for rejection
    if (!remarks.trim() && isRejectDialogOpen) {
      toast({
        title: "Remarks Required",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    // Make sure we have a processed report
    if (!processedReport) {
      toast({
        title: "Error",
        description: "Report data is not ready yet",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const status = isApproveDialogOpen ? "approved" : "rejected";

      // Use server action
      const result = await approveReportAction(
        processedReport.id,
        status as "approved" | "rejected",
        remarks.trim(),
        true, // notifyUsers
      );

      if (!result.success) {
        throw new Error(result.error || `Failed to ${status} report`);
      }

      toast({
        title: "Success",
        description: result.message || `Report ${status} successfully`,
      });

      // Reset state and notify parent
      setIsApproveDialogOpen(false);
      setIsRejectDialogOpen(false);
      setRemarks("");
      onApprovalComplete();
    } catch (error) {
      console.error(
        `Error ${isApproveDialogOpen ? "approving" : "rejecting"} report:`,
        error,
      );
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : `Failed to process report`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    remarks,
    isRejectDialogOpen,
    isApproveDialogOpen,
    processedReport,
    onApprovalComplete,
  ]);

  // Helper functions to open dialogs with useCallback for better performance
  const openApproveDialog = useCallback(() => {
    setIsApproveDialogOpen(true);
    setIsRejectDialogOpen(false);
    setRemarks("");
  }, []);

  const openRejectDialog = useCallback(() => {
    setIsRejectDialogOpen(true);
    setIsApproveDialogOpen(false);
    setRemarks("");
  }, []);

  // Render status badge with appropriate styling using useMemo for better performance
  const renderStatusBadge = useCallback((status: ReportStatus) => {
    const variants = {
      pending: "secondary",
      pending_approval: "secondary",
      approved: "success",
      rejected: "destructive",
    };

    return (
      <Badge variant={variants[status] as any} className="capitalize">
        {status.replace("_", " ")}
      </Badge>
    );
  }, []);

  // If the report is still being processed, show an enhanced loading state with skeleton
  if (!processedReport) {
    return (
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
          <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
        </div>

        <div className="flex flex-wrap gap-2 mt-2">
          <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse"></div>
          <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse"></div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
          <div className="h-20 w-full bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse"></div>
          <div className="h-20 w-full bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse"></div>
        </div>
      </div>
    );
  }

  // For reports that are already approved or rejected
  if (
    processedReport.status !== "pending" &&
    processedReport.status !== "pending_approval"
  ) {
    return (
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          {renderStatusBadge(processedReport.status)}

          {/* Show resubmit button for rejected reports */}
          {processedReport.status === "rejected" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = `/dashboard/reports/${processedReport.id}/edit`;
              }}
              className="ml-2 bg-blue-500 hover:bg-blue-600 text-white"
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              Resubmit Report
            </Button>
          )}
        </div>

        {/* Role-specific guidance */}
        {(userRole === UserRole.USER || userRole === UserRole.SUPERVISOR) &&
          processedReport.status === "rejected" && (
            <Alert variant="destructive" className="mt-2 py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Action Required</AlertTitle>
              <AlertDescription>
                This report was rejected. Please review the comments and
                resubmit.
              </AlertDescription>
            </Alert>
          )}

        {userRole === UserRole.BRANCH_MANAGER && (
          <Alert className="mt-2 py-2">
            <Info className="h-4 w-4" />
            <AlertTitle>Manager Info</AlertTitle>
            <AlertDescription>
              {processedReport.status === "approved"
                ? "You have approved this report."
                : "You have rejected this report."}
            </AlertDescription>
          </Alert>
        )}

        {/* Display comments using ReportCommentsList component */}
        <div className="mt-4">
          <ReportCommentsList
            reportId={processedReport.id}
            initialComments={
              processedReport.ReportComment as ReportCommentType[]
            }
          />
        </div>
      </div>
    );
  }

  // For reports that are pending approval
  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-2">
        {renderStatusBadge(processedReport.status)}
        <span className="text-sm text-gray-500">
          Submitted on {formatDate(processedReport.submittedAt)}
        </span>
      </div>

      {/* Approval actions */}
      <PermissionGate permissions={[Permission.APPROVE_REPORTS]}>
        <div className="flex flex-wrap gap-2 mt-2">
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            size="sm"
            onClick={openApproveDialog}
          >
            <CheckCircle className="mr-1 h-4 w-4" />
            Approve
          </Button>
          <Button variant="destructive" size="sm" onClick={openRejectDialog}>
            <XCircle className="mr-1 h-4 w-4" />
            Reject
          </Button>
        </div>
      </PermissionGate>

      {/* Display existing comments */}
      {processedReport.ReportComment &&
        processedReport.ReportComment.length > 0 && (
          <div className="mt-4">
            <ReportCommentsList
              reportId={processedReport.id}
              initialComments={
                processedReport.ReportComment as ReportCommentType[]
              }
            />
          </div>
        )}

      {/* Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">
              Approve Report
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              You are about to approve the report for {branchName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-500 dark:text-gray-400">
                  Write-offs
                </Label>
                <div className="font-semibold dark:text-gray-200">
                  {formatKHRCurrency(processedReport.writeOffs)}
                </div>
              </div>
              <div>
                <Label className="text-sm text-gray-500 dark:text-gray-400">
                  90+ Days
                </Label>
                <div className="font-semibold dark:text-gray-200">
                  {formatKHRCurrency(processedReport.ninetyPlus)}
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="approval-remarks" className="dark:text-gray-200">
                Comments (optional)
              </Label>
              <Textarea
                id="approval-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add any comments about this approval"
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder:text-gray-400"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsApproveDialogOpen(false)}
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprovalAction}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Approve Report"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">
              Reject Report
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Please provide a reason for rejecting this report
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-500 dark:text-gray-400">
                  Write-offs
                </Label>
                <div className="font-semibold dark:text-gray-200">
                  {formatKHRCurrency(processedReport.writeOffs)}
                </div>
              </div>
              <div>
                <Label className="text-sm text-gray-500 dark:text-gray-400">
                  90+ Days
                </Label>
                <div className="font-semibold dark:text-gray-200">
                  {formatKHRCurrency(processedReport.ninetyPlus)}
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="rejection-remarks" className="dark:text-gray-200">
                Reason for Rejection <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="rejection-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Please explain why this report is being rejected"
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:placeholder:text-gray-400"
              />
              <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                This information will be shared with the report submitter
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRejectDialogOpen(false)}
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleApprovalAction}
              disabled={isSubmitting}
              className="dark:bg-red-700 dark:hover:bg-red-600"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Reject Report"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
