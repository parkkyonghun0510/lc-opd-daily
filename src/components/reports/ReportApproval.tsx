import { useState } from "react";
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
  Info,
  User
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { formatKHRCurrency, cn } from "@/lib/utils";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { Permission } from "@/lib/auth/roles";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { UserDisplayName } from "@/components/user/UserDisplayName";

interface Report {
  id: string;
  date: string;
  branchId: string;
  writeOffs: number;
  ninetyPlus: number;
  status: string;
  submittedBy?: string;
  user?: {
    name: string;
    username: string;
  };
  // Other fields...
}

interface ReportApprovalProps {
  report: Report;
  onApprovalComplete: () => void;
  branchName: string;
}

export function ReportApproval({
  report,
  onApprovalComplete,
  branchName,
}: ReportApprovalProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comments, setComments] = useState("");
  const [approvalAction, setApprovalAction] = useState<
    "approve" | "reject" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const handleApprovalAction = async () => {
    if (!approvalAction) return;
    
    // Validate form
    if (approvalAction === "reject" && !comments.trim()) {
      setError("Please provide a reason for rejection");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/reports/${report.id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: approvalAction === "approve" ? "approved" : "rejected",
          comments: comments.trim(),
          notifyUsers: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${approvalAction} report`);
      }

      toast({
        title:
          approvalAction === "approve" ? "Report Approved" : "Report Rejected",
        description: `Successfully ${
          approvalAction === "approve" ? "approved" : "rejected"
        } the report for ${branchName}`,
        variant: approvalAction === "approve" ? "default" : "destructive",
      });

      setIsDialogOpen(false);
      onApprovalComplete();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred";
      setError(errorMessage);
      toast({
        title: "Action Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openApproveDialog = () => {
    setApprovalAction("approve");
    setComments("");
    setError(null);
    setIsDialogOpen(true);
  };

  const openRejectDialog = () => {
    setApprovalAction("reject");
    setComments("");
    setError(null);
    setIsDialogOpen(true);
  };

  // Only render if the report is in pending status
  if (report.status !== "pending") {
    return (
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
      </div>
    );
  }

  return (
    <PermissionGate
      permissions={[Permission.APPROVE_REPORTS]}
      fallback={<Badge variant="outline">Awaiting Approval</Badge>}
    >
      <div className="flex space-x-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                onClick={openApproveDialog}
                className="bg-green-600 hover:bg-green-700 transition-colors"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Approve
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Approve this report</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={openRejectDialog}
                className="text-red-600 border-red-600 hover:bg-red-50 transition-colors"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Reject this report (requires reason)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Approval/Rejection Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className={cn(
              "flex items-center",
              approvalAction === "approve" ? "text-green-600" : "text-red-600"
            )}>
              {approvalAction === "approve" ? (
                <CheckCircle className="h-5 w-5 mr-2" />
              ) : (
                <XCircle className="h-5 w-5 mr-2" />
              )}
              {approvalAction === "approve"
                ? "Approve Report"
                : "Reject Report"}
            </DialogTitle>
            <DialogDescription>
              {approvalAction === "approve"
                ? "You are about to approve this report from "
                : "You are about to reject this report from "}
              <span className="font-medium">
                {report.submittedBy ? (
                  <UserDisplayName userId={report.submittedBy} />
                ) : (
                  report.user?.name || report.user?.username || "Unknown user"
                )}
              </span>{" "}
              for <span className="font-medium">{branchName}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Branch</Label>
              <div className="text-sm bg-gray-50 p-2 rounded-md">
                {branchName}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <div className="text-sm bg-gray-50 p-2 rounded-md">
                {new Date(report.date).toLocaleDateString('en-US', { 
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric' 
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-md">
              <div className="space-y-1">
                <Label>Write-offs</Label>
                <p className="font-mono text-sm">
                  {formatKHRCurrency(report.writeOffs)}
                </p>
              </div>
              <div className="space-y-1">
                <Label>90+ Days</Label>
                <p className="font-mono text-sm">
                  {formatKHRCurrency(report.ninetyPlus)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className={cn(
                  approvalAction === "reject" && "text-red-500"
                )}>
                  {approvalAction === "approve"
                    ? "Approval Comments (Optional)"
                    : "Rejection Reason"}
                  {approvalAction === "reject" && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </Label>
                {approvalAction === "reject" && (
                  <span className="text-xs text-gray-500">Required</span>
                )}
              </div>
              <Textarea
                value={comments}
                onChange={(e) => {
                  setComments(e.target.value);
                  if (error && e.target.value.trim()) {
                    setError(null);
                  }
                }}
                placeholder={
                  approvalAction === "approve"
                    ? "Add any approval comments..."
                    : "Explain why this report is being rejected..."
                }
                className={cn(
                  "min-h-[100px]",
                  error && "border-red-500 focus-visible:ring-red-500"
                )}
              />
              {error && (
                <div className="flex items-center text-xs text-red-500 mt-1">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {error}
                </div>
              )}
            </div>

            {approvalAction === "approve" && (
              <div className="flex items-start p-3 bg-blue-50 rounded-md">
                <Info className="h-5 w-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-700">
                  Approving this report will make it visible in reports and analytics.
                  The submitter will be notified of your action.
                </div>
              </div>
            )}

            {approvalAction === "reject" && (
              <div className="flex items-start p-3 bg-amber-50 rounded-md">
                <AlertTriangle className="h-5 w-5 text-amber-600 mr-2 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-700">
                  Rejecting this report will return it to the submitter with your feedback.
                  They will need to make corrections and resubmit.
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSubmitting}
              className="mr-2"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprovalAction}
              disabled={
                isSubmitting || (approvalAction === "reject" && !comments.trim())
              }
              className={cn(
                "transition-colors",
                approvalAction === "approve"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : approvalAction === "approve" ? (
                "Confirm Approval"
              ) : (
                "Confirm Rejection"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PermissionGate>
  );
}
