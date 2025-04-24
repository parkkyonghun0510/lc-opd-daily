"use client";

import { useState } from "react";
import { MessageSquareReply, Loader2, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CommentItem as CommentItemType } from "@/types/reports";
import { toast } from "@/components/ui/use-toast";
import { useSession } from "next-auth/react";
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

  // Check if the current user is the author of the comment
  const isAuthor = session?.user?.id === comment.userId;

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
          "p-3 rounded-md",
          getBgColor(comment.type),
          level > 0 && "ml-4"
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
          <span className={cn(
            "text-xs font-medium",
            getTextColor(comment.type, 'header')
          )}>
            {getHeaderText(comment)}
          </span>
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end">
              <span className={cn(
                "text-xs",
                getTextColor(comment.type, 'header')
              )}>
                {comment.timestamp}
              </span>
              {comment.edited && (
                <span className="text-xs text-gray-500 italic">
                  (edited {comment.editedAt ? new Date(comment.editedAt).toLocaleTimeString() : ''})
                </span>
              )}
            </div>

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
          <p className={cn(
            "text-sm whitespace-pre-wrap",
            getTextColor(comment.type, 'text')
          )}>
            {comment.text}
          </p>
        )}

        {/* Reply button - only show if not editing */}
        {!isEditing && level < 2 && (
          <div className="mt-2 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReplyClick}
              className="text-xs flex items-center gap-1 h-6 px-2"
            >
              <MessageSquareReply className="h-3 w-3" />
              Reply
            </Button>
          </div>
        )}

        {/* Reply form */}
        {isReplying && (
          <div className="mt-2 space-y-2">
            <Textarea
              placeholder="Write your reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="resize-none text-sm min-h-[60px]"
            />
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsReplying(false);
                  setReplyText("");
                }}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmitReply}
                disabled={!replyText.trim() || isSubmittingReply}
                className="h-7 text-xs"
              >
                {isSubmittingReply ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Reply"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Render replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-6 space-y-2">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              reportId={reportId}
              onReplyAdded={onReplyAdded}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
