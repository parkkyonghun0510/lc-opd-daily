"use client";

import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageSquare,
  FileText,
} from "lucide-react";
import { useNotifications } from "@/contexts/NotificationContext";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
  actionUrl: string | null;
}

interface NotificationListProps {
  notifications: Notification[];
  onClose?: () => void;
  maxHeight?: string;
}

export function NotificationList({
  notifications,
  onClose,
  maxHeight,
}: NotificationListProps) {
  const router = useRouter();
  const { markAsRead } = useNotifications();

  // Get icon based on notification type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "REPORT_APPROVED":
        return <CheckCircle className="text-green-500" size={18} />;
      case "REPORT_REJECTED":
        return <XCircle className="text-red-500" size={18} />;
      case "REPORT_NEEDS_REVISION":
        return <AlertCircle className="text-amber-500" size={18} />;
      case "COMMENT_ADDED":
        return <MessageSquare className="text-blue-500" size={18} />;
      default:
        return <FileText className="text-gray-500" size={18} />;
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    if (notification.actionUrl) {
      router.push(notification.actionUrl);
      if (onClose) onClose();
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col divide-y",
        maxHeight && `max-h-[${maxHeight}] overflow-auto`,
      )}
    >
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={cn(
            "p-4 hover:bg-accent/50 cursor-pointer flex gap-3 transition-colors",
            !notification.isRead && "bg-muted/50",
          )}
          onClick={() => handleNotificationClick(notification)}
        >
          <div className="flex-shrink-0 mt-0.5">
            {getNotificationIcon(notification.type)}
          </div>

          <div className="flex-1">
            <div className="flex justify-between items-start">
              <h4
                className={cn(
                  "text-sm font-medium",
                  !notification.isRead && "font-semibold",
                )}
              >
                {notification.title}
              </h4>
              <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                {formatDistanceToNow(new Date(notification.createdAt), {
                  addSuffix: true,
                })}
              </span>
            </div>

            <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
              {notification.body}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
