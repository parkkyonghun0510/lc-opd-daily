import { useState, useEffect } from "react";
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
  AlertTriangle,
  AlertCircle,
  Info,
  User,
  RefreshCw,
  MessageSquare,
  Clock,
  Eye
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { formatKHRCurrency, cn, formatDate } from "@/lib/utils";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { Permission, UserRole } from "@/lib/auth/roles";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { UserDisplayName } from "@/components/user/UserDisplayName";
import { approveReportAction } from "@/app/_actions/report-actions";
import { useSession } from "next-auth/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type ReportStatus = "pending" | "pending_approval" | "approved" | "rejected";

interface Report {
  id: string;
  date: string;
  branchId: string;
  writeOffs: number;
  ninetyPlus: number;
  status: ReportStatus;
  reportType: string;
  content?: string;
  submittedBy?: string;
  comments?: string | null;
  user?: {
    name: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
  ReportComment?: Array<{
    id: string;
    reportId: string;
    userId: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    user?: {
      id: string;
      name?: string;
      username?: string;
    };
  }>;
  branch?: {
    id: string;
    name: string;
    code: string;
  };
}

interface ReportApprovalProps {
  report: Report;
  onApprovalComplete: () => void;
  branchName: string;
}

const formatCommentHistory = (comments: string) => {
  // Split the comments by the resubmission pattern
  const parts = comments.split(/\[RESUBMISSION ([^:]+)]:/).filter(Boolean);

  if (parts.length <= 1) {
    // No resubmission markers, just return the original text
    return {
      hasConversation: false,
      formattedComments: comments
    };
  }

  // Format as a conversation with timestamps
  const conversation = [];
  for (let i = 0; i < parts.length; i += 2) {
    if (i === 0 && parts[i].trim()) {
      // First part is the original rejection comment
      conversation.push({
        type: 'rejection',
        date: '',
        text: parts[i].trim()
      });
    } else if (i < parts.length - 1) {
      // This is a resubmission date followed by its comment
      conversation.push({
        type: 'resubmission',
        date: parts[i],
        text: (i + 1 < parts.length) ? parts[i + 1].trim() : ''
      });
    }
  }

  return {
    hasConversation: true,
    conversation
  };
};

// Component to render a comment conversation
const CommentConversation = ({ comments }: { comments: string }) => {
  const result = formatCommentHistory(comments);

  if (!result.hasConversation) {
    return (
      <p className="whitespace-pre-wrap">
        {comments || "No comments available"}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {result.conversation?.map((entry, index) => (
        <div
          key={index}
          className={cn(
            "p-3 rounded-md",
            entry.type === 'rejection'
              ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
              : "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
          )}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={cn(
              "text-xs font-medium",
              entry.type === 'rejection'
                ? "text-red-800 dark:text-red-300"
                : "text-blue-800 dark:text-blue-300"
            )}>
              {entry.type === 'rejection' ? "Rejection Feedback" : "Resubmission"}
            </span>
            {entry.date && (
              <span className={cn(
                "text-xs",
                entry.type === 'rejection'
                  ? "text-red-700 dark:text-red-400"
                  : "text-blue-700 dark:text-blue-400"
              )}>
                {entry.date}
              </span>
            )}
          </div>
          <p className={cn(
            "text-sm whitespace-pre-wrap",
            entry.type === 'rejection'
              ? "text-red-800 dark:text-red-200"
              : "text-blue-800 dark:text-blue-200"
          )}>
            {entry.text}
          </p>
        </div>
      ))}
    </div>
  );
};

export function ReportApproval({
  report,
  onApprovalComplete,
  branchName,
}: ReportApprovalProps) {
  const { data: session } = useSession();
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isViewCommentsDialogOpen, setIsViewCommentsDialogOpen] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasShownCommentToast, setHasShownCommentToast] = useState(false);

  // Show a toast notification for users about available comments - with stable dependencies
  useEffect(() => {
    // Use a ref to track if we've shown the toast to avoid dependency on state
    const hasCommentsToShow = report.comments &&
      !hasShownCommentToast &&
      report.status !== "pending" &&
      report.status !== "pending_approval";

    if (hasCommentsToShow) {
      // toast({
      //   title: `${report.status === "approved" ? "Approval" : "Rejection"} Comments Available`,
      //   description: "Click 'View Comments' to see manager feedback.",
      //   duration: 1000,
      // });
      setHasShownCommentToast(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.comments, report.status]);

  const handleApprovalAction = async () => {
    // Capture the current dialog state to avoid race conditions
    const isApproving = isApproveDialogOpen;
    const isRejecting = isRejectDialogOpen;
    const currentRemarks = remarks.trim();

    if (!currentRemarks && isRejecting) {
      toast({
        title: "Remarks Required",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const status = isApproving ? "approved" : "rejected";

      // Use server action instead of fetch API
      const result = await approveReportAction(
        report.id,
        status as 'approved' | 'rejected',
        currentRemarks,
        true // notifyUsers
      );

      if (!result.success) {
        throw new Error(result.error || `Failed to ${status} report`);
      }

      toast({
        title: "Success",
        description: result.message || `Report ${status} successfully`,
      });

      // Reset all state in a single batch to avoid multiple re-renders
      setIsApproveDialogOpen(false);
      setIsRejectDialogOpen(false);
      setRemarks("");

      // Call the callback after state updates
      setTimeout(() => {
        onApprovalComplete();
      }, 0);
    } catch (error) {
      console.error(`Error ${isApproving ? "approving" : "rejecting"} report:`, error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to process report`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openApproveDialog = () => {
    setIsApproveDialogOpen(true);
    setIsRejectDialogOpen(false);
    setRemarks("");
  };

  const openRejectDialog = () => {
    setIsRejectDialogOpen(true);
    setIsApproveDialogOpen(false);
    setRemarks("");
  };

  // Only render if the report is in pending status
  if (report.status !== "pending_approval") {
    const userRole = session?.user?.role as UserRole || UserRole.USER;

    return (
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Badge
            variant={report.status === "approved" ? "default" : "destructive"}
            className={cn(
              "capitalize",
              report.status === "approved" ? "bg-green-500" : ""
            )}
          >
            {report.status}
          </Badge>

          {report.status === "rejected" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Navigate to edit page with the report ID
                window.location.href = `/dashboard/reports/${report.id}/edit`;
              }}
              className="ml-2 bg-blue-500 hover:bg-blue-600 text-white"
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              Resubmit Report
            </Button>
          )}
        </div>

        {report.comments && (
          <div>
            {/* Make comments more discoverable with a prominent button */}
            <Button
              variant={report.status === "approved" ? "default" : "destructive"}
              size="sm"
              onClick={() => setIsViewCommentsDialogOpen(true)}
              className={cn(
                "mt-2 w-full justify-start",
                report.status === "approved"
                  ? "bg-green-100 text-green-800 hover:bg-green-200 border border-green-300"
                  : "bg-red-100 text-red-800 hover:bg-red-200 border border-red-300"
              )}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              <span className="font-medium">View {report.status === "approved" ? "Approval" : "Rejection"} Comments</span>
              <Eye className="ml-2 h-4 w-4" />
            </Button>

            {/* Role-specific guidance */}
            {(userRole === UserRole.USER || userRole === UserRole.SUPERVISOR) && report.status === "rejected" && (
              <Alert variant="destructive" className="mt-2 py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Action Required</AlertTitle>
                <AlertDescription>
                  This report was rejected. Please review the comments and resubmit.
                </AlertDescription>
              </Alert>
            )}

            {userRole === UserRole.BRANCH_MANAGER && (
              <Alert className="mt-2 py-2">
                <Info className="h-4 w-4" />
                <AlertTitle>Manager Info</AlertTitle>
                <AlertDescription>
                  Comments are available for this {report.status} report.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </div>
    );
  }

  // For reports that are pending approval, show the approval controls and comments if available
  return (
    <div className="space-y-3">
      <PermissionGate permissions={[Permission.APPROVE_REPORTS]}>
        <div className="flex flex-wrap gap-2">
          <Button
            className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
            size="sm"
            onClick={openApproveDialog}
            disabled={report.status !== "pending_approval"}
          >
            <CheckCircle className="mr-1 h-4 w-4" />
            Approve
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="dark:bg-red-700 dark:hover:bg-red-600"
            onClick={openRejectDialog}
            disabled={report.status !== "pending_approval"}
          >
            <XCircle className="mr-1 h-4 w-4" />
            Reject
          </Button>
        </div>
      </PermissionGate>

      {/* Show comments directly in the interface if available */}
      {report.comments && (
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Comments</Label>
          </div>
          <div className="p-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
            <CommentConversation comments={report.comments} />
            {report.updatedAt && (
              <div className="flex items-center gap-1 mt-2 text-xs text-gray-500 dark:text-gray-500">
                <Clock className="h-3 w-3" />
                <span>Last updated: {formatDate(report.updatedAt)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Comments Dialog - keep this for detailed view */}
      <Dialog open={isViewCommentsDialogOpen} onOpenChange={setIsViewCommentsDialogOpen}>
        <DialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Report Comments</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Comments for report from {branchName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-500 dark:text-gray-400">Write-offs</Label>
                <div className="font-semibold dark:text-gray-200">{formatKHRCurrency(report.writeOffs)}</div>
              </div>
              <div>
                <Label className="text-sm text-gray-500 dark:text-gray-400">90+ Days</Label>
                <div className="font-semibold dark:text-gray-200">{formatKHRCurrency(report.ninetyPlus)}</div>
              </div>
            </div>
            <div>
              <Label className="dark:text-gray-200">Comments</Label>
              <div className={cn(
                "mt-2 p-4 rounded-md",
                (report.status as ReportStatus) === "approved"
                  ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                  : (report.status as ReportStatus) === "rejected"
                    ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                    : "bg-gray-100 dark:bg-gray-700"
              )}>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                  <Clock className="h-4 w-4" />
                  <span>Last updated: {report.updatedAt ? formatDate(report.updatedAt) : "N/A"}</span>
                </div>
                <CommentConversation comments={report.comments || "No comments available"} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsViewCommentsDialogOpen(false)}
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="dark:text-gray-100">Approve Report</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              You are about to approve the report for {branchName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-500 dark:text-gray-400">Write-offs</Label>
                <div className="font-semibold dark:text-gray-200">{formatKHRCurrency(report.writeOffs)}</div>
              </div>
              <div>
                <Label className="text-sm text-gray-500 dark:text-gray-400">90+ Days</Label>
                <div className="font-semibold dark:text-gray-200">{formatKHRCurrency(report.ninetyPlus)}</div>
              </div>
            </div>
            <div>
              <Label htmlFor="approval-remarks" className="dark:text-gray-200">Comments (optional)</Label>
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
            <DialogTitle className="dark:text-gray-100">Reject Report</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Please provide a reason for rejecting this report
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-gray-500 dark:text-gray-400">Write-offs</Label>
                <div className="font-semibold dark:text-gray-200">{formatKHRCurrency(report.writeOffs)}</div>
              </div>
              <div>
                <Label className="text-sm text-gray-500 dark:text-gray-400">90+ Days</Label>
                <div className="font-semibold dark:text-gray-200">{formatKHRCurrency(report.ninetyPlus)}</div>
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
