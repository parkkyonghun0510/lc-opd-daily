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
} from "@/components/ui/dialog";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { formatKHRCurrency, cn } from "@/lib/utils";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { Permission } from "@/lib/auth/roles";

interface Report {
  id: string;
  date: string;
  branchId: string;
  writeOffs: number;
  ninetyPlus: number;
  status: string;
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

  const handleApprovalAction = async () => {
    if (!approvalAction) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/reports/${report.id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: approvalAction === "approve" ? "approved" : "rejected",
          comments: comments,
          notifyUsers: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${approvalAction} report`);
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
      toast({
        title: "Action Failed",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openApproveDialog = () => {
    setApprovalAction("approve");
    setComments("");
    setIsDialogOpen(true);
  };

  const openRejectDialog = () => {
    setApprovalAction("reject");
    setComments("");
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
        <Button
          size="sm"
          onClick={openApproveDialog}
          className="bg-green-600 hover:bg-green-700"
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={openRejectDialog}
          className="text-red-600 border-red-600 hover:bg-red-50"
        >
          <XCircle className="h-4 w-4 mr-1" />
          Reject
        </Button>
      </div>

      {/* Approval/Rejection Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === "approve"
                ? "Approve Report"
                : "Reject Report"}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Branch</h3>
              <p>{branchName}</p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Date</h3>
              <p>{new Date(report.date).toLocaleDateString()}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-medium">Write-offs</h3>
                <p className="font-mono">
                  {formatKHRCurrency(report.writeOffs)}
                </p>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-medium">90+ Days</h3>
                <p className="font-mono">
                  {formatKHRCurrency(report.ninetyPlus)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">
                {approvalAction === "approve"
                  ? "Approval Comments (Optional)"
                  : "Rejection Reason (Required)"}
              </h3>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder={
                  approvalAction === "approve"
                    ? "Add any approval comments..."
                    : "Explain why this report is being rejected..."
                }
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprovalAction}
              disabled={
                isSubmitting || (approvalAction === "reject" && !comments)
              }
              className={cn(
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
