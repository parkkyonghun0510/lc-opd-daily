import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { Permission, UserRole, checkPermission } from "@/lib/auth/roles";
import { AuditAction } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    // Check if user has permission to view approval history
    const userRole = token.role as UserRole;
    if (!checkPermission(userRole, Permission.APPROVE_REPORTS)) {
      return NextResponse.json(
        {
          error:
            "Forbidden - You don't have permission to view approval history",
        },
        { status: 403 },
      );
    }

    // Parse request body
    const {
      page = 1,
      limit = 10,
      branchId,
      reportType,
      status,
      dateRange,
      searchTerm,
    } = await request.json();

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build the where condition for UserActivity
    const where: any = {
      action: {
        in: [AuditAction.REPORT_APPROVED, AuditAction.REPORT_REJECTED],
      },
    };

    // Add search filter if provided
    if (searchTerm) {
      where.OR = [
        {
          details: {
            path: ["branchName"],
            string_contains: searchTerm,
          },
        },
        {
          user: {
            name: {
              contains: searchTerm,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    // Add branch filter if provided
    if (branchId) {
      where.details = {
        ...where.details,
        path: ["branchId"],
        equals: branchId,
      };
    }

    // Add report type filter if provided
    if (reportType) {
      where.details = {
        ...where.details,
        path: ["reportType"],
        equals: reportType,
      };
    }

    // Add status filter if provided
    if (status) {
      where.action =
        status === "approved"
          ? AuditAction.REPORT_APPROVED
          : AuditAction.REPORT_REJECTED;
    }

    // Add date range filter if provided
    if (dateRange?.from || dateRange?.to) {
      where.createdAt = {};

      if (dateRange.from) {
        where.createdAt.gte = new Date(dateRange.from);
      }

      if (dateRange.to) {
        where.createdAt.lte = new Date(dateRange.to);
      }
    }

    // Get approval history from UserActivity
    const [activities, totalCount] = await Promise.all([
      prisma.userActivity.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.userActivity.count({ where }),
    ]);

    // Process the activities to extract report details
    const approvalHistory = activities.map((activity) => {
      const details = activity.details as any;
      return {
        id: activity.id,
        reportId: details.reportId || "",
        branchId: details.branchId || "",
        branchName: details.branchName || "Unknown Branch",
        reportDate: details.reportDate || "",
        reportType: details.reportType || "",
        status:
          activity.action === AuditAction.REPORT_APPROVED
            ? "approved"
            : "rejected",
        comments: details.comments || "",
        approvedBy: activity.userId,
        approverName: activity.user?.name || "Unknown User",
        timestamp: activity.createdAt,
      };
    });

    return NextResponse.json({
      approvalHistory,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching approval history:", error);
    return NextResponse.json(
      { error: "Failed to fetch approval history" },
      { status: 500 },
    );
  }
}
