"use client";

import { useState, useEffect, ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarIcon,
  BellIcon,
  CheckCircle,
  XCircle,
  BarChart,
  Bell,
  AlertTriangle,
} from "lucide-react";
import { formatDistance } from "date-fns";
import { NotificationEventType, NotificationBase } from "@/types/notifications";

// Dashboard for managing and viewing notifications
export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState("unread");
  const [notifications, setNotifications] = useState<NotificationBase[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [eventHistory, setEventHistory] = useState<Record<string, any[]>>({});

  // Fetch notifications on component mount
  useEffect(() => {
    fetchNotifications();
    fetchMetrics();
  }, []);

  // Fetch notifications based on active tab
  useEffect(() => {
    fetchNotifications();
  }, [activeTab]);

  // Fetch user's notifications
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const status =
        activeTab === "unread"
          ? "unread"
          : activeTab === "read"
            ? "read"
            : "all";
      const response = await fetch(`/api/notifications?status=${status}`);

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      } else {
        console.error("Failed to fetch notifications");
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch notification metrics
  const fetchMetrics = async () => {
    try {
      const response = await fetch("/api/notifications/metrics");

      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error("Error fetching notification metrics:", error);
    }
  };

  // Mark a notification as read
  const markAsRead = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
      });

      if (response.ok) {
        // Update the local state
        setNotifications((prevNotifications) =>
          prevNotifications.map((n) =>
            n.id === id ? { ...n, isRead: true } : n,
          ),
        );
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
      });

      if (response.ok) {
        // Refresh notifications
        fetchNotifications();
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  // Fetch event history for a notification
  const fetchEventHistory = async (id: string) => {
    // Check if we already have the data
    if (eventHistory[id]) return;

    try {
      const response = await fetch(`/api/notifications/${id}/events`);

      if (response.ok) {
        const data = await response.json();
        setEventHistory((prev) => ({
          ...prev,
          [id]: data.events || [],
        }));
      }
    } catch (error) {
      console.error("Error fetching notification event history:", error);
    }
  };

  // Format notification date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistance(date, new Date(), { addSuffix: true });
    } catch (e) {
      return dateString;
    }
  };

  // Get icon for notification type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "REPORT_SUBMITTED":
        return <BellIcon className="h-5 w-5 text-blue-500" />;
      case "REPORT_APPROVED":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "REPORT_REJECTED":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "REPORT_NEEDS_REVISION":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  // Get badge for event type
  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case NotificationEventType.DELIVERED:
        return <Badge className="bg-green-500">Delivered</Badge>;
      case NotificationEventType.CLICKED:
        return <Badge className="bg-blue-500">Clicked</Badge>;
      case NotificationEventType.FAILED:
        return <Badge variant="destructive">Failed</Badge>;
      case NotificationEventType.QUEUED:
        return <Badge variant="outline">Queued</Badge>;
      case NotificationEventType.SENT:
        return <Badge className="bg-yellow-500">Sent</Badge>;
      default:
        return <Badge variant="secondary">{eventType}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Notifications</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {metrics && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">Today</CardTitle>
                <CardDescription>Notifications received today</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{metrics.counts.today}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">This Week</CardTitle>
                <CardDescription>Last 7 days activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {metrics.counts.lastWeek}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">Read Rate</CardTitle>
                <CardDescription>
                  Percentage of read notifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {Math.round(metrics.readRatio * 100)}%
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Tabs
        defaultValue="unread"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="read">Read</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          <Button variant="outline" onClick={markAllAsRead}>
            Mark All as Read
          </Button>
        </div>

        <TabsContent value="unread" className="mt-0">
          <NotificationListComponent
            notifications={notifications.filter((n) => !n.isRead)}
            loading={loading}
            markAsRead={markAsRead}
            fetchEventHistory={fetchEventHistory}
            eventHistory={eventHistory}
            getNotificationIcon={getNotificationIcon}
            getEventBadge={getEventBadge}
            formatDate={formatDate}
          />
        </TabsContent>

        <TabsContent value="read" className="mt-0">
          <NotificationListComponent
            notifications={notifications.filter((n) => n.isRead)}
            loading={loading}
            markAsRead={markAsRead}
            fetchEventHistory={fetchEventHistory}
            eventHistory={eventHistory}
            getNotificationIcon={getNotificationIcon}
            getEventBadge={getEventBadge}
            formatDate={formatDate}
          />
        </TabsContent>

        <TabsContent value="all" className="mt-0">
          <NotificationListComponent
            notifications={notifications}
            loading={loading}
            markAsRead={markAsRead}
            fetchEventHistory={fetchEventHistory}
            eventHistory={eventHistory}
            getNotificationIcon={getNotificationIcon}
            getEventBadge={getEventBadge}
            formatDate={formatDate}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// NotificationList component
function NotificationListComponent({
  notifications,
  loading,
  markAsRead,
  fetchEventHistory,
  eventHistory,
  getNotificationIcon,
  getEventBadge,
  formatDate,
}: {
  notifications: NotificationBase[];
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  fetchEventHistory: (id: string) => Promise<void>;
  eventHistory: Record<string, any[]>;
  getNotificationIcon: (type: string) => ReactNode;
  getEventBadge: (type: string) => ReactNode;
  formatDate: (date: string) => string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      fetchEventHistory(id);
    }
  };

  if (loading) {
    return <div className="text-center py-10">Loading notifications...</div>;
  }

  if (!notifications.length) {
    return (
      <Card>
        <CardContent className="text-center py-10">
          <BellIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium">No notifications</h3>
          <p className="text-gray-500">You're all caught up!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {notifications.map((notification) => (
        <Card
          key={notification.id}
          className={`transition-all ${!notification.isRead ? "border-l-4 border-l-blue-500" : ""}`}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="mt-1">
                {getNotificationIcon(notification.type)}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">
                    {notification.title}
                  </h3>
                  <div className="flex gap-2 items-center">
                    <div className="text-sm text-gray-500 flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      {formatDate(notification.createdAt)}
                    </div>

                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsRead(notification.id)}
                      >
                        Mark Read
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpand(notification.id)}
                    >
                      {expandedId === notification.id
                        ? "Hide Details"
                        : "Details"}
                    </Button>
                  </div>
                </div>

                <p className="text-gray-700 mt-1">{notification.body}</p>

                {notification.actionUrl && (
                  <Button
                    variant="link"
                    className="p-0 h-auto mt-2"
                    onClick={() => {
                      if (!notification.isRead) {
                        markAsRead(notification.id);
                      }
                      if (notification.actionUrl) {
                        window.location.href = notification.actionUrl;
                      }
                    }}
                  >
                    View Details
                  </Button>
                )}

                {expandedId === notification.id && (
                  <div className="mt-4 border-t pt-3">
                    <h4 className="font-medium mb-2">Delivery Status</h4>
                    {eventHistory[notification.id] &&
                    eventHistory[notification.id].length > 0 ? (
                      <div className="space-y-2">
                        {eventHistory[notification.id].map((event, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded"
                          >
                            <div className="flex items-center gap-2">
                              {getEventBadge(event.event)}
                              <span>{formatDate(event.timestamp)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        No delivery information available
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
