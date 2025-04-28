"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn, formatKHRCurrency } from "@/lib/utils";
import { ConsolidatedData } from "../types/consolidated-types";

interface BranchStatusTableProps {
  consolidatedData: ConsolidatedData;
  planData: ConsolidatedData | null;
  reportType: "plan" | "actual";
}

export function BranchStatusTable({
  consolidatedData,
  planData,
  reportType,
}: BranchStatusTableProps) {
  return (
    <div className="mt-6">
      <h3 className="text-lg font-medium mb-4">Branch Status</h3>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Branch</TableHead>
              <TableHead className="whitespace-nowrap text-right">
                Write-offs
              </TableHead>
              {reportType === "actual" && planData && (
                <TableHead className="whitespace-nowrap text-center">
                  Achievement
                </TableHead>
              )}
              <TableHead className="whitespace-nowrap text-right">
                90+ Days
              </TableHead>
              {reportType === "actual" && planData && (
                <TableHead className="whitespace-nowrap text-center">
                  Achievement
                </TableHead>
              )}
              <TableHead className="whitespace-nowrap text-center">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {consolidatedData.branchData.map((branch) => {
              // Find corresponding plan data for this branch when in actual view
              const planBranch =
                reportType === "actual" && planData
                  ? planData.branchData.find(
                      (plan) => plan.branchId === branch.branchId
                    )
                  : null;

              // Calculate achievement percentages
              const writeOffsAchievement =
                planBranch?.writeOffs && planBranch.writeOffs > 0
                  ? (branch.writeOffs / planBranch.writeOffs) * 100
                  : 0;

              const ninetyPlusAchievement =
                planBranch?.ninetyPlus && planBranch.ninetyPlus > 0
                  ? (branch.ninetyPlus / planBranch.ninetyPlus) * 100
                  : 0;

              return (
                <TableRow key={branch.branchId}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {branch.branchCode}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    {formatKHRCurrency(branch.writeOffs)}
                  </TableCell>
                  {reportType === "actual" && planData && (
                    <TableCell className="whitespace-nowrap text-center">
                      {planBranch?.writeOffs && planBranch.writeOffs > 0 ? (
                        <Badge
                          className={cn(
                            "font-medium",
                            writeOffsAchievement >= 100
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : writeOffsAchievement >= 80
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          )}
                        >
                          {writeOffsAchievement.toFixed(1)}%
                        </Badge>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="whitespace-nowrap text-right">
                    {formatKHRCurrency(branch.ninetyPlus)}
                  </TableCell>
                  {reportType === "actual" && planData && (
                    <TableCell className="whitespace-nowrap text-center">
                      {planBranch?.ninetyPlus && planBranch.ninetyPlus > 0 ? (
                        <Badge
                          className={cn(
                            "font-medium",
                            ninetyPlusAchievement >= 100
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : ninetyPlusAchievement >= 80
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          )}
                        >
                          {ninetyPlusAchievement.toFixed(1)}%
                        </Badge>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="whitespace-nowrap text-center">
                    {branch.hasReports ? (
                      <Badge className="bg-green-500">Reported</Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-yellow-500 text-yellow-500"
                      >
                        Missing
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}