import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { Permission, UserRole, checkPermission } from "@/lib/auth/roles";
import { format } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    // Check if user has permission to view audit logs using role-based approach
    const userRole = token.role as string;
    if (!checkPermission(userRole, Permission.VIEW_AUDIT_LOGS)) {
      return NextResponse.json(
        { error: "Forbidden - You don't have permission to view audit logs" },
        { status: 403 }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const type = url.searchParams.get("type") || "all"; // activity or userActivity or all
    const userId = url.searchParams.get("userId") || undefined;
    const action = url.searchParams.get("action") || undefined;
    const fromDate = url.searchParams.get("from") || undefined;
    const toDate = url.searchParams.get("to") || undefined;
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Prepare filter for ActivityLog
    const activityLogWhere: any = {};
    
    if (search) {
      activityLogWhere.OR = [
        { action: { contains: search, mode: "insensitive" } },
        { details: { contains: search, mode: "insensitive" } },
      ];
    }
    
    if (userId) {
      activityLogWhere.userId = userId;
    }
    
    if (action) {
      activityLogWhere.action = action;
    }
    
    if (fromDate) {
      activityLogWhere.timestamp = {
        ...(activityLogWhere.timestamp || {}),
        gte: new Date(fromDate),
      };
    }
    
    if (toDate) {
      activityLogWhere.timestamp = {
        ...(activityLogWhere.timestamp || {}),
        lte: new Date(toDate),
      };
    }

    // Prepare filter for UserActivity
    const userActivityWhere: any = {};
    
    if (search) {
      userActivityWhere.OR = [
        { action: { contains: search, mode: "insensitive" } },
      ];
    }
    
    if (userId) {
      userActivityWhere.userId = userId;
    }
    
    if (action) {
      userActivityWhere.action = action;
    }
    
    if (fromDate) {
      userActivityWhere.createdAt = {
        ...(userActivityWhere.createdAt || {}),
        gte: new Date(fromDate),
      };
    }
    
    if (toDate) {
      userActivityWhere.createdAt = {
        ...(userActivityWhere.createdAt || {}),
        lte: new Date(toDate),
      };
    }

    // Get audit logs with pagination based on type
    let activityLogs: any[] = [];
    let userActivities: any[] = [];
    let total = 0;

    if (type === "all" || type === "activity") {
      const [logs, activityTotal] = await Promise.all([
        prisma.activityLog.findMany({
          where: activityLogWhere,
          select: {
            id: true,
            userId: true,
            action: true,
            details: true,
            ipAddress: true,
            userAgent: true,
            timestamp: true,
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                email: true,
              },
            },
          },
          orderBy: {
            timestamp: "desc",
          },
          skip: type === "all" ? 0 : skip,
          take: type === "all" ? 25 : limit,
        }),
        prisma.activityLog.count({ where: activityLogWhere }),
      ]);
      
      activityLogs = logs;
      if (type === "activity") total = activityTotal;
      else total += activityTotal;
    }

    if (type === "all" || type === "userActivity") {
      const [activities, userActivityTotal] = await Promise.all([
        prisma.userActivity.findMany({
          where: userActivityWhere,
          select: {
            id: true,
            userId: true,
            action: true,
            details: true,
            ipAddress: true,
            userAgent: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          skip: type === "all" ? 0 : skip,
          take: type === "all" ? 25 : limit,
        }),
        prisma.userActivity.count({ where: userActivityWhere }),
      ]);
      
      userActivities = activities;
      if (type === "userActivity") total = userActivityTotal;
      else total += userActivityTotal;
    }

    // Format the response data
    const formattedActivityLogs = activityLogs.map((log) => ({
      id: log.id,
      userId: log.userId,
      user: log.user,
      action: log.action,
      details: log.details,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      timestamp: log.timestamp,
      type: "activity",
    }));

    const formattedUserActivities = userActivities.map((activity) => ({
      id: activity.id,
      userId: activity.userId,
      user: activity.user,
      action: activity.action,
      details: activity.details,
      ipAddress: activity.ipAddress,
      userAgent: activity.userAgent,
      timestamp: activity.createdAt,
      type: "userActivity",
    }));

    // Combine and sort if needed
    let auditLogs = [];
    if (type === "all") {
      auditLogs = [...formattedActivityLogs, ...formattedUserActivities].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ).slice(0, limit);
    } else if (type === "activity") {
      auditLogs = formattedActivityLogs;
    } else {
      auditLogs = formattedUserActivities;
    }

    const totalPages = Math.ceil(total / limit);

    // Get unique actions for filtering
    const actionResults = await prisma.$queryRaw`
      SELECT DISTINCT action FROM (
        SELECT action FROM "ActivityLog"
        UNION
        SELECT action FROM "UserActivity"
      ) as actions
      ORDER BY action;
    `;
    
    // Ensure each action has a non-empty action field
    const filteredActions = Array.isArray(actionResults) 
      ? actionResults.filter((action: any) => action && action.action && action.action.trim() !== "")
      : [];

    return NextResponse.json({
      auditLogs,
      meta: {
        total,
        page,
        limit,
        totalPages,
        actions: filteredActions,
      },
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, details, type = "activity" } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    // Get client IP and user agent
    const ip = request.headers.get("x-real-ip") || 
               request.headers.get("x-forwarded-for") || 
               "unknown";
    
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Create a new audit log entry
    let auditLog;
    if (type === "activity") {
      auditLog = await prisma.activityLog.create({
        data: {
          userId: token.sub as string,
          action,
          details: details || "",
          ipAddress: ip,
          userAgent,
        },
      });
    } else {
      auditLog = await prisma.userActivity.create({
        data: {
          userId: token.sub as string,
          action,
          details: details || {},
          ipAddress: ip,
          userAgent,
        },
      });
    }

    return NextResponse.json({ success: true, auditLog });
  } catch (error) {
    console.error("Error creating audit log:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 