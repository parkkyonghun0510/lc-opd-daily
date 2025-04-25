"use client";

import { useState, useMemo } from "react";
import { MessageSquareReply, Loader2, Pencil, Trash2, MoreHorizontal, ThumbsUp, Heart, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CommentItem as CommentItemType } from "@/types/reports";
import { toast } from "@/components/ui/use-toast";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Reaction {
  type: 'like' | 'heart' | 'smile';
  count: number;
  userIds: string[];
}

interface CommentItemProps {
  comment: CommentItemType;
  reportId: string;
  onReplyAdded: () => void;
  level?: number;
}

export function CommentItem({ comment, reportId, onReplyAdded, level = 0 }: CommentItemProps) {
  const { data: session } = useSession();
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [editText, setEditText] = useState(comment.text);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [isReacting, setIsReacting] = useState(false);
  const [reactions, setReactions] = useState<Reaction[]>([
    { type: 'like', count: Math.floor(Math.random() * 3), userIds: [] },
    { type: 'heart', count: Math.floor(Math.random() * 2), userIds: [] },
    { type: 'smile', count: Math.floor(Math.random() * 2), userIds: [] }
  ]);

  // Format relative time (e.g., "2 minutes ago")
  const relativeTime = useMemo(() => {
    try {
      // Try to parse the timestamp
      const date = new Date(comment.timestamp);
      if (!isNaN(date.getTime())) {
        return formatDistanceToNow(date, { addSuffix: true });
      }
      return comment.timestamp; // Fallback to original timestamp
    } catch (error) {
      return comment.timestamp; // Fallback to original timestamp
    }
  }, [comment.timestamp]);

  // Check if the current user is the author of the comment
  const isAuthor = session?.user?.id === comment.userId;

  // Get user's first initial for avatar
  const userInitial = comment.userName ? comment.userName.charAt(0).toUpperCase() : 'U';

  // Get reaction counts safely
  const likeCount = reactions.find(r => r.type === 'like')?.count || 0;
  const heartCount = reactions.find(r => r.type === 'heart')?.count || 0;
  const smileCount = reactions.find(r => r.type === 'smile')?.count || 0;

  const handleReplyClick = () => {
    setIsReplying(!isReplying);
    if (isEditing) setIsEditing(false);
  };

  const handleEditClick = () => {
    setIsEditing(!isEditing);
    if (isReplying) setIsReplying(false);
    setEditText(comment.text);
  };

  const handleDeleteClick = () => {
    setIsDeleting(true);
  };

  const handleCancelDelete = () => {
    setIsDeleting(false);
  };

  const handleSubmitReply = async () => {
    if (!replyText.trim()) return;

    setIsSubmittingReply(true);
    try {
      // API call to add a reply
      const response = await fetch(`/api/reports/${reportId}/comments/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: replyText,
          parentId: comment.id
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error("Reply submission error:", responseData);
        throw new Error(responseData.error || 'Failed to add reply');
      }

      toast({
        title: "Reply Added",
        description: "Your reply has been added successfully",
      });

      setReplyText("");
      setIsReplying(false);
      onReplyAdded();
    } catch (error) {
      console.error("Error adding reply:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add reply",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleSubmitEdit = async () => {
    if (!editText.trim() || editText === comment.text) {
      setIsEditing(false);
      return;
    }

    setIsSubmittingEdit(true);
    try {
      // API call to edit the comment
      const response = await fetch(`/api/reports/${reportId}/comments/${comment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: editText
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error("Edit submission error:", responseData);
        throw new Error(responseData.error || 'Failed to edit comment');
      }

      toast({
        title: "Comment Updated",
        description: "Your comment has been updated successfully",
      });

      setIsEditing(false);
      onReplyAdded(); // Refresh comments
    } catch (error) {
      console.error("Error editing comment:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to edit comment",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsSubmittingDelete(true);
    try {
      // API call to delete the comment
      const response = await fetch(`/api/reports/${reportId}/comments/${comment.id}`, {
        method: 'DELETE',
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error("Delete error:", responseData);
        throw new Error(responseData.error || 'Failed to delete comment');
      }

      toast({
        title: "Comment Deleted",
        description: "Your comment has been deleted successfully",
      });

      setIsDeleting(false);
      onReplyAdded(); // Refresh comments
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete comment",
        variant: "destructive",
      });
      setIsDeleting(false);
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Handle reaction click
  const handleReaction = (type: 'like' | 'heart' | 'smile') => {
    setIsReacting(true);

    // In a real implementation, this would call an API to save the reaction
    // For now, we'll just update the local state
    setReactions(prevReactions => {
      return prevReactions.map(reaction => {
        if (reaction.type === type) {
          const userId = session?.user?.id || 'anonymous';
          const hasReacted = reaction.userIds.includes(userId);

          if (hasReacted) {
            // Remove the reaction
            return {
              ...reaction,
              count: Math.max(0, reaction.count - 1),
              userIds: reaction.userIds.filter(id => id !== userId)
            };
          } else {
            // Add the reaction
            return {
              ...reaction,
              count: reaction.count + 1,
              userIds: [...reaction.userIds, userId]
            };
          }
        }
        return reaction;
      });
    });

    setTimeout(() => {
      setIsReacting(false);
    }, 300);
  };

  // Get reaction icon color based on whether user has reacted
  const getReactionColor = (type: 'like' | 'heart' | 'smile') => {
    const userId = session?.user?.id || 'anonymous';
    const reaction = reactions.find(r => r.type === type);
    return reaction?.userIds.includes(userId) ? 'text-blue-500' : 'text-gray-400';
  };

  // Determine the background color based on comment type
  const getBgColor = (type: string) => {
    switch (type) {
      case 'rejection':
        return "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800";
      case 'comment':
        return "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800";
      case 'reply':
        return "bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700";
      default:
        return "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800";
    }
  };

  // Determine the text color based on comment type
  const getTextColor = (type: string, element: 'header' | 'text') => {
    if (element === 'header') {
      switch (type) {
        case 'rejection':
          return "text-red-800 dark:text-red-300";
        case 'comment':
          return "text-blue-800 dark:text-blue-300";
        case 'reply':
          return "text-gray-800 dark:text-gray-300";
        default:
          return "text-green-800 dark:text-green-300";
      }
    } else {
      switch (type) {
        case 'rejection':
          return "text-red-800 dark:text-red-200";
        case 'comment':
          return "text-blue-800 dark:text-blue-200";
        case 'reply':
          return "text-gray-800 dark:text-gray-200";
        default:
          return "text-green-800 dark:text-green-200";
      }
    }
  };

  // Get the header text based on comment type
  const getHeaderText = (comment: CommentItemType) => {
    switch (comment.type) {
      case 'rejection':
        return "Rejection Feedback";
      case 'comment':
        return `Comment by ${comment.userName}`;
      case 'reply':
        return `Reply by ${comment.userName}`;
      case 'resubmission':
        return "Resubmission";
      default:
        return `${comment.type} by ${comment.userName}`;
    }
  };

  return (
    <div className="space-y-3">
      {/* Delete confirmation dialog */}
      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your comment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete} disabled={isSubmittingDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isSubmittingDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmittingDelete ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div
        className={cn(
          "p-3 rounded-md transition-all duration-200 hover:shadow-md",
          getBgColor(comment.type),
          level > 0 && "ml-4"
        )}
      >
        <div className="flex items-start gap-3">
          {/* User Avatar */}
          <Avatar className="h-8 w-8 ring-2 ring-transparent hover:ring-blue-200 dark:hover:ring-blue-800 transition-all duration-200">
            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${comment.userName}`} alt={comment.userName} />
            <AvatarFallback className="bg-gradient-to-br from-blue-400 to-blue-600 text-white">{userInitial}</AvatarFallback>
          </Avatar>

          <div className="flex-1">
            {/* Comment Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-sm font-medium",
                  getTextColor(comment.type, 'header')
                )}>
                  {comment.userName}
                </span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-gray-500 cursor-default">
                        {relativeTime}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{comment.timestamp}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {comment.edited && (
                  <span className="text-xs text-gray-500 italic">
                    (edited)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Comment actions dropdown for author */}
                {isAuthor && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">More</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleEditClick}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleDeleteClick}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

            {/* Comment content - show edit form or text */}
            {isEditing ? (
              <div className="mt-2 space-y-2">
                <Textarea
                  placeholder="Edit your comment..."
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="resize-none text-sm min-h-[60px]"
                />
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      setEditText(comment.text);
                    }}
                    className="h-7 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmitEdit}
                    disabled={!editText.trim() || editText === comment.text || isSubmittingEdit}
                    className="h-7 text-xs"
                  >
                    {isSubmittingEdit ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <p className={cn(
                  "text-sm whitespace-pre-wrap leading-relaxed",
                  getTextColor(comment.type, 'text')
                )}>
                  {comment.text.split(' ').map((word, i) => {
                    // Simple URL detection
                    if (word.startsWith('http://') || word.startsWith('https://')) {
                      return (
                        <span key={i}>
                          <a
                            href={word}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
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
                            className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer hover:underline"
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
                            className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer hover:underline"
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
                </p>

                {/* Reactions */}
                <div className="mt-2 flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReaction('like')}
                          className={cn(
                            "text-xs flex items-center gap-1 h-6 px-2 transition-all duration-200",
                            getReactionColor('like'),
                            "hover:bg-blue-50 dark:hover:bg-blue-900/20",
                            isReacting ? "scale-110" : ""
                          )}
                          disabled={isReacting}
                        >
                          <ThumbsUp className="h-3 w-3" />
                          {likeCount > 0 && (
                            <span>{likeCount}</span>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-1">
                          <p className="font-medium">Like</p>
                          {likeCount > 0 ? (
                            <p className="text-xs text-gray-500">{likeCount} {likeCount === 1 ? 'person' : 'people'} liked this</p>
                          ) : (
                            <p className="text-xs text-gray-500">Be the first to like</p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReaction('heart')}
                          className={cn(
                            "text-xs flex items-center gap-1 h-6 px-2 transition-all duration-200",
                            getReactionColor('heart'),
                            "hover:bg-red-50 dark:hover:bg-red-900/20",
                            isReacting ? "scale-110" : ""
                          )}
                          disabled={isReacting}
                        >
                          <Heart className="h-3 w-3" />
                          {heartCount > 0 && (
                            <span>{heartCount}</span>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-1">
                          <p className="font-medium">Heart</p>
                          {heartCount > 0 ? (
                            <p className="text-xs text-gray-500">{heartCount} {heartCount === 1 ? 'person' : 'people'} loved this</p>
                          ) : (
                            <p className="text-xs text-gray-500">Show some love</p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReaction('smile')}
                          className={cn(
                            "text-xs flex items-center gap-1 h-6 px-2 transition-all duration-200",
                            getReactionColor('smile'),
                            "hover:bg-yellow-50 dark:hover:bg-yellow-900/20",
                            isReacting ? "scale-110" : ""
                          )}
                          disabled={isReacting}
                        >
                          <Smile className="h-3 w-3" />
                          {smileCount > 0 && (
                            <span>{smileCount}</span>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-1">
                          <p className="font-medium">Smile</p>
                          {smileCount > 0 ? (
                            <p className="text-xs text-gray-500">{smileCount} {smileCount === 1 ? 'person' : 'people'} smiled at this</p>
                          ) : (
                            <p className="text-xs text-gray-500">Add a smile</p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <div className="flex-1"></div>

                  {/* Reply button - only show if not editing */}
                  {level < 2 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleReplyClick}
                      className="text-xs flex items-center gap-1 h-6 px-2 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <MessageSquareReply className="h-3 w-3" />
                      Reply
                      {comment.replies && comment.replies.length > 0 && (
                        <span className="ml-1 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full text-xs">
                          {comment.replies.length}
                        </span>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Reply form */}
        {isReplying && (
          <div className="mt-3 ml-8 space-y-2">
            <div className="flex items-start gap-3">
              {/* User Avatar for reply */}
              <Avatar className="h-8 w-8 ring-2 ring-transparent hover:ring-blue-200 dark:hover:ring-blue-800 transition-all duration-200">
                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${session?.user?.name || 'User'}`} alt={session?.user?.name || 'User'} />
                <AvatarFallback className="bg-gradient-to-br from-green-400 to-green-600 text-white">{session?.user?.name ? session.user.name.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <Textarea
                  placeholder="Write your reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="resize-none text-sm min-h-[60px] w-full focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all duration-200"
                  autoFocus
                />
                <div className="flex justify-end space-x-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsReplying(false);
                      setReplyText("");
                    }}
                    className="h-7 text-xs transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmitReply}
                    disabled={!replyText.trim() || isSubmittingReply}
                    className={cn(
                      "h-7 text-xs transition-all duration-200",
                      replyText.trim() ? "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700" : ""
                    )}
                  >
                    {isSubmittingReply ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Reply"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Render replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-8 mt-3 space-y-3 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
          {/* Show a "View all replies" button if there are more than 2 replies */}
          {comment.replies.length > 2 ? (
            <>
              {/* Show first 2 replies */}
              {comment.replies.slice(0, 2).map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  reportId={reportId}
                  onReplyAdded={onReplyAdded}
                  level={level + 1}
                />
              ))}

              {/* View all replies button */}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs flex items-center gap-1 ml-2 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-all duration-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 group"
                onClick={() => toast({
                  title: "View All Replies",
                  description: `In a full implementation, this would expand to show all ${comment.replies?.length || 0} replies.`,
                })}
              >
                <MessageSquareReply className="h-3 w-3 group-hover:animate-pulse" />
                <span className="group-hover:underline">View all {comment.replies?.length || 0} replies</span>
              </Button>
            </>
          ) : (
            // If 2 or fewer replies, show them all
            comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                reportId={reportId}
                onReplyAdded={onReplyAdded}
                level={level + 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
