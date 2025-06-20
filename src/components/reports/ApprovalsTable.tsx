"use client";

import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatKHRCurrency, cn, formatDate } from "@/lib/utils";
import { ReportApproval } from "@/components/reports/ReportApproval";
import { ReportCommentsList } from "@/components/reports/ReportCommentsList";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ChevronDown,
  ChevronRight,
  Calendar,
  Building,
  AlertCircle,
  CheckCircle,
  XCircle,
  MessageSquare,
  User,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserDisplayName } from "@/components/user/UserDisplayName";

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
  status: ReportStatus;
  reportType: string;
  content?: string;
  submittedBy?: string;
  comments?: string | null;
  user?: {
    id: string;
    name: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
  ReportComment?: ReportComment[];
  branch?: {
    id: string;
    name: string;
    code: string;
  };
}

interface ApprovalsTableProps {
  reports: Report[];
  onApprovalComplete: () => void;
}

export function ApprovalsTable({
  reports,
  onApprovalComplete,
}: ApprovalsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (reportId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [reportId]: !prev[reportId],
    }));
  };

  // Render status badge with appropriate styling
  const renderStatusBadge = (status: ReportStatus) => {
    const variants = {
      pending: "secondary",
      pending_approval: "secondary",
      approved: "success",
      rejected: "destructive",
    };

    return (
      <Badge variant={variants[status] as any} className="capitalize">
        {status.replace("_", " ")}
      </Badge>
    );
  };

  // Check if a report has comments
  const hasComments = (report: Report) => {
    return (
      (report.ReportComment && report.ReportComment.length > 0) ||
      (report.comments && report.comments.trim() !== "")
    );
  };

  // Get comment count for a report
  const getCommentCount = (report: Report) => {
    if (report.ReportComment && report.ReportComment.length > 0) {
      return report.ReportComment.length;
    }
    if (report.comments && report.comments.trim() !== "") {
      // Rough estimate for legacy comments
      return report.comments.split("[").length - 1;
    }
    return 0;
  };

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]"></TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[120px]">Date</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Write-offs</TableHead>
            <TableHead className="text-right">90+ Days</TableHead>
            <TableHead>Submitted By</TableHead>
            <TableHead className="w-[100px]">Comments</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((report) => (
            <React.Fragment key={report.id}>
              <TableRow
                className={cn(
                  "cursor-pointer hover:bg-muted/50",
                  expandedRows[report.id] && "bg-muted/30",
                )}
                onClick={() => toggleRow(report.id)}
              >
                <TableCell>
                  {expandedRows[report.id] ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell>{renderStatusBadge(report.status)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{format(new Date(report.date), "MMM d, yyyy")}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Building className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{report.branch?.name || "Unknown Branch"}</span>
                  </div>
                </TableCell>
                <TableCell className="capitalize">
                  {report.reportType}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatKHRCurrency(report.writeOffs)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatKHRCurrency(report.ninetyPlus)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage
                        src={`https://avatar.vercel.sh/${report.submittedBy || report.user?.id}`}
                      />
                      <AvatarFallback>
                        {report.user?.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">
                      {report.user?.name || "Unknown User"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {hasComments(report) ? (
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{getCommentCount(report)}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">None</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div
                    className="flex justify-end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={
                              report.status !== "pending" &&
                              report.status !== "pending_approval"
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              // This will be handled by the ReportApproval component in the expanded row
                            }}
                          >
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Approve Report</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={
                              report.status !== "pending" &&
                              report.status !== "pending_approval"
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              // This will be handled by the ReportApproval component in the expanded row
                            }}
                          >
                            <XCircle className="h-4 w-4 text-red-500" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Reject Report</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </TableCell>
              </TableRow>

              {/* Expanded row for details and comments */}
              {expandedRows[report.id] && (
                <TableRow className="bg-muted/20">
                  <TableCell colSpan={10} className="p-0">
                    <div className="p-4 max-w-full overflow-hidden">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                        {/* Report details */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-muted-foreground" />
                              Report Details
                            </h3>
                            <Badge
                              variant={
                                report.status === "approved"
                                  ? "default"
                                  : report.status === "rejected"
                                    ? "destructive"
                                    : "secondary"
                              }
                              className="capitalize"
                            >
                              {report.status.replace("_", " ")}
                            </Badge>
                          </div>

                          <div className="bg-card rounded-md p-4 border shadow-sm">
                            {/* Date and Branch */}
                            <div className="flex flex-col sm:flex-row sm:justify-between mb-4 gap-2">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    Date
                                  </p>
                                  <p className="text-sm font-medium">
                                    {format(
                                      new Date(report.date),
                                      "MMMM d, yyyy",
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Building className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    Branch
                                  </p>
                                  <p className="text-sm font-medium">
                                    {report.branch?.name || "Unknown Branch"}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Financial Data */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                                <p className="text-xs text-muted-foreground">
                                  Write-offs
                                </p>
                                <p className="text-lg font-semibold">
                                  {formatKHRCurrency(report.writeOffs)}
                                </p>
                              </div>
                              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                                <p className="text-xs text-muted-foreground">
                                  90+ Days
                                </p>
                                <p className="text-lg font-semibold">
                                  {formatKHRCurrency(report.ninetyPlus)}
                                </p>
                              </div>
                            </div>

                            {/* Metadata */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Report Type
                                </p>
                                <p className="text-sm font-medium capitalize">
                                  {report.reportType}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Submitted At
                                </p>
                                <p className="text-sm font-medium">
                                  {format(
                                    new Date(report.createdAt),
                                    "MMM d, h:mm a",
                                  )}
                                </p>
                              </div>
                              <div className="col-span-2">
                                <p className="text-xs text-muted-foreground">
                                  Submitted By
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage
                                      src={`https://avatar.vercel.sh/${report.submittedBy || report.user?.id}`}
                                    />
                                    <AvatarFallback>
                                      {report.user?.name?.charAt(0) || "U"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm font-medium">
                                    {report.user?.name || "Unknown User"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Approval actions */}
                          <div className="mt-2">
                            <ReportApproval
                              report={report}
                              branchName={
                                report.branch?.name || "Unknown Branch"
                              }
                              onApprovalComplete={onApprovalComplete}
                            />
                          </div>
                        </div>

                        {/* Comments section */}
                        <div className="space-y-4">
                          <h3 className="text-sm font-medium flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            Comments
                          </h3>
                          <div className="bg-card rounded-md p-4 border shadow-sm h-[350px] md:h-[400px] overflow-y-auto">
                            {report.ReportComment &&
                            report.ReportComment.length > 0 ? (
                              <ReportCommentsList
                                reportId={report.id}
                                initialComments={report.ReportComment}
                                autoFocusCommentForm={false}
                              />
                            ) : report.comments &&
                              report.comments.trim() !== "" ? (
                              <div className="whitespace-pre-wrap text-sm">
                                {report.comments}
                              </div>
                            ) : (
                              <div className="text-center text-muted-foreground py-8">
                                <p>No comments yet</p>
                                <p className="text-xs mt-1">
                                  Add a comment to start the conversation
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}

          {reports.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={10}
                className="text-center py-8 text-muted-foreground"
              >
                No reports found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
