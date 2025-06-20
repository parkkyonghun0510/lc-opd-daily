"use client";

import { formatKHRCurrency } from "@/lib/utils";
import {
  FileSpreadsheetIcon,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BranchDetailDialogProps } from "../types/consolidated-types";

const mockReports = [
  { date: "2023-05-01", amount: 12500000, status: "Approved" },
  { date: "2023-05-10", amount: 8750000, status: "Pending" },
  { date: "2023-05-15", amount: 15000000, status: "Rejected" },
  { date: "2023-05-22", amount: 9800000, status: "Approved" },
];

export function BranchDetailDialog({
  selectedBranch,
  selectedBranchData,
  onClose,
}: BranchDetailDialogProps) {
  return (
    <Dialog open={!!selectedBranch} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] dark:bg-gray-800 dark:border-gray-700 w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl dark:text-gray-100">
            {selectedBranch} Details
          </DialogTitle>
          <DialogDescription className="dark:text-gray-400">
            Detailed metrics and reports for this branch.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="dark:bg-gray-900 dark:border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium dark:text-gray-200">
                  Write-offs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold dark:text-gray-100">
                  {formatKHRCurrency(selectedBranchData?.writeOffs || 0)}
                </div>
                <div className="text-xs text-muted-foreground dark:text-gray-400 flex items-center mt-1">
                  {(selectedBranchData?.writeOffsTrend || 0) > 0 ? (
                    <TrendingUp className="text-red-500 h-4 w-4 mr-1" />
                  ) : (selectedBranchData?.writeOffsTrend || 0) < 0 ? (
                    <TrendingDown className="text-green-500 h-4 w-4 mr-1" />
                  ) : (
                    <Minus className="text-yellow-500 h-4 w-4 mr-1" />
                  )}
                  <span
                    className={cn(
                      (selectedBranchData?.writeOffsTrend || 0) > 0
                        ? "text-red-500"
                        : (selectedBranchData?.writeOffsTrend || 0) < 0
                          ? "text-green-500"
                          : "text-yellow-500",
                    )}
                  >
                    {(selectedBranchData?.writeOffsTrend || 0) !== 0
                      ? `${Math.abs(selectedBranchData?.writeOffsTrend || 0)}% ${
                          (selectedBranchData?.writeOffsTrend || 0) > 0
                            ? "increase"
                            : "decrease"
                        }`
                      : "No change"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="dark:bg-gray-900 dark:border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium dark:text-gray-200">
                  90+ Days Outstanding
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold dark:text-gray-100">
                  {formatKHRCurrency(selectedBranchData?.ninetyPlus || 0)}
                </div>
                <div className="text-xs text-muted-foreground dark:text-gray-400 flex items-center mt-1">
                  {(selectedBranchData?.ninetyPlusTrend || 0) > 0 ? (
                    <TrendingUp className="text-red-500 h-4 w-4 mr-1" />
                  ) : (selectedBranchData?.ninetyPlusTrend || 0) < 0 ? (
                    <TrendingDown className="text-green-500 h-4 w-4 mr-1" />
                  ) : (
                    <Minus className="text-yellow-500 h-4 w-4 mr-1" />
                  )}
                  <span
                    className={cn(
                      (selectedBranchData?.ninetyPlusTrend || 0) > 0
                        ? "text-red-500"
                        : (selectedBranchData?.ninetyPlusTrend || 0) < 0
                          ? "text-green-500"
                          : "text-yellow-500",
                    )}
                  >
                    {(selectedBranchData?.ninetyPlusTrend || 0) !== 0
                      ? `${Math.abs(selectedBranchData?.ninetyPlusTrend || 0)}% ${
                          (selectedBranchData?.ninetyPlusTrend || 0) > 0
                            ? "increase"
                            : "decrease"
                        }`
                      : "No change"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="overflow-x-auto">
            <Table className="border dark:border-gray-700 rounded-md">
              <TableHeader className="bg-muted/50 dark:bg-gray-900">
                <TableRow>
                  <TableHead className="font-semibold dark:text-gray-300 w-[100px]">
                    Date
                  </TableHead>
                  <TableHead className="font-semibold dark:text-gray-300 w-[140px] text-right">
                    Amount
                  </TableHead>
                  <TableHead className="font-semibold dark:text-gray-300 text-right">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockReports.map((report, i) => (
                  <TableRow key={i} className="dark:hover:bg-gray-900/60">
                    <TableCell className="dark:text-gray-300 font-medium">
                      {report.date}
                    </TableCell>
                    <TableCell className="dark:text-gray-300 text-right">
                      {formatKHRCurrency(report.amount)}
                    </TableCell>
                    <TableCell className="dark:text-gray-300 text-right">
                      <Badge
                        variant={
                          report.status === "Approved"
                            ? "success"
                            : report.status === "Pending"
                              ? "secondary"
                              : "default"
                        }
                        className="ml-auto"
                      >
                        {report.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              className="dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              onClick={onClose}
            >
              Close
            </Button>
            <Button
              size="sm"
              className="dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              <FileSpreadsheetIcon className="h-4 w-4 mr-1" />
              Export Data
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
