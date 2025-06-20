import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, cn } from "@/lib/utils";
import { Calendar, CheckCircle, Clock, XCircle } from "lucide-react";

interface ApprovalHistoryItemProps {
  item: {
    id: string;
    reportId: string;
    branchId: string;
    branchName: string;
    reportDate: string;
    reportType: string;
    status: string;
    comments: string;
    approvedBy: string;
    approverName: string;
    timestamp: string;
  };
}

export function ApprovalHistoryItem({ item }: ApprovalHistoryItemProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center">
              <h3 className="text-lg font-medium">{item.branchName}</h3>
              <Badge
                variant="outline"
                className={cn(
                  "ml-2 capitalize",
                  item.reportType === "plan"
                    ? "text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20"
                    : "text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20",
                )}
              >
                {item.reportType}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "ml-2 capitalize",
                  item.status === "approved"
                    ? "text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20"
                    : "text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20",
                )}
              >
                {item.status === "approved" ? (
                  <CheckCircle className="mr-1 h-3 w-3" />
                ) : (
                  <XCircle className="mr-1 h-3 w-3" />
                )}
                {item.status}
              </Badge>
            </div>
            <div className="flex items-center text-sm text-gray-500">
              <Calendar className="h-4 w-4 mr-1" />
              <span>{formatDate(item.reportDate)}</span>
              <Clock className="h-4 w-4 ml-3 mr-1" />
              <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>

          <div className="flex items-center text-sm text-gray-500 mb-3">
            <span>Approved by: {item.approverName}</span>
          </div>

          {item.comments && (
            <div
              className={cn(
                "p-3 rounded-md mt-2",
                item.status === "approved"
                  ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800",
              )}
            >
              <p className="text-sm whitespace-pre-wrap">{item.comments}</p>
            </div>
          )}

          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/reports/${item.reportId}`, "_blank")}
              className="text-xs"
            >
              View Report
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
