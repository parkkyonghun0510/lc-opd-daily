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

      // Filter by report type if specified in the query
      const reportType = searchParams.get("reportType");
      if (reportType && (reportType === "plan" || reportType === "actual")) {
        filters.reportType = reportType;
        console.log(`Filtering by reportType: ${reportType}`);
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

      // For actual reports, fetch the corresponding plan data for the same day and branch
      const reportsWithPlanData = await Promise.all(
        reports.map(async (report) => {
          // Clone the report as a new object that we'll extend
          const reportWithExtras = { ...report } as any;

          // Only process this for actual reports
          if (report.reportType === "actual") {
            // Format the date consistently
            const formattedDate = new Date(report.date).toISOString().split('T')[0];
            console.log(`Processing actual report for date ${formattedDate}, branch ${report.branchId}`);
            
            // Find the corresponding plan report for the same date and branch
            const planReport = await prisma.report.findFirst({
              where: {
                date: formattedDate,
                branchId: report.branchId,
                reportType: "plan"
              }
            });

            console.log(`Plan report found: ${!!planReport}`);
            console.log(`Looking for plan with date=${formattedDate}, branchId=${report.branchId}`);
            
            if (planReport) {
              console.log(`Found plan report with ID: ${planReport.id}`);
              // Add plan data properties - ensure they're properly converted to numbers
              reportWithExtras.writeOffsPlan = typeof planReport.writeOffs === 'number' ? planReport.writeOffs : 0;
              reportWithExtras.ninetyPlusPlan = typeof planReport.ninetyPlus === 'number' ? planReport.ninetyPlus : 0;
            } else {
              // No plan report found, set plan values to null
              reportWithExtras.writeOffsPlan = null;
              reportWithExtras.ninetyPlusPlan = null;
              console.warn(`No plan report found for date=${formattedDate}, branchId=${report.branchId}`);
            }
          }
          
          return reportWithExtras;
        })
      );

      // Log the final data being sent to client
      console.log("Reports with plan data:", JSON.stringify(reportsWithPlanData.map(r => ({
        id: r.id,
        date: r.date, 
        reportType: r.reportType,
        writeOffs: r.writeOffs,
        ninetyPlus: r.ninetyPlus,
        writeOffsPlan: r.writeOffsPlan,
        ninetyPlusPlan: r.ninetyPlusPlan
      }))));

      // Return paginated response
      return NextResponse.json({
        data: reportsWithPlanData,
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
        attachments,
        reportType
      } = data;
      
      // Validate required fields
      const missingFields = [];
      if (!date) missingFields.push("date");
      if (!branchId) missingFields.push("branchId");
      if (!reportType) missingFields.push("reportType");
      
      if (missingFields.length > 0) {
        return NextResponse.json(
          { 
            error: "Missing required fields",
            details: `The following fields are required: ${missingFields.join(", ")}`
          },
          { status: 400 }
        );
      }

      // Validate data types
      if (typeof writeOffs !== "number") {
        return NextResponse.json(
          { error: "Invalid write-offs value", details: "Write-offs must be a number" },
          { status: 400 }
        );
      }

      if (typeof ninetyPlus !== "number") {
        return NextResponse.json(
          { error: "Invalid 90+ days value", details: "90+ days must be a number" },
          { status: 400 }
        );
      }

      // Validate report type
      if (!["plan", "actual"].includes(reportType)) {
        return NextResponse.json(
          { error: "Invalid report type", details: "Report type must be either 'plan' or 'actual'" },
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

      // Format date consistently
      const formattedDate = new Date(date).toISOString().split('T')[0]; // Store as YYYY-MM-DD
      
      // Check for duplicate reports
      const existingReport = await prisma.report.findFirst({
        where: {
          date: formattedDate,
          branchId,
          reportType
        }
      });

      if (existingReport) {
        return NextResponse.json(
          { error: "A report of this type already exists for this date and branch" },
          { status: 400 }
        );
      }

      // For actual reports, find and validate corresponding plan report
      if (reportType === "actual") {
        const planReport = await prisma.report.findFirst({
          where: {
            date: formattedDate,
            branchId,
            reportType: "plan"
          }
        });

        if (!planReport) {
          return NextResponse.json(
            { error: "Cannot create actual report without a corresponding plan report for the same date and branch" },
            { status: 400 }
          );
        }

        console.log(`Found matching plan report: ${planReport.id} for actual report creation`);
      }
      
      // Create report
      const report = await prisma.report.create({
        data: {
          date: formattedDate,
          branchId,
          writeOffs: writeOffs || 0,
          ninetyPlus: ninetyPlus || 0,
          reportType,
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
