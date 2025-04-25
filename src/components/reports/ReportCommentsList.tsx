"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import { sanitizeString } from "@/utils/clientSanitize";
import { cn } from "@/lib/utils";

import { ReportCommentType } from "@/types/reports";

// Use the ReportCommentType from types/reports.ts
type ReportComment = ReportCommentType;

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
              className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 transition-all duration-200 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                {/* User Avatar */}
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center font-medium shadow-sm transition-transform duration-200 hover:scale-110 ring-2 ring-transparent hover:ring-blue-200 dark:hover:ring-blue-800">
                    {comment.user?.name ? comment.user.name.charAt(0).toUpperCase() : (comment.user?.username ? comment.user.username.charAt(0).toUpperCase() : 'U')}
                  </div>
                </div>

                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {comment.user?.name || comment.user?.username || 'User'}
                      </span>
                      <span className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-default transition-colors duration-200" title={new Date(comment.createdAt).toLocaleString()}>
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                      </span>
                    </div>

                    {/* Delete button - only visible to comment author or admin */}
                    {(session?.user?.id === comment.userId || session?.user?.role === "ADMIN") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-gray-500 hover:text-red-500 transition-colors duration-200"
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

                  <div className="mt-1 text-sm whitespace-pre-wrap leading-relaxed">
                    {comment.content.split(' ').map((word, i) => {
                      // Simple URL detection
                      if (word.startsWith('http://') || word.startsWith('https://')) {
                        return (
                          <span key={i}>
                            <a
                              href={word}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline transition-colors duration-200"
                              onClick={(e) => {
                                e.stopPropagation();
                                toast({
                                  title: "Link Clicked",
                                  description: `Opening ${word}`,
                                });
                              }}
                            >
                              {word}
                            </a>
                            {' '}
                          </span>
                        );
                      }
                      // Hashtag detection
                      else if (word.startsWith('#')) {
                        return (
                          <span key={i}>
                            <span
                              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer hover:underline transition-colors duration-200"
                              onClick={() => {
                                toast({
                                  title: "Hashtag Clicked",
                                  description: `Searching for ${word}`,
                                });
                              }}
                            >
                              {word}
                            </span>
                            {' '}
                          </span>
                        );
                      }
                      // Mention detection
                      else if (word.startsWith('@')) {
                        return (
                          <span key={i}>
                            <span
                              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer hover:underline transition-colors duration-200"
                              onClick={() => {
                                toast({
                                  title: "User Mentioned",
                                  description: `Viewing profile of ${word.substring(1)}`,
                                });
                              }}
                            >
                              {word}
                            </span>
                            {' '}
                          </span>
                        );
                      }
                      // Regular word
                      return <span key={i}>{word} </span>;
                    })}
                  </div>

                  {/* Reaction buttons could be added here in the future */}
                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs flex items-center gap-1 h-6 px-2 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => {
                        toast({
                          title: "Reply Feature",
                          description: "Reply functionality would be implemented here in a future update.",
                        });
                      }}
                    >
                      <MessageSquare className="h-3 w-3" />
                      Reply
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add new comment */}
      {session?.user && (
        <div className="mt-4">
          <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 transition-all duration-200 hover:shadow-md focus-within:shadow-md focus-within:border-blue-300 dark:focus-within:border-blue-700">
            {/* User Avatar */}
            <div className="flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 text-white flex items-center justify-center font-medium shadow-sm transition-transform duration-200 hover:scale-110 ring-2 ring-transparent hover:ring-green-200 dark:hover:ring-green-800">
                {session.user.name ? session.user.name.charAt(0).toUpperCase() : (session.user.email ? session.user.email.charAt(0).toUpperCase() : 'U')}
              </div>
            </div>

            <div className="flex-1">
              <Textarea
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[80px] resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 shadow-none dark:bg-transparent dark:text-gray-200 dark:placeholder:text-gray-400 text-sm transition-all duration-200 leading-relaxed"
                autoFocus
              />

              <div className="flex justify-between items-center mt-2">
                {/* Emoji buttons */}
                <div className="flex space-x-1">
                  {['😊', '👍', '🎉', '❤️', '🔥'].map((emoji) => (
                    <Button
                      key={emoji}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 hover:scale-110 focus:scale-110 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 group"
                      onClick={() => {
                        setNewComment(prev => prev + ' ' + emoji);
                        toast({
                          title: "Emoji Added",
                          description: `Added ${emoji} to your comment`,
                        });
                      }}
                    >
                      <span role="img" aria-label="emoji" className="text-lg transform transition-transform duration-200 group-hover:scale-125">{emoji}</span>
                    </Button>
                  ))}
                </div>

                <Button
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || isSubmitting}
                  className={cn(
                    "flex items-center gap-1 transition-all duration-200",
                    newComment.trim() ? "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700" : ""
                  )}
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
          </div>
        </div>
      )}
    </div>
  );
}
