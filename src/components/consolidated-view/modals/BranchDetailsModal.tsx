"use client";

import React from "react";
import { ArrowRight, X, FileText, AlertCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";

import { Branch, ConsolidatedData } from "../types";
import {
  formatKHRCurrency,
  formatCount,
  formatPercentage,
} from "../utils/formatters";

interface BranchDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string | null;
  consolidatedData: ConsolidatedData | null;
  planData?: ConsolidatedData | null;
  reportType?: string;
}

export const BranchDetailsModal: React.FC<BranchDetailsModalProps> = ({
  isOpen,
  onClose,
  branchId,
  consolidatedData,
  planData,
  reportType,
}) => {
  const { toast } = useToast();

  if (!isOpen || !branchId || !consolidatedData) return null;

  // Find the branch data
  const branch = consolidatedData.branchData.find(
    (b) => b.branchId === branchId
  );

  if (!branch) return null;

  // Find corresponding plan data if available
  const planBranch = planData?.branchData.find((p) => p.branchId === branchId);

  // Calculate achievement percentages if plan data is available
  const writeOffsAchievement =
    planBranch && planBranch.writeOffs
      ? (branch.writeOffs / planBranch.writeOffs) * 100
      : null;

  const ninetyPlusAchievement =
    planBranch && planBranch.ninetyPlus
      ? (branch.ninetyPlus / planBranch.ninetyPlus) * 100
      : null;

  // Handle view all reports click
  const handleViewAllReports = () => {
    toast({
      title: "View reports functionality",
      description: "This functionality is not implemented in the demo.",
      duration: 3000,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">
              {branch.branchName} ({branch.branchCode})
            </DialogTitle>
            <Badge
              variant={branch.hasReports ? "default" : "destructive"}
              className="ml-2"
            >
              {branch.hasReports
                ? `${branch.reportsCount} Reports`
                : "No Reports"}
            </Badge>
          </div>
          <DialogDescription className="flex items-center text-sm mt-1">
            Region: <span className="font-medium ml-1">{branch.region}</span>
            <span className="mx-2">•</span>
            Size: <span className="font-medium ml-1">{branch.size}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Performance metrics section */}
          <div className="rounded-md border p-4">
            <h3 className="text-lg font-semibold mb-2">Performance Metrics</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Write-offs</p>
                <p className="text-xl font-semibold">
                  {formatKHRCurrency(branch.writeOffs)}
                </p>
                {writeOffsAchievement && (
                  <p
                    className={`text-sm ${
                      writeOffsAchievement > 100
                        ? "text-red-500"
                        : "text-green-500"
                    }`}
                  >
                    {formatPercentage(writeOffsAchievement)} of plan
                  </p>
                )}
              </div>

              <div>
                <p className="text-sm text-muted-foreground">90+ Days</p>
                <p className="text-xl font-semibold">
                  {formatKHRCurrency(branch.ninetyPlus)}
                </p>
                {ninetyPlusAchievement && (
                  <p
                    className={`text-sm ${
                      ninetyPlusAchievement > 100
                        ? "text-red-500"
                        : "text-green-500"
                    }`}
                  >
                    {formatPercentage(ninetyPlusAchievement)} of plan
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Plan data section (if available) */}
          {planData && planBranch && (
            <div className="rounded-md border p-4">
              <h3 className="text-lg font-semibold mb-2">Plan Data</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Plan Write-offs
                  </p>
                  <p className="text-xl font-semibold">
                    {formatKHRCurrency(planBranch.writeOffs)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Plan 90+ Days</p>
                  <p className="text-xl font-semibold">
                    {formatKHRCurrency(planBranch.ninetyPlus)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Report status section */}
          <div className="rounded-md border p-4">
            <h3 className="text-lg font-semibold mb-2">Report Status</h3>

            <div className="flex items-center">
              {branch.hasReports ? (
                <>
                  <Badge variant="outline" className="bg-green-50 mr-2">
                    <FileText className="h-3 w-3 mr-1" />
                    {formatCount(branch.reportsCount)} reports submitted
                  </Badge>
                </>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-red-50 text-red-500 mr-2"
                >
                  <AlertCircle className="h-3 w-3 mr-1" />
                  No reports submitted
                </Badge>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleViewAllReports}>
            View All Reports <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
