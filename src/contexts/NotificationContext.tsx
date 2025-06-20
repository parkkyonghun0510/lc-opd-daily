"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { useSession } from "next-auth/react";

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

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  fetchNotifications: (
    limit?: number,
    offset?: number,
    unreadOnly?: boolean,
  ) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Track last fetch time to implement caching
  const lastFetchRef = useRef<Record<string, number>>({
    all: 0,
    unread: 0,
  });

  // Track in-flight requests to prevent duplicate calls
  const pendingRequestsRef = useRef<Record<string, boolean>>({});

  // Combine fetchNotifications to reduce unnecessary API calls
  const fetchNotifications = useCallback(
    async (limit = 20, offset = 0, unreadOnly = false) => {
      if (status !== "authenticated") return;

      // Generate a cache key based on params
      const cacheKey = `${unreadOnly ? "unread" : "all"}-${limit}-${offset}`;

      // Don't fetch if there's already an active request for this exact query
      if (pendingRequestsRef.current[cacheKey]) {
        return;
      }

      // Don't fetch if we've fetched recently (cache for 30 seconds), unless it's a specific offset request
      const now = Date.now();
      const lastFetch = lastFetchRef.current[unreadOnly ? "unread" : "all"];
      if (offset === 0 && now - lastFetch < 30000) {
        return;
      }

      try {
        setLoading(true);
        setError(null);
        pendingRequestsRef.current[cacheKey] = true;

        const params = new URLSearchParams({
          limit: limit.toString(),
          offset: offset.toString(),
          unread: unreadOnly.toString(),
        });

        const response = await fetch(
          `/api/notifications?${params.toString()}`,
          {
            // Add cache headers
            headers: {
              "Cache-Control": "no-cache",
            },
          },
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to fetch notifications");
        }

        const data = await response.json();

        // Update the last fetch timestamp
        lastFetchRef.current[unreadOnly ? "unread" : "all"] = now;

        if (offset === 0) {
          // Replace all notifications if this is the first page
          setNotifications(data.notifications);
        } else {
          // Append to existing notifications for pagination
          setNotifications((prev) => {
            // Filter out duplicates when appending
            const existingIds = new Set(prev.map((n) => n.id));
            const newNotifications = data.notifications.filter(
              (n: Notification) => !existingIds.has(n.id),
            );
            return [...prev, ...newNotifications];
          });
        }

        setUnreadCount(data.unreadCount);
      } catch (err) {
        console.error("Error fetching notifications:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch notifications",
        );
      } finally {
        setLoading(false);
        pendingRequestsRef.current[cacheKey] = false;
      }
    },
    [status],
  );

  // Add a quick refresh method that only gets the unread count
  const refreshNotifications = useCallback(async () => {
    if (status !== "authenticated") return;

    try {
      // Use a simpler query just to get the count
      const response = await fetch(
        "/api/notifications?limit=1&offset=0&unread=true",
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setUnreadCount(data.unreadCount);

      // If there are new notifications, update the list
      if (data.unreadCount > unreadCount) {
        fetchNotifications(15, 0, false);
      }
    } catch (err) {
      // Silent fail for background refreshes
      console.error("Error refreshing notification count:", err);
    }
  }, [status, unreadCount, fetchNotifications]);

  // Fetch notifications on initial load and when session changes
  useEffect(() => {
    if (status === "authenticated") {
      fetchNotifications();

      // Polling for new notifications every minute
      const intervalId = setInterval(() => {
        refreshNotifications();
      }, 60000); // Reduced polling frequency to 1 minute

      return () => clearInterval(intervalId);
    }
  }, [status, fetchNotifications, refreshNotifications]);

  const markAsRead = useCallback(
    async (id: string) => {
      try {
        // Optimistic update
        setNotifications((prev) =>
          prev.map((notif) =>
            notif.id === id
              ? { ...notif, isRead: true, readAt: new Date().toISOString() }
              : notif,
          ),
        );

        // Optimistically update unread count
        setUnreadCount((prev) => Math.max(0, prev - 1));

        const response = await fetch(`/api/notifications/${id}/read`, {
          method: "PUT",
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to mark notification as read");
        }
      } catch (err) {
        // Revert the optimistic update on error
        console.error("Error marking notification as read:", err);

        // Refresh to get the correct state
        fetchNotifications();
        throw err;
      }
    },
    [fetchNotifications],
  );

  const markAllAsRead = useCallback(async () => {
    try {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((notif) => ({
          ...notif,
          isRead: true,
          readAt: new Date().toISOString(),
        })),
      );

      // Update unread count optimistically
      setUnreadCount(0);

      const response = await fetch("/api/notifications/read-all", {
        method: "PUT",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error || "Failed to mark all notifications as read",
        );
      }
    } catch (err) {
      console.error("Error marking all notifications as read:", err);

      // Refresh to get the correct state on error
      fetchNotifications();
      throw err;
    }
  }, [fetchNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        error,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider",
    );
  }
  return context;
}
