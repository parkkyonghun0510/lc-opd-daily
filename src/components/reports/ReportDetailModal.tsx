"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Eye, Loader2, PencilIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import { cn, formatKHRCurrency } from "@/lib/utils";
import { Report, CommentItem as CommentItemType } from "@/types/reports";
import { UserDisplayName } from "@/components/user/UserDisplayName";
import { CommentItem } from "@/components/reports/CommentItem";

interface ReportWithUser extends Report {
  user?: {
    id: string;
    name: string;
    username?: string;
  } | null;
}

interface ReportDetailModalProps {
  report: ReportWithUser | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (report: Report) => void;
}

// Helper function to format comment history as a conversation
const formatCommentHistory = (comments: string) => {
  if (!comments) return { hasConversation: false, formattedComments: "" };

  // Match all types of comment patterns:
  // 1. [RESUBMISSION timestamp]: message
  // 2. [COMMENT timestamp by username]: message
  const commentParts = comments.split(/\[(RESUBMISSION|COMMENT) ([^\]]+)\]:/);

  if (commentParts.length <= 1) {
    // No special markup, just return the original text
    return {
      hasConversation: false,
      formattedComments: comments
    };
  }

  // Format as a conversation with timestamps
  const conversation = [];

  // Handle the first part (if it exists and isn't empty)
  if (commentParts[0].trim()) {
    conversation.push({
      type: 'rejection',
      date: '',
      author: 'System',
      text: commentParts[0].trim()
    });
  }

  // Process the rest of the parts in groups of 3
  for (let i = 1; i < commentParts.length; i += 3) {
    const type = commentParts[i]; // RESUBMISSION or COMMENT
    const meta = commentParts[i + 1]; // timestamp or "timestamp by username"
    const text = (i + 2 < commentParts.length) ? commentParts[i + 2].trim() : '';

    let date = meta;
    let author = 'User';

    // Parse metadata differently based on type
    if (type === 'COMMENT') {
      const byIndex = meta.indexOf(' by ');
      if (byIndex > -1) {
        date = meta.substring(0, byIndex);
        author = meta.substring(byIndex + 4);
      }
    }

    conversation.push({
      type: type.toLowerCase(),
      date,
      author,
      text
    });
  }

  return {
    hasConversation: true,
    conversation
  };
};

// Component to render a comment conversation
export const CommentConversation = ({
  comments,
  commentArray,
  reportId,
  onReplyAdded
}: {
  comments?: string;
  commentArray?: CommentItemType[];
  reportId: string;
  onReplyAdded: () => void;
}) => {
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [filterType, setFilterType] = useState<'all' | 'comments' | 'rejections'>('all');

  // Process the comment array to organize comments and replies
  const processCommentArray = (comments: CommentItemType[]) => {
    // Create a map of parent comments and their replies
    const commentMap = new Map<string, CommentItemType>();
    const topLevelComments: CommentItemType[] = [];

    // First pass: collect all comments in a map
    comments.forEach(comment => {
      // Create a copy with an empty replies array if it doesn't exist
      const commentWithReplies = {
        ...comment,
        replies: comment.replies || []
      };
      commentMap.set(comment.id, commentWithReplies);
    });

    // Second pass: organize comments into a hierarchy
    comments.forEach(comment => {
      if (comment.parentId && commentMap.has(comment.parentId)) {
        // This is a reply, add it to its parent's replies
        const parent = commentMap.get(comment.parentId);
        if (parent && parent.replies) {
          parent.replies.push(comment);
        }
      } else if (!comment.parentId) {
        // This is a top-level comment
        topLevelComments.push(commentMap.get(comment.id) as CommentItemType);
      }
    });

    // Apply filtering
    let filteredComments = topLevelComments;
    if (filterType !== 'all') {
      filteredComments = topLevelComments.filter(comment => {
        if (filterType === 'comments') {
          return comment.type === 'comment' || comment.type === 'reply';
        } else if (filterType === 'rejections') {
          return comment.type === 'rejection';
        }
        return true;
      });
    }

    // Apply sorting
    const sortedComments = [...filteredComments].sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return sortedComments;
  };

  // If we have a structured comment array, use that
  if (commentArray && commentArray.length > 0) {
    const organizedComments = processCommentArray(commentArray);

    return (
      <div className="space-y-4">
        {/* Sorting and filtering controls */}
        <div className="flex flex-wrap justify-between items-center gap-2 mb-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Filter:</span>
            <div className="flex border rounded-md overflow-hidden">
              <button
                className={`px-2 py-1 ${filterType === 'all' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 'bg-gray-50 dark:bg-gray-800'}`}
                onClick={() => setFilterType('all')}
              >
                All
              </button>
              <button
                className={`px-2 py-1 ${filterType === 'comments' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 'bg-gray-50 dark:bg-gray-800'}`}
                onClick={() => setFilterType('comments')}
              >
                Comments
              </button>
              <button
                className={`px-2 py-1 ${filterType === 'rejections' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 'bg-gray-50 dark:bg-gray-800'}`}
                onClick={() => setFilterType('rejections')}
              >
                Rejections
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-500">Sort:</span>
            <div className="flex border rounded-md overflow-hidden">
              <button
                className={`px-2 py-1 ${sortOrder === 'newest' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 'bg-gray-50 dark:bg-gray-800'}`}
                onClick={() => setSortOrder('newest')}
              >
                Newest
              </button>
              <button
                className={`px-2 py-1 ${sortOrder === 'oldest' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 'bg-gray-50 dark:bg-gray-800'}`}
                onClick={() => setSortOrder('oldest')}
              >
                Oldest
              </button>
            </div>
          </div>
        </div>

        {organizedComments.length > 0 ? (
          organizedComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              reportId={reportId}
              onReplyAdded={onReplyAdded}
            />
          ))
        ) : (
          <p className="text-gray-500 italic text-sm">No comments match the current filter</p>
        )}
      </div>
    );
  }

  // Fall back to legacy string-based comments
  if (comments) {
    const result = formatCommentHistory(comments);

    if (!result.hasConversation) {
      return (
        <p className="whitespace-pre-wrap">
          {comments || "No comments available"}
        </p>
      );
    }

    return (
      <div className="space-y-3">
        {result.conversation?.map((entry, index) => (
          <div
            key={index}
            className={cn(
              "p-3 rounded-md",
              entry.type === 'rejection'
                ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                : entry.type === 'comment'
                  ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                  : "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
            )}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
              <span className={cn(
                "text-xs font-medium",
                entry.type === 'rejection'
                  ? "text-red-800 dark:text-red-300"
                  : entry.type === 'comment'
                    ? "text-blue-800 dark:text-blue-300"
                    : "text-green-800 dark:text-green-300"
              )}>
                {entry.type === 'rejection'
                  ? "Rejection Feedback"
                  : entry.type === 'comment'
                    ? `Comment by ${entry.author}`
                    : "Resubmission"}
              </span>
              {entry.date && (
                <span className={cn(
                  "text-xs",
                  entry.type === 'rejection'
                    ? "text-red-700 dark:text-red-400"
                    : entry.type === 'comment'
                      ? "text-blue-700 dark:text-blue-400"
                      : "text-green-700 dark:text-green-400"
                )}>
                  {entry.date}
                </span>
              )}
            </div>
            <p className={cn(
              "text-sm whitespace-pre-wrap",
              entry.type === 'rejection'
                ? "text-red-800 dark:text-red-200"
                : entry.type === 'comment'
                  ? "text-blue-800 dark:text-blue-200"
                  : "text-green-800 dark:text-green-200"
            )}>
              {entry.text}
            </p>
          </div>
        ))}
      </div>
    );
  }

  // No comments available
  return <p className="text-gray-500 italic">No comments available</p>;
};

export function ReportDetailModal({ report, isOpen, onClose, onEdit }: ReportDetailModalProps) {
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [refreshedReport, setRefreshedReport] = useState<ReportWithUser | null>(null);
  const [replyingToComment, setReplyingToComment] = useState<string | null>(null);

  // Use either the refreshed report or the original passed report
  const displayReport = refreshedReport || report;

  // Reset refreshed report when the modal is closed or a new report is shown
  useEffect(() => {
    if (!isOpen) {
      setRefreshedReport(null);
    } else if (report && report.id !== refreshedReport?.id) {
      setRefreshedReport(null);
    }
  }, [isOpen, report, refreshedReport]);

  // Function to refresh the report details after adding a comment
  const refreshReportDetails = async (reportId: string) => {
    try {
      //console.log("Refreshing report details for:", reportId);
      const response = await fetch(`/api/reports/${reportId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch updated report");
      }

      const reportData = await response.json();
      //console.log("Updated report data received:", reportData);

      // Convert the API response to ReportWithUser type
      setRefreshedReport({
        ...reportData,
        user: null
      });
    } catch (error) {
      console.error("Error refreshing report details:", error);
      // Don't show an error toast here as it would be confusing
    }
  };

  const handleAddComment = async () => {
    if (!displayReport || !newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      //console.log("Submitting comment for report:", displayReport.id);

      // API call to add a comment
      const response = await fetch(`/api/reports/${displayReport.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: newComment,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error("Comment submission error:", responseData);
        throw new Error(responseData.error || 'Failed to add comment');
      }

      //console.log("Comment added successfully:", responseData);

      toast({
        title: "Comment Added",
        description: "Your comment has been added successfully",
      });

      setNewComment("");

      // Refresh the report to show the new comment
      await refreshReportDetails(displayReport.id);
    } catch (error) {
      console.error("Error adding comment:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add comment",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  if (!displayReport) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Report Details</span>
            <Badge
              variant={
                displayReport.status === "approved" ? "default" :
                  displayReport.status === "rejected" ? "destructive" :
                    "secondary"
              }
              className="capitalize"
            >
              {displayReport.status.replace("_", " ")}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {format(new Date(displayReport.date), "PPP")} - {displayReport.branch.name}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Report Type */}
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-gray-500">Report Type</Label>
            <span className="capitalize">{displayReport.reportType}</span>
          </div>

          <Separator />

          {/* Financial Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
              <Label className="text-sm text-gray-500">Write-offs</Label>
              <div className="text-lg font-semibold">{formatKHRCurrency(displayReport.writeOffs)}</div>

              {displayReport.reportType === "actual" && displayReport.writeOffsPlan !== undefined && (
                <div className="mt-1 text-xs">
                  <span className="text-gray-500">Plan: </span>
                  <span>{formatKHRCurrency(displayReport.writeOffsPlan)}</span>

                  {displayReport.writeOffs !== displayReport.writeOffsPlan && displayReport.writeOffsPlan !== 0 && (
                    <Badge variant={displayReport.writeOffs > displayReport.writeOffsPlan ? "destructive" : "default"} className="ml-2">
                      {displayReport.writeOffs > displayReport.writeOffsPlan ? "▲" : "▼"}
                      {Math.abs(((displayReport.writeOffs - displayReport.writeOffsPlan) / displayReport.writeOffsPlan) * 100).toFixed(1)}%
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
              <Label className="text-sm text-gray-500">90+ Days</Label>
              <div className="text-lg font-semibold">{formatKHRCurrency(displayReport.ninetyPlus)}</div>

              {displayReport.reportType === "actual" && displayReport.ninetyPlusPlan !== undefined && (
                <div className="mt-1 text-xs">
                  <span className="text-gray-500">Plan: </span>
                  <span>{formatKHRCurrency(displayReport.ninetyPlusPlan)}</span>

                  {displayReport.ninetyPlus !== displayReport.ninetyPlusPlan && displayReport.ninetyPlusPlan !== 0 && (
                    <Badge variant={displayReport.ninetyPlus > displayReport.ninetyPlusPlan ? "destructive" : "default"} className="ml-2">
                      {displayReport.ninetyPlus > displayReport.ninetyPlusPlan ? "▲" : "▼"}
                      {Math.abs(((displayReport.ninetyPlus - displayReport.ninetyPlusPlan) / displayReport.ninetyPlusPlan) * 100).toFixed(1)}%
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-gray-500">Submitted By</Label>
              <div><UserDisplayName userId={displayReport.submittedBy} /></div>
            </div>
            <div>
              <Label className="text-gray-500">Submitted On</Label>
              <div>{displayReport.submittedAt ? format(new Date(displayReport.submittedAt), "PPP HH:mm") : "Unknown"}</div>
            </div>
          </div>

          <Separator />

          {/* Comments Section */}
          <div>
            <Label className="text-sm font-medium mb-2">Comments</Label>
            {(displayReport.comments || displayReport.commentArray) ? (
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-md mb-3">
                <CommentConversation
                  comments={displayReport.comments}
                  commentArray={displayReport.commentArray}
                  reportId={displayReport.id}
                  onReplyAdded={() => refreshReportDetails(displayReport.id)}
                />
              </div>
            ) : (
              <div className="text-gray-500 italic text-sm mb-3">No comments available</div>
            )}

            {/* New Comment Input */}
            <div className="space-y-2">
              <Textarea
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="resize-none"
              />
              <div className="flex justify-end space-x-2">
                <Button
                  size="sm"
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || isSubmittingComment}
                >
                  {isSubmittingComment ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Add Comment"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {(displayReport.status === "pending" || displayReport.status === "rejected") && onEdit && (
            <Button onClick={() => onEdit(displayReport)}>
              <PencilIcon className="h-4 w-4 mr-2" />
              {displayReport.status === "rejected" ? "Resubmit" : "Edit"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
