"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  MessageSquare,
  Send,
  CheckCircle,
  XCircle,
  Shield,
  User,
  Bell,
  BellOff,
  RefreshCw,
  Keyboard,
  ChevronUp,
  Info,
  ArrowDown
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import { sanitizeString } from "@/utils/clientSanitize";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { requestNotificationPermission, getNotificationStatus } from "@/utils/pushNotifications";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { ReportCommentType } from "@/types/reports";

// Use the ReportCommentType from types/reports.ts
type ReportComment = ReportCommentType;

// Define comment types for visual styling
type CommentType = 'regular' | 'approval' | 'rejection' | 'system';

// Helper function to determine comment type and extract the actual content
const processComment = (comment: ReportComment): { type: CommentType; content: string } => {
  const content = comment.content;
  const lowerContent = content.toLowerCase();

  // Check for approval comments
  if (
    lowerContent.includes('report approved') ||
    lowerContent.includes('approved the report') ||
    lowerContent.startsWith('approved:') ||
    lowerContent.startsWith('approved') ||
    lowerContent.includes('report has been approved')
  ) {
    // For comments that start with "Approved: ", remove the prefix to avoid duplication
    if (content.startsWith('Approved: ')) {
      return { type: 'approval', content: content.substring(10) };
    }

    // Don't strip the content - show the full message
    return { type: 'approval', content };
  }

  // Check for rejection comments
  if (
    lowerContent.includes('report rejected') ||
    lowerContent.includes('rejected the report') ||
    lowerContent.startsWith('rejected:') ||
    lowerContent.startsWith('rejected') ||
    lowerContent.includes('report has been rejected')
  ) {
    // For comments that start with "Rejected: ", remove the prefix to avoid duplication
    if (content.startsWith('Rejected: ')) {
      return { type: 'rejection', content: content.substring(10) };
    }

    // Don't strip the content - show the full message
    return { type: 'rejection', content };
  }

  // Check for system comments
  if (comment.user?.name === 'System' || !comment.user) {
    return { type: 'system', content };
  }

  // Default to regular comment
  return { type: 'regular', content };
};

interface ReportCommentsListProps {
  reportId: string;
  initialComments?: ReportComment[];
  autoFocusCommentForm?: boolean;
}

export function ReportCommentsList({ reportId, initialComments = [], autoFocusCommentForm = false }: ReportCommentsListProps) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<ReportComment[]>(initialComments);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Fetch comments if not provided initially
  useEffect(() => {
    if (initialComments.length === 0) {
      fetchComments();
    } else {
      // If we have initial comments, assume we don't need to fetch more
      setComments(initialComments);
      setHasMore(initialComments.length >= 10); // Assume there might be more if we have 10+ comments
    }
  }, [reportId, initialComments.length]);

  // Check notification permission status on mount
  useEffect(() => {
    const checkNotificationStatus = () => {
      const status = getNotificationStatus();
      setNotificationsEnabled(status.isGranted);
    };

    checkNotificationStatus();
  }, []);

  const fetchComments = useCallback(async (refresh = false) => {
    if (!reportId) return;

    if (refresh) {
      setIsRefreshing(true);
      setPage(1);
    } else {
      setIsLoading(true);
    }

    try {
      const pageSize = 20; // Number of comments per page
      const response = await fetch(
        `/api/reports/${reportId}/report-comments?page=${refresh ? 1 : page}&limit=${pageSize}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch comments");
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.comments)) {
        if (refresh || page === 1) {
          setComments(data.comments);
        } else {
          setComments(prev => [...prev, ...data.comments]);
        }

        // Check if we have more comments to load
        setHasMore(data.comments.length === pageSize);

        // Increment page for next fetch
        if (!refresh && data.comments.length > 0) {
          setPage(prev => prev + 1);
        }
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
      setIsRefreshing(false);
    }
  }, [reportId, page, toast]);

  // Function to refresh comments
  const refreshComments = useCallback(() => {
    fetchComments(true);
  }, [fetchComments]);

  // Define handleSubmitComment before it's used in the useEffect dependency array
  const handleSubmitComment = useCallback(async () => {
    if (!newComment.trim() || !reportId || !session?.user) return;

    setIsSubmitting(true);

    // Sanitize the comment before sending
    const sanitizedComment = sanitizeString(newComment) || "";
    if (!sanitizedComment) {
      toast({
        title: "Error",
        description: "Comment cannot be empty after sanitization.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    // Create an optimistic comment for immediate UI update
    const optimisticComment: ReportComment = {
      id: `temp-${Date.now()}`,
      reportId,
      userId: session.user.id || '',
      content: sanitizedComment,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      user: {
        id: session.user.id || '',
        name: session.user.name || 'You',
        username: session.user.email || undefined
      }
    };

    // Add optimistic comment to the list
    setComments(prev => [...prev, optimisticComment]);

    // Clear the input immediately for better UX
    setNewComment("");

    try {
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
        // Replace the optimistic comment with the real one
        setComments((prev) =>
          prev.map(comment =>
            comment.id === optimisticComment.id ? data.comment : comment
          )
        );

        toast({
          title: "Success",
          description: "Comment added successfully",
        });

        // If notifications are not enabled, suggest enabling them
        if (!notificationsEnabled && getNotificationStatus().isSupported) {
          toast({
            title: "Enable Notifications",
            description: "Enable push notifications to get updates on this report?",
            action: (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Call the function directly instead of using it as a dependency
                  setIsRequestingPermission(true);
                  requestNotificationPermission()
                    .then(subscription => {
                      if (subscription) {
                        setNotificationsEnabled(true);
                        toast({
                          title: "Notifications Enabled",
                          description: "You will now receive push notifications for comments on this report.",
                        });
                      } else {
                        toast({
                          title: "Notifications Not Enabled",
                          description: "Please allow notifications in your browser settings to receive updates.",
                          variant: "destructive",
                        });
                      }
                    })
                    .catch(error => {
                      console.error("Error enabling notifications:", error);
                      toast({
                        title: "Error",
                        description: "Failed to enable notifications. Please try again.",
                        variant: "destructive",
                      });
                    })
                    .finally(() => {
                      setIsRequestingPermission(false);
                    });
                }}
                className="mt-2"
              >
                <Bell className="h-4 w-4 mr-2" />
                Enable
              </Button>
            ),
            duration: 10000,
          });
        }
      }
    } catch (error) {
      console.error("Error adding comment:", error);

      // Remove the optimistic comment on error
      setComments(prev => prev.filter(comment => comment.id !== optimisticComment.id));

      // Restore the comment text so the user doesn't lose their input
      setNewComment(sanitizedComment);

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add comment",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [newComment, reportId, session, notificationsEnabled, toast]);

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when not typing in a text field
      const isTyping = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName);

      // Ctrl+Enter to submit comment
      if (e.ctrlKey && e.key === 'Enter' && !isSubmitting && newComment.trim() && !isTyping) {
        e.preventDefault();
        handleSubmitComment();
      }

      // Alt+N to focus comment box
      if (e.altKey && e.key === 'n' && !isTyping) {
        e.preventDefault();
        textareaRef.current?.focus();
      }

      // Alt+R to refresh comments
      if (e.altKey && e.key === 'r' && !isTyping && !isLoading && !isRefreshing) {
        e.preventDefault();
        refreshComments();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [newComment, isSubmitting, isLoading, isRefreshing, refreshComments, handleSubmitComment]);

  // Scroll to bottom when new comments are added
  useEffect(() => {
    if (comments.length > 0 && !isLoading) {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments.length, isLoading]);

  // Function to load more comments
  const loadMoreComments = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchComments();
    }
  }, [isLoading, hasMore, fetchComments]);

  // Function to handle enabling notifications
  const handleEnableNotifications = useCallback(() => {
    if (isRequestingPermission) return;

    setIsRequestingPermission(true);
    requestNotificationPermission()
      .then(subscription => {
        if (subscription) {
          setNotificationsEnabled(true);
          toast({
            title: "Notifications Enabled",
            description: "You will now receive push notifications for comments on this report.",
          });
        } else {
          toast({
            title: "Notifications Not Enabled",
            description: "Please allow notifications in your browser settings to receive updates.",
            variant: "destructive",
          });
        }
      })
      .catch(error => {
        console.error("Error enabling notifications:", error);
        toast({
          title: "Error",
          description: "Failed to enable notifications. Please try again.",
          variant: "destructive",
        });
      })
      .finally(() => {
        setIsRequestingPermission(false);
      });
  }, [isRequestingPermission, toast]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    if (!reportId || !commentId || !session?.user) return;

    if (!confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    // Store the comment for potential restoration
    const commentToDelete = comments.find(comment => comment.id === commentId);
    if (!commentToDelete) return;

    // Optimistically remove the comment
    setComments(prev => prev.filter(comment => comment.id !== commentId));

    // Show toast with undo option
    const undoToast = toast({
      title: "Comment Deleted",
      description: "The comment has been removed",
      action: (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Restore the comment if user clicks undo
            setComments(prev => [...prev, commentToDelete]);
          }}
          className="mt-2"
        >
          Undo
        </Button>
      ),
      duration: 5000,
    });

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
        // Comment already removed optimistically, just update the toast
        toast({
          title: "Success",
          description: "Comment deleted successfully",
          duration: 2000,
        });
      }
    } catch (error) {
      console.error("Error deleting comment:", error);

      // Restore the comment on error
      setComments(prev => [...prev, commentToDelete]);

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete comment",
        variant: "destructive",
      });
    }
  }, [reportId, session, comments]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comments
        </h3>

        <div className="flex items-center gap-2">
          {/* Refresh button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-full"
                  onClick={refreshComments}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn(
                    "h-4 w-4",
                    isRefreshing && "animate-spin"
                  )} />
                  <span className="sr-only">Refresh comments</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh comments (Alt+R)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Keyboard shortcuts button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 w-8 p-0 rounded-full",
                    showKeyboardShortcuts && "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
                  )}
                  onClick={() => setShowKeyboardShortcuts(!showKeyboardShortcuts)}
                >
                  <Keyboard className="h-4 w-4" />
                  <span className="sr-only">Keyboard shortcuts</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle keyboard shortcuts</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Keyboard shortcuts panel */}
      {showKeyboardShortcuts && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 text-sm animate-in fade-in slide-in-from-top-5 duration-300">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium flex items-center gap-1 text-blue-700 dark:text-blue-300">
              <Keyboard className="h-4 w-4" />
              Keyboard Shortcuts
            </h4>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800"
              onClick={() => setShowKeyboardShortcuts(false)}
            >
              <ChevronUp className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
          <ul className="space-y-2 text-blue-700 dark:text-blue-300">
            <li className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700 text-xs font-mono">Ctrl+Enter</kbd>
              <span>Submit comment</span>
            </li>
            <li className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700 text-xs font-mono">Alt+N</kbd>
              <span>Focus comment box</span>
            </li>
            <li className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700 text-xs font-mono">Alt+R</kbd>
              <span>Refresh comments</span>
            </li>
          </ul>
        </div>
      )}

      {/* Load more button - only show if there are more comments to load */}
      {hasMore && comments.length > 0 && !isLoading && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30"
            onClick={loadMoreComments}
            disabled={isLoading}
          >
            <ArrowDown className="h-4 w-4" />
            Load More Comments
          </Button>
        </div>
      )}

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
          {/* Show a message when loading more comments */}
          {!isLoading && !isRefreshing && hasMore && comments.length >= 20 && (
            <div className="text-center text-xs text-gray-500 py-2">
              <p>Showing {comments.length} comments</p>
            </div>
          )}

          {comments.map((comment) => {
            const { type: commentType, content: commentContent } = processComment(comment);

            // Determine background and border colors based on comment type
            const bgColorClass = {
              'regular': 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
              'approval': 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
              'rejection': 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
              'system': 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
            }[commentType];

            // Determine avatar gradient based on comment type
            const avatarGradient = {
              'regular': 'from-blue-400 to-blue-600 hover:ring-blue-200 dark:hover:ring-blue-800',
              'approval': 'from-green-400 to-green-600 hover:ring-green-200 dark:hover:ring-green-800',
              'rejection': 'from-red-400 to-red-600 hover:ring-red-200 dark:hover:ring-red-800',
              'system': 'from-purple-400 to-purple-600 hover:ring-purple-200 dark:hover:ring-purple-800'
            }[commentType];

            // Determine icon based on comment type
            const CommentIcon = {
              'regular': User,
              'approval': CheckCircle,
              'rejection': XCircle,
              'system': Shield
            }[commentType];

            return (
              <div
                key={comment.id}
                className={`p-3 rounded-md border transition-all duration-200 hover:shadow-md ${bgColorClass}`}
              >
                <div className="flex items-start gap-3">
                  {/* User Avatar with Icon */}
                  <div className="flex-shrink-0">
                    <div className={`h-8 w-8 rounded-full bg-gradient-to-br ${avatarGradient} text-white flex items-center justify-center font-medium shadow-sm transition-transform duration-200 hover:scale-110 ring-2 ring-transparent`}>
                      <CommentIcon className="h-4 w-4" />
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {comment.user?.name || comment.user?.username || 'User'}
                        </span>

                        {/* Comment type badge */}
                        {commentType !== 'regular' && (
                          <Badge variant={
                            commentType === 'approval' ? 'success' :
                              commentType === 'rejection' ? 'destructive' :
                                'secondary'
                          } className="text-xs px-1 py-0">
                            {commentType === 'approval' ? 'Approved' :
                              commentType === 'rejection' ? 'Rejected' :
                                'System'}
                          </Badge>
                        )}

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

                    <div className={cn(
                      "mt-1 text-sm whitespace-pre-wrap leading-relaxed",
                      commentType === 'approval' && "text-green-800 dark:text-green-200",
                      commentType === 'rejection' && "text-red-800 dark:text-red-200",
                      commentType === 'system' && "text-blue-800 dark:text-blue-200"
                    )}>
                      {/* For approval/rejection comments, add a prefix icon */}
                      {commentType === 'approval' && (
                        <span className="inline-flex items-center mr-1 text-green-600 dark:text-green-400">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          <strong>Approved</strong>&nbsp;
                        </span>
                      )}
                      {commentType === 'rejection' && (
                        <span className="inline-flex items-center mr-1 text-red-600 dark:text-red-400">
                          <XCircle className="h-4 w-4 mr-1" />
                          <strong>Rejected</strong>&nbsp;
                        </span>
                      )}
                      {commentType === 'system' && (
                        <span className="inline-flex items-center mr-1 text-blue-600 dark:text-blue-400">
                          <Shield className="h-4 w-4 mr-1" />
                          <strong>System</strong>&nbsp;
                        </span>
                      )}

                      {commentContent.split(' ').map((word, i) => {
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
                    {commentType === 'regular' && (
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
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Reference for scrolling to the end of comments */}
          <div ref={commentsEndRef} className="h-1" />

          {/* Show a message when all comments are loaded */}
          {!hasMore && comments.length > 0 && (
            <div className="text-center text-xs text-gray-500 py-2 border-t border-gray-200 dark:border-gray-700 mt-4 pt-2">
              <p>All comments loaded</p>
            </div>
          )}
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
                autoFocus={autoFocusCommentForm}
              />

              <div className="flex justify-between items-center mt-2">
                {/* Emoji buttons and notification toggle */}
                <div className="flex space-x-1 items-center">
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

                  {/* Notification toggle button */}
                  {getNotificationStatus().isSupported && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "ml-2 rounded-full transition-all duration-200 hover:scale-110 focus:scale-110 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800",
                              notificationsEnabled ? "text-blue-500 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
                            )}
                            onClick={handleEnableNotifications}
                            disabled={isRequestingPermission}
                          >
                            {isRequestingPermission ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : notificationsEnabled ? (
                              <Bell className="h-4 w-4" />
                            ) : (
                              <BellOff className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {notificationsEnabled
                            ? "Notifications enabled - you'll receive updates for this report"
                            : "Enable notifications to receive updates for this report"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
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
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p>Submit comment (Ctrl+Enter)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
