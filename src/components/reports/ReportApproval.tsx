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
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApprovalAction = async () => {
    if (!remarks.trim() && isRejectDialogOpen) {
      toast({
        title: "Remarks Required",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const approvalAction = isApproveDialogOpen ? "approve" : "reject";
      
      const response = await fetch(`/api/reports/${report.id}/${approvalAction}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          remarks: remarks.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${approvalAction} report`);
      }

      toast({
        title: "Success",
        description: `Report ${isApproveDialogOpen ? "approved" : "rejected"} successfully`,
      });

      setIsApproveDialogOpen(false);
      setIsRejectDialogOpen(false);
      setRemarks("");
      onApprovalComplete();
    } catch (error) {
      console.error(`Error ${isApproveDialogOpen ? "approving" : "rejecting"} report:`, error);
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
  if (report.status !== "pending" && report.status !== "pending_approval") {
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
    <div>
      <PermissionGate permissions={[Permission.APPROVE_REPORTS]}>
        <div className="flex flex-wrap gap-2">
          <Button
            className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
            size="sm"
            onClick={openApproveDialog}
            disabled={report.status !== "pending"}
          >
            <CheckCircle className="mr-1 h-4 w-4" />
            Approve
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="dark:bg-red-700 dark:hover:bg-red-600"
            onClick={openRejectDialog}
            disabled={report.status !== "pending"}
          >
            <XCircle className="mr-1 h-4 w-4" />
            Reject
          </Button>
        </div>
      </PermissionGate>

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
