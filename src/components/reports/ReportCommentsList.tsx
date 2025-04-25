"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import { sanitizeString } from "@/utils/clientSanitize";

interface ReportComment {
  id: string;
  reportId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    username: string;
  };
}

interface ReportCommentsListProps {
  reportId: string;
  initialComments?: ReportComment[];
}

export function ReportCommentsList({ reportId, initialComments = [] }: ReportCommentsListProps) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<ReportComment[]>(initialComments);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch comments if not provided initially
  useEffect(() => {
    if (initialComments.length === 0) {
      fetchComments();
    }
  }, [reportId, initialComments.length]);

  const fetchComments = async () => {
    if (!reportId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/reports/${reportId}/report-comments`);
      if (!response.ok) {
        throw new Error("Failed to fetch comments");
      }
      
      const data = await response.json();
      if (data.success && Array.isArray(data.comments)) {
        setComments(data.comments);
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
      toast({
        title: "Error",
        description: "Failed to load comments. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !reportId || !session?.user) return;
    
    setIsSubmitting(true);
    try {
      // Sanitize the comment before sending
      const sanitizedComment = sanitizeString(newComment) || "";
      if (!sanitizedComment) {
        toast({
          title: "Error",
          description: "Comment cannot be empty after sanitization.",
          variant: "destructive",
        });
        return;
      }
      
      const response = await fetch(`/api/reports/${reportId}/report-comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: sanitizedComment }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add comment");
      }
      
      const data = await response.json();
      if (data.success && data.comment) {
        // Add the new comment to the list
        setComments((prev) => [...prev, data.comment]);
        // Clear the input
        setNewComment("");
        
        toast({
          title: "Success",
          description: "Comment added successfully",
        });
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add comment",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!reportId || !commentId || !session?.user) return;
    
    if (!confirm("Are you sure you want to delete this comment?")) {
      return;
    }
    
    try {
      const response = await fetch(`/api/reports/${reportId}/report-comments/${commentId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete comment");
      }
      
      const data = await response.json();
      if (data.success) {
        // Remove the deleted comment from the list
        setComments((prev) => prev.filter((comment) => comment.id !== commentId));
        
        toast({
          title: "Success",
          description: "Comment deleted successfully",
        });
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete comment",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        Comments
      </h3>
      
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-4 text-gray-500">
          No comments yet. Be the first to comment!
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {comment.user.name || comment.user.username}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </span>
                </div>
                
                {/* Delete button - only visible to comment author or admin */}
                {(session?.user?.id === comment.userId || session?.user?.role === "ADMIN") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-gray-500 hover:text-red-500"
                    onClick={() => handleDeleteComment(comment.id)}
                  >
                    <span className="sr-only">Delete</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </Button>
                )}
              </div>
              
              <div className="mt-1 text-sm whitespace-pre-wrap">
                {comment.content}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Add new comment */}
      {session?.user && (
        <div className="mt-4 space-y-2">
          <Textarea
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[80px] resize-none"
          />
          <div className="flex justify-end">
            <Button
              onClick={handleSubmitComment}
              disabled={!newComment.trim() || isSubmitting}
              className="flex items-center gap-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Add Comment
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
