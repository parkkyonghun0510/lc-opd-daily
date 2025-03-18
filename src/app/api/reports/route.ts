import { NextRequest, NextResponse } from "next/server";
import { withPermissionGuard } from "@/middleware/api-permission-guard";
import { Permission } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";

type ReportType = "plan" | "actual";

interface ReportData {
  branchId: string;
  date: string;
  writeOffs: number;
  ninetyPlus: number;
  comments?: string;
  reportType: ReportType;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// GET handler to list reports - requires VIEW_REPORTS permission
export const GET = withPermissionGuard(
  async (req, context, currentUser): Promise<NextResponse<ApiResponse<any>>> => {
    try {
      // Get query parameters
      const { searchParams } = new URL(req.url);
      const branchId = searchParams.get("branchId");
      const date = searchParams.get("date");
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "10");
      const skip = (page - 1) * limit;

      // Build query filters
      const filters: any = {};
      
      // If branch ID is specified, filter by it
      if (branchId) {
        filters.branchId = branchId;
      } 
      // If not admin and has assigned branches, filter to only those branches
      else if (currentUser.role !== "ADMIN" && currentUser.assignedBranchIds?.length) {
        filters.branchId = {
          in: currentUser.assignedBranchIds
        };
      }
      // If not admin and has a branchId, filter to that branch
      else if (currentUser.role !== "ADMIN" && currentUser.branchId) {
        filters.branchId = currentUser.branchId;
      }

      // If date is specified, filter by it
      if (date) {
        filters.date = date; // The date is already in YYYY-MM-DD format from the frontend
      }

      // Get total count for pagination
      const total = await prisma.report.count({
        where: filters
      });

      // Fetch reports with pagination
      const reports = await prisma.report.findMany({
        where: filters,
        include: {
          branch: {
            select: {
              name: true,
              code: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Return paginated response
      return NextResponse.json({
        data: reports,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error("Error fetching reports:", error);
      return NextResponse.json(
        { error: "Failed to fetch reports" }, 
        { status: 500 }
      );
    }
  },
  { requiredPermission: Permission.VIEW_REPORTS, allowOwnBranch: true }
);

// POST handler to create reports - requires CREATE_REPORTS permission
export const POST = withPermissionGuard(
  async (req, context, currentUser): Promise<NextResponse<ApiResponse<any>>> => {
    try {
      const data = await req.json();
      
      // Extract report data
      const {
        title,
        date,
        branchId,
        writeOffs,
        ninetyPlus,
        content,
        attachments
      } = data;
      
      // Validate required fields
      if (!title || !date || !branchId) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 }
        );
      }
      
      // Check if user has permission to create reports for this branch
      if (currentUser.role !== "ADMIN" && 
          currentUser.branchId !== branchId && 
          !currentUser.assignedBranchIds?.includes(branchId)) {
        return NextResponse.json(
          { error: "You don't have permission to create reports for this branch" },
          { status: 403 }
        );
      }
      
      // Create report
      const report = await prisma.report.create({
        data: {
          date: new Date(date).toISOString().split('T')[0], // Store as YYYY-MM-DD
          branchId,
          writeOffs: writeOffs || 0,
          ninetyPlus: ninetyPlus || 0,
          reportType: "actual",
          status: "pending",
          submittedBy: currentUser.id,
          submittedAt: new Date().toISOString(),
          comments: content || null
        }
      });
      
      return NextResponse.json({ 
        message: "Report created successfully", 
        report 
      });
    } catch (error) {
      console.error("Error creating report:", error);
      return NextResponse.json(
        { error: "Failed to create report" },
        { status: 500 }
      );
    }
  },
  { requiredPermission: Permission.CREATE_REPORTS, allowOwnBranch: true }
);

// PATCH handler to update reports - requires EDIT_REPORTS permission
export const PATCH = withPermissionGuard(
  async (req, context, currentUser): Promise<NextResponse<ApiResponse<any>>> => {
    try {
      const data = await req.json();
      
      // Extract report data
      const {
        id,
        title,
        date,
        writeOffs,
        ninetyPlus,
        content,
        attachments
      } = data;
      
      // Validate required fields
      if (!id) {
        return NextResponse.json(
          { error: "Report ID is required" },
          { status: 400 }
        );
      }
      
      // Get existing report to check permissions
      const existingReport = await prisma.report.findUnique({
        where: { id }
      });
      
      if (!existingReport) {
        return NextResponse.json(
          { error: "Report not found" },
          { status: 404 }
        );
      }
      
      // Check if user has permission to edit reports for this branch
      if (currentUser.role !== "ADMIN" && 
          currentUser.branchId !== existingReport.branchId && 
          !currentUser.assignedBranchIds?.includes(existingReport.branchId)) {
        return NextResponse.json(
          { error: "You don't have permission to edit reports for this branch" },
          { status: 403 }
        );
      }
      
      // Update report
      const updatedReport = await prisma.report.update({
        where: { id },
        data: {
          date: date ? new Date(date).toISOString().split('T')[0] : undefined,
          writeOffs: writeOffs !== undefined ? writeOffs : undefined,
          ninetyPlus: ninetyPlus !== undefined ? ninetyPlus : undefined,
          comments: content || undefined,
          updatedAt: new Date()
        }
      });
      
      return NextResponse.json({ 
        message: "Report updated successfully", 
        report: updatedReport 
      });
    } catch (error) {
      console.error("Error updating report:", error);
      return NextResponse.json(
        { error: "Failed to update report" },
        { status: 500 }
      );
    }
  },
  { requiredPermission: Permission.EDIT_REPORTS, allowOwnBranch: true }
);
