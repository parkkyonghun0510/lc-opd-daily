import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ReportApproval } from "@/components/reports/ReportApproval";
import { formatKHRCurrency, cn } from "@/lib/utils";
import { Calendar, Clock, User } from "lucide-react";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UserDisplayName } from "@/components/user/UserDisplayName";

interface Report {
  id: string;
  date: string;
  branchId: string;
  writeOffs: number;
  ninetyPlus: number;
  status: string;
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
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center">
              <h3 className="text-lg font-medium">{branchName}</h3>
              <Badge
                variant="outline"
                className={cn(
                  "ml-2 capitalize",
                  report.reportType === "plan" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"
                )}
              >
                {report.reportType}
              </Badge>
            </div>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center">
                      <Calendar className="h-3.5 w-3.5 mr-1.5" />
                      <span>
                        {format(new Date(report.date), "MMM d, yyyy")}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Report date</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center">
                      <User className="h-3.5 w-3.5 mr-1.5" />
                      <span>
                        {report.submittedBy ? (
                          <UserDisplayName userId={report.submittedBy} />
                        ) : (
                          report.user?.name || report.user?.username || "Unknown user"
                        )}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Submitted by</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center">
                      <Clock className="h-3.5 w-3.5 mr-1.5" />
                      <span>
                        {format(new Date(report.createdAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Submission time</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 my-3">
            <div className="space-y-1">
              <div className="text-sm text-gray-500">Write-offs</div>
              <div className="font-mono font-medium text-lg">
                {formatKHRCurrency(report.writeOffs)}
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="text-sm text-gray-500">90+ Days</div>
              <div className="font-mono font-medium text-lg">
                {formatKHRCurrency(report.ninetyPlus)}
              </div>
            </div>
            
            <div className="col-span-2 sm:col-span-1 flex sm:justify-end items-end">
              <ReportApproval
                report={report}
                onApprovalComplete={onApprovalComplete}
                branchName={branchName}
              />
            </div>
          </div>
          
          {report.content && (
            <div className="mt-3 pt-3 border-t">
              <div className="text-sm font-medium text-gray-600 mb-1">
                Comments:
              </div>
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                {report.content}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 