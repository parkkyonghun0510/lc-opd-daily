import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { Permission, UserRole, checkPermission } from "@/lib/auth/roles";
import { AuditAction, createServerAuditLog } from "@/lib/audit";

// POST /api/reports/[id]/approve - Approve or reject a report
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 }
      );
    }

    // Check if user has permission to approve reports
    const userRole = token.role as UserRole;
    if (!checkPermission(userRole, Permission.APPROVE_REPORTS)) {
      return NextResponse.json(
        { error: "Forbidden - You don't have permission to approve reports" },
        { status: 403 }
      );
    }

    const { id } = params;
    const { status, comments, notifyUsers } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Report ID is required" },
        { status: 400 }
      );
    }

    if (!status || !["approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "Valid status (approved or rejected) is required" },
        { status: 400 }
      );
    }

    // If rejecting, comments are required
    if (status === "rejected" && !comments) {
      return NextResponse.json(
        { error: "Comments are required when rejecting a report" },
        { status: 400 }
      );
    }

    // Check if report exists
    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        branch: true,
      },
    });

    if (!report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    // Only allow pending reports to be approved/rejected
    if (report.status !== "pending") {
      return NextResponse.json(
        { 
          error: `Report cannot be ${status}. Current status is: ${report.status}` 
        },
        { status: 400 }
      );
    }

    // Update the report status
    const updatedReport = await prisma.report.update({
      where: { id },
      data: {
        status,
        // Store approval/rejection comments if provided
        comments: comments || report.comments,
      },
    });

    // Create an audit log entry for the approval/rejection
    try {
      const actionType = status === "approved" 
        ? AuditAction.REPORT_APPROVED 
        : AuditAction.REPORT_REJECTED;
      
      // Use the createServerAuditLog utility function
      await createServerAuditLog({
        userId: token.sub as string,
        action: actionType,
        details: {
          reportId: report.id,
          branchId: report.branchId,
          branchName: report.branch.name,
          reportDate: report.date,
          reportType: report.reportType,
          comments: comments || "",
          previousStatus: report.status,
          newStatus: status,
        },
        requestInfo: {
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
          userAgent: request.headers.get("user-agent") || "unknown",
        },
        type: "userActivity" // Create both activity log and user activity
      });
    } catch (auditError) {
      console.error("Error creating audit log (non-critical):", auditError);
      // Continue with the process even if audit log fails
    }

    // Handle notifications for users (if requested)
    if (notifyUsers) {
      // Notification logic would go here
    }

    return NextResponse.json({
      success: true,
      report: updatedReport,
      message: `Report ${status} successfully`,
    });
  } catch (error) {
    console.error("Error approving report:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 