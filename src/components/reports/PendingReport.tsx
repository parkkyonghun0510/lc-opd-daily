import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ReportApproval } from "@/components/reports/ReportApproval";
import { formatKHRCurrency, cn, formatDate } from "@/lib/utils";
import { Calendar, Clock, User, MessageSquare, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UserDisplayName } from "@/components/user/UserDisplayName";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Import ReportStatus type to ensure compatibility
type ReportStatus = "pending" | "pending_approval" | "approved" | "rejected";

interface ReportComment {
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
}

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
  comments?: string;
  user?: {
    id: string;
    name: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
  ReportComment?: ReportComment[];
}

interface PendingReportProps {
  report: Report;
  branchName: string;
  branchCode: string;
  onApprovalComplete: () => void;
}

export function PendingReport({
  report,
  branchName,
  branchCode,
  onApprovalComplete,
}: PendingReportProps) {
  // Check if there are any comments
  const hasComments = report.ReportComment && report.ReportComment.length > 0;
  const hasLegacyComments = report.comments && report.comments.trim() !== '';

  // Get the latest comment for preview
  const latestComment = hasComments
    ? report.ReportComment![report.ReportComment!.length - 1]
    : null;

  // Determine status icon and color
  const getStatusBadge = () => {
    switch (report.status) {
      case 'pending':
      case 'pending_approval':
        return (
          <Badge className="ml-2 text-white bg-yellow-500">
            <AlertCircle className="mr-1 h-3 w-3" />
            {report.status === 'pending' ? 'pending' : 'pending approval'}
          </Badge>
        );
      case 'approved':
        return (
          <Badge className="ml-2 text-white bg-green-500">
            <CheckCircle className="mr-1 h-3 w-3" />
            approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="ml-2 text-white bg-red-500">
            <XCircle className="mr-1 h-3 w-3" />
            rejected
          </Badge>
        );
      default:
        return (
          <Badge className="ml-2 text-white bg-gray-500">
            {report.status}
          </Badge>
        );
    }
  };

  return (
    <Card className="overflow-hidden dark:bg-gray-800 dark:border-gray-700">
      <CardContent className="p-0">
        <div className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center flex-wrap">
              <h3 className="text-lg font-medium dark:text-gray-100">{`${branchName}${branchCode ? ` (${branchCode})` : ''}`}</h3>
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
              {getStatusBadge()}
            </div>
            <div className="flex flex-wrap items-center gap-4">
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

          {/* Show conversation preview if there are comments */}
          {(hasComments || hasLegacyComments) && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center mb-1">
                <MessageSquare className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" />
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Conversation History
                </h4>
              </div>

              {hasComments ? (
                <div className="space-y-2">
                  {report.ReportComment!.slice(-2).map((comment) => (
                    <div key={comment.id} className="flex items-start space-x-2">
                      <Avatar className="h-6 w-6 flex-shrink-0">
                        <AvatarImage src={`https://avatar.vercel.sh/${comment.userId}`} />
                        <AvatarFallback>
                          {comment.user?.name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap">
                          <p className="text-sm font-medium truncate">
                            {comment.user?.name || 'Unknown User'}
                          </p>
                          <span className="text-xs text-gray-500 ml-2">
                            {format(new Date(comment.createdAt), "MMM d, h:mm a")}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 break-words">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))}

                  {report.ReportComment!.length > 2 && (
                    <p className="text-xs text-gray-500 italic">
                      + {report.ReportComment!.length - 2} more comments
                    </p>
                  )}
                </div>
              ) : hasLegacyComments ? (
                <div className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
                  {report.comments}
                </div>
              ) : null}
            </div>
          )}

          {/* Show rejection reason prominently if report is rejected */}
          {report.status === 'rejected' && (
            <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <div className="flex items-center mb-1">
                <XCircle className="h-4 w-4 mr-1 text-red-500" />
                <h4 className="text-sm font-medium text-red-700 dark:text-red-300">
                  Rejection Reason
                </h4>
              </div>
              <p className="text-sm text-red-700 dark:text-red-300 break-words">
                {latestComment?.content || report.comments || "No reason provided"}
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-800">
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