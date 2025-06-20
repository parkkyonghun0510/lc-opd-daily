"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatKHRCurrency } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { ConsolidatedData } from "../types/consolidated-types";

interface BranchDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string | null;
  consolidatedData: ConsolidatedData | null;
  planData: ConsolidatedData | null;
  reportType: "plan" | "actual";
}

export function BranchDetailsModal({
  isOpen,
  onClose,
  branchId,
  consolidatedData,
  planData,
  reportType,
}: BranchDetailsModalProps) {
  const branch =
    branchId && consolidatedData
      ? consolidatedData.branchData.find((b) => b.branchId === branchId)
      : null;

  if (!branch) return null;

  const planBranch =
    reportType === "actual" && planData
      ? planData.branchData.find((p) => p.branchId === branchId)
      : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {branch.branchCode} - {branch.branchName}
          </DialogTitle>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Detailed branch performance metrics
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  Write-offs
                </h3>
                <div className="text-2xl font-bold">
                  {formatKHRCurrency(branch.writeOffs)}
                </div>
                {planBranch && (
                  <div className="mt-2 text-sm">
                    <span className="text-gray-500">Plan: </span>
                    {formatKHRCurrency(planBranch.writeOffs)}
                    <Badge
                      className={cn(
                        "ml-2",
                        branch.writeOffs >= planBranch.writeOffs
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800",
                      )}
                    >
                      {planBranch.writeOffs > 0
                        ? `${Math.round(
                            (branch.writeOffs / planBranch.writeOffs) * 100,
                          )}%`
                        : "N/A"}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  90+ Days
                </h3>
                <div className="text-2xl font-bold">
                  {formatKHRCurrency(branch.ninetyPlus)}
                </div>
                {planBranch && (
                  <div className="mt-2 text-sm">
                    <span className="text-gray-500">Plan: </span>
                    {formatKHRCurrency(planBranch.ninetyPlus)}
                    <Badge
                      className={cn(
                        "ml-2",
                        branch.ninetyPlus >= planBranch.ninetyPlus
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800",
                      )}
                    >
                      {planBranch.ninetyPlus > 0
                        ? `${Math.round(
                            (branch.ninetyPlus / planBranch.ninetyPlus) * 100,
                          )}%`
                        : "N/A"}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-500">
                  % of Total Write-offs:
                </span>
                <span className="font-medium">
                  {(
                    (branch.writeOffs /
                      (consolidatedData?.metrics.totalWriteOffs || 1)) *
                    100
                  ).toFixed(1)}
                  %
                </span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-500">
                  % of Total 90+ Days:
                </span>
                <span className="font-medium">
                  {(
                    (branch.ninetyPlus /
                      (consolidatedData?.metrics.totalNinetyPlus || 1)) *
                    100
                  ).toFixed(1)}
                  %
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Report Status:</span>
                <Badge
                  variant={branch.hasReports ? "default" : "outline"}
                  className={
                    branch.hasReports
                      ? "bg-green-500"
                      : "text-amber-600 border-amber-600"
                  }
                >
                  {branch.hasReports ? "Reported" : "Missing"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={() => {
              onClose();
              toast({
                title: "Branch reports",
                description: `Viewing all reports for ${branch.branchCode} is not implemented in this demo`,
              });
            }}
          >
            View All Reports
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
