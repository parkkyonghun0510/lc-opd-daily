import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ReportApproval } from "@/components/reports/ReportApproval";
import { formatKHRCurrency, cn } from "@/lib/utils";
import { Calendar, Clock, User } from "lucide-react";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UserDisplayName } from "@/components/user/UserDisplayName";

// Import ReportStatus type to ensure compatibility
type ReportStatus = "pending" | "pending_approval" | "approved" | "rejected";

interface Report {
  id: string;
  date: string;
  branchId: string;
  writeOffs: number;
  ninetyPlus: number;
  status: ReportStatus; // Use the ReportStatus type instead of string
  reportType: string;
  content?: string;
  submittedBy?: string;
  user?: {
    id: string;
    name: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface PendingReportProps {
  report: Report;
  branchName: string;
  onApprovalComplete: () => void;
}

export function PendingReport({
  report,
  branchName,
  onApprovalComplete,
}: PendingReportProps) {
  return (
    <Card className="overflow-hidden dark:bg-gray-800 dark:border-gray-700">
      <CardContent className="p-0">
        <div className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center">
              <h3 className="text-lg font-medium dark:text-gray-100">{branchName}</h3>
              <Badge
                variant="outline"
                className={cn(
                  "ml-2 capitalize",
                  report.reportType === "plan"
                    ? "text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20"
                    : "text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20"
                )}
              >
                {report.reportType}
              </Badge>
              <Badge
                className={cn(
                  "ml-2 text-white",
                  report.status === "pending"
                    ? "bg-yellow-500"
                    : report.status === "approved"
                    ? "bg-green-500"
                    : "bg-red-500"
                )}
              >
                {report.status}
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <Calendar className="h-4 w-4 mr-1" />
                      <span>{format(new Date(report.date), "MMM d, yyyy")}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="dark:text-gray-200">Report Date</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <Clock className="h-4 w-4 mr-1" />
                      <span>
                        {format(new Date(report.createdAt), "h:mm a")}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="dark:text-gray-200">Submission Time</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                      <User className="h-4 w-4 mr-1" />
                      <UserDisplayName userId={report.submittedBy || ""} className="dark:text-gray-400" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="dark:text-gray-200">Submitted By</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Write-offs</h4>
              <p className="text-2xl font-semibold dark:text-gray-200">
                {formatKHRCurrency(report.writeOffs)}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">90+ Days</h4>
              <p className="text-2xl font-semibold dark:text-gray-200">
                {formatKHRCurrency(report.ninetyPlus)}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800">
          <ReportApproval
            report={report}
            branchName={branchName}
            onApprovalComplete={onApprovalComplete}
          />
        </div>
      </CardContent>
    </Card>
  );
} 