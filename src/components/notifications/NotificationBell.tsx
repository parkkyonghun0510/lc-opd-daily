"use client";

import { useState, useEffect } from "react";
import { Bell, BellRing, X, Check, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { format, isToday, isYesterday } from "date-fns";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  data: any;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string | null;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const hasNotifications = notifications.length > 0;
  const hasUnread = unreadCount > 0;

  // Fetch notifications on mount and when popover opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Fetch on mount to get unread count
  useEffect(() => {
    fetchNotifications();
  }, []);

  // Poll for new notifications every minute
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!isOpen) {
        // Only fetch for new ones if popover is closed
        fetchNotifications(true);
      }
    }, 60000);

    return () => clearInterval(intervalId);
  }, [isOpen]);

  async function fetchNotifications(countOnly = false) {
    try {
      setLoading(true);
      const response = await fetch(
        countOnly ? "/api/notifications/unread-count" : "/api/notifications",
      );

      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }

      const data = await response.json();

      if (countOnly) {
        setUnreadCount(data.count);
      } else {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(id: string) {
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to mark notification as read");
      }

      // Update local state
      setNotifications(
        notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );

      // Decrement unread count
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }

  async function markAllAsRead() {
    try {
      const response = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to mark all notifications as read");
      }

      // Update local state
      setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  }

  function handleNotificationClick(notification: Notification) {
    // Mark as read
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    // Navigate if action URL is available
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }

    // Close the popover
    setIsOpen(false);
  }

  function formatNotificationTime(createdAt: string) {
    const date = new Date(createdAt);

    if (isToday(date)) {
      return `Today at ${format(date, "h:mm a")}`;
    } else if (isYesterday(date)) {
      return `Yesterday at ${format(date, "h:mm a")}`;
    } else {
      return format(date, "MMM d, yyyy");
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          {hasUnread ? (
            <BellRing className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {hasUnread && (
            <Badge
              className="absolute -top-1 -right-1 px-1.5 h-5 min-w-5 flex items-center justify-center bg-red-500"
              variant="destructive"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 md:w-96 p-0" align="end">
        <div className="p-4 pb-2 flex items-center justify-between">
          <h4 className="font-medium text-sm">Notifications</h4>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 px-1 text-xs text-blue-500 font-medium"
              onClick={markAllAsRead}
            >
              Mark all as read
            </Button>
          )}
        </div>
        <Separator />
        <ScrollArea className="h-[calc(80vh-8rem)] max-h-[400px]">
          {loading && !hasNotifications ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Loading notifications...
            </div>
          ) : !hasNotifications ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              You have no notifications
            </div>
          ) : (
            <div className="space-y-0.5">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "flex flex-col gap-1 p-4 relative",
                    notification.isRead
                      ? "bg-background"
                      : "bg-muted hover:bg-muted/80",
                  )}
                  role="button"
                  onClick={() => handleNotificationClick(notification)}
                >
                  {!notification.isRead && (
                    <div className="absolute left-1.5 top-4 w-1.5 h-1.5 rounded-full bg-blue-500" />
                  )}
                  <div className="flex justify-between items-start">
                    <h5 className="font-medium text-sm line-clamp-1">
                      {notification.title || "Notification"}
                    </h5>
                    <div className="flex space-x-1">
                      {!notification.isRead && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                        >
                          <Check className="h-3 w-3" />
                          <span className="sr-only">Mark as read</span>
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {notification.body}
                  </p>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-muted-foreground">
                      {formatNotificationTime(notification.createdAt)}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-xs capitalize px-1.5 h-5"
                    >
                      {notification.type.toLowerCase().replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <Separator />
        <div className="p-2 text-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => {
              window.location.href = "/notifications";
              setIsOpen(false);
            }}
          >
            <Eye className="mr-1 h-3 w-3" />
            View all
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
