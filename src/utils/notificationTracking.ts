import { prisma } from "@/lib/prisma";
import { NotificationEventType } from "@/types/notifications";

/**
 * Track a notification event
 */
export async function trackNotificationEvent(
  notificationId: string,
  event: NotificationEventType,
  metadata?: Record<string, unknown>,
) {
  try {
    await prisma.notificationEvent.create({
      data: {
        notificationId,
        event,
        metadata: metadata || {},
        timestamp: new Date(),
      },
    });
    return true;
  } catch (error) {
    console.error(`Failed to track notification event (${event}):`, error);
    return false;
  }
}

/**
 * Get delivery status statistics for notifications
 */
export async function getNotificationStats(
  startDate?: Date,
  endDate?: Date,
  type?: string,
) {
  const where: Record<string, unknown> = {};

  if (startDate || endDate) {
    where.createdAt = {} as Record<string, Date>;
    if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
    if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
  }

  if (type) {
    where.type = type;
  }

  const notifications = await prisma.inAppNotification.findMany({
    where,
    select: {
      id: true,
      type: true,
      createdAt: true,
      isRead: true,
      events: {
        select: {
          event: true,
          timestamp: true,
        },
      },
    },
  });

  // Calculate statistics
  const stats = {
    total: notifications.length,
    read: 0,
    unread: 0,
    delivered: 0,
    failed: 0,
    clicked: 0,
    byType: {} as Record<string, number>,
  };

  for (const notification of notifications) {
    // Count read/unread
    if (notification.isRead) {
      stats.read++;
    } else {
      stats.unread++;
    }

    // Count by type
    const type = notification.type;
    if (!stats.byType[type]) {
      stats.byType[type] = 0;
    }
    stats.byType[type]++;

    // Count delivery statuses
    for (const event of notification.events) {
      if (event.event === NotificationEventType.DELIVERED) {
        stats.delivered++;
      } else if (event.event === NotificationEventType.FAILED) {
        stats.failed++;
      } else if (event.event === NotificationEventType.CLICKED) {
        stats.clicked++;
      }
    }
  }

  return stats;
}

/**
 * Get detailed notification delivery history
 */
export async function getNotificationEventHistory(notificationId: string) {
  return prisma.notificationEvent.findMany({
    where: {
      notificationId,
    },
    orderBy: {
      timestamp: "asc",
    },
  });
}

/**
 * Mark notifications as delivered when service worker confirms delivery
 */
export async function markNotificationDelivered(
  notificationId: string,
  metadata?: Record<string, unknown>,
) {
  return trackNotificationEvent(
    notificationId,
    NotificationEventType.DELIVERED,
    metadata,
  );
}

/**
 * Track when a user clicks on a notification
 */
export async function trackNotificationClick(
  notificationId: string,
  metadata?: Record<string, unknown>,
) {
  try {
    // Record the click event
    await trackNotificationEvent(
      notificationId,
      NotificationEventType.CLICKED,
      metadata,
    );

    // Mark the notification as read
    await prisma.inAppNotification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return true;
  } catch (error) {
    console.error("Failed to track notification click:", error);
    return false;
  }
}

/**
 * Get real-time notification metrics for dashboard
 */
export async function getNotificationMetrics() {
  // Today's date at 00:00:00
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Yesterday's date at 00:00:00
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  // Last week's start date
  const lastWeekStart = new Date(todayStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  // Get counts for different time periods
  const [today, yesterday, lastWeek, total] = await Promise.all([
    prisma.inAppNotification.count({
      where: {
        createdAt: {
          gte: todayStart,
        },
      },
    }),
    prisma.inAppNotification.count({
      where: {
        createdAt: {
          gte: yesterdayStart,
          lt: todayStart,
        },
      },
    }),
    prisma.inAppNotification.count({
      where: {
        createdAt: {
          gte: lastWeekStart,
        },
      },
    }),
    prisma.inAppNotification.count(),
  ]);

  // Most active notification types
  const topTypes = await prisma.inAppNotification.groupBy({
    by: ["type"],
    _count: true,
    orderBy: {
      _count: {
        type: "desc",
      },
    },
    take: 5,
  });

  // Read vs unread ratio
  const readCount = await prisma.inAppNotification.count({
    where: {
      isRead: true,
    },
  });

  return {
    counts: {
      today,
      yesterday,
      lastWeek,
      total,
    },
    topTypes: topTypes.map((item) => ({
      type: item.type,
      count: item._count,
    })),
    readRatio: total > 0 ? readCount / total : 0,
  };
}
