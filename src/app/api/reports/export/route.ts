import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { Permission, UserRole, checkPermission } from "@/lib/auth/roles";
import { getAccessibleBranches } from "@/lib/auth/branch-access";
import { format } from "date-fns";
import { Parser } from "@json2csv/plainjs";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { formatKHRCurrency, formatKHRCurrencyForPDF } from "@/lib/utils";

const BATCH_SIZE = 500; // Process reports in batches for memory efficiency

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request });

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    // Check if user has permission to export reports
    const userRole = token.role as UserRole;
    if (!checkPermission(userRole, Permission.EXPORT_REPORTS)) {
      return NextResponse.json(
        { error: "Forbidden - You don't have permission to export reports" },
        { status: 403 },
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get("format") || "csv"; // Default to CSV
    const limit = parseInt(searchParams.get("limit") || "1000");
    const branchId = searchParams.get("branchId");
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const reportType = searchParams.get("reportType");
    const submittedBy = searchParams.get("submittedBy");
    const date = searchParams.get("date");

    // Get accessible branches for the user
    const accessibleBranches = await getAccessibleBranches(token.sub as string);
    const accessibleBranchIds = accessibleBranches.map((branch) => branch.id);

    // Build where clause
    const where: Record<string, unknown> = {
      branchId: {
        in: accessibleBranchIds,
      },
    };

    if (branchId) {
      // If specific branch is requested, verify access
      if (!accessibleBranchIds.includes(branchId)) {
        return NextResponse.json(
          { error: "You don't have access to this branch" },
          { status: 403 },
        );
      }
      where.branchId = branchId;
    }

    if (status) {
      where.status = status;
    }

    if (submittedBy) {
      where.submittedBy = submittedBy;
    }

    if (date) {
      where.date = new Date(date);
    } else if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    }

    if (reportType) {
      where.reportType = reportType;
    }

    // Implement keyset pagination for memory-efficient processing of large datasets
    const reports: Record<string, unknown>[] = [];
    let lastId: string | null = null;
    let hasMore = true;

    // Keep track of processed report IDs to prevent duplicates
    const processedIds = new Set<string>();

    // Use keyset pagination with batching for efficient memory usage
    while (hasMore && reports.length < limit) {
      const keysetWhere = { ...where };

      if (lastId) {
        keysetWhere.id = { gt: lastId };
      }

      const batchSize = Math.min(BATCH_SIZE, limit - reports.length);

      const batch = await prisma.report.findMany({
        where: keysetWhere,
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          planReport: {
            select: {
              id: true,
              writeOffs: true,
              ninetyPlus: true,
            },
          },
        },
        orderBy: [
          { date: "desc" },
          { id: "asc" }, // Secondary sort to ensure consistent ordering for pagination
        ],
        take: batchSize,
      });

      if (batch.length === 0) {
        hasMore = false;
      } else {
        // Filter out any duplicate reports before processing
        const uniqueBatch = batch.filter(
          (report) => !processedIds.has(report.id),
        );

        // Add the IDs to the processed set
        uniqueBatch.forEach((report) => processedIds.add(report.id));

        // Transform the batch (convert Decimal to number, add user info, etc.)
        const transformedBatch = await transformReportsBatch(uniqueBatch);
        reports.push(...transformedBatch);

        // Update the cursor for the next batch
        lastId = batch[batch.length - 1].id;
      }
    }

    // We'll calculate totals after removing duplicates

    // Ensure we have a unique set of reports by ID
    const uniqueReportsMap = new Map();
    reports.forEach((report) => {
      uniqueReportsMap.set(report.id, report);
    });

    // Get unique reports and sort them by date (newest first)
    const uniqueReports = Array.from(uniqueReportsMap.values()).sort(
      (a, b) =>
        new Date(b.originalDate).getTime() - new Date(a.originalDate).getTime(),
    );

    // Recalculate totals based on unique reports
    const uniqueTotals = uniqueReports.reduce(
      (acc, report) => {
        acc.totalWriteOffs += report.writeOffs || 0;
        acc.totalNinetyPlus += report.ninetyPlus || 0;
        return acc;
      },
      { totalWriteOffs: 0, totalNinetyPlus: 0 },
    );

    // Log if we found and removed duplicates
    if (reports.length !== uniqueReports.length) {
      console.log(
        `Removed ${reports.length - uniqueReports.length} duplicate reports before export`,
      );
    }

    // Format the data based on the requested format
    if (format === "csv") {
      return generateCSV(uniqueReports, uniqueTotals);
    } else if (format === "pdf") {
      return generatePDF(uniqueReports, uniqueTotals);
    } else {
      return NextResponse.json(
        { error: "Unsupported format. Use 'csv' or 'pdf'." },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Error exporting reports:", error);
    return NextResponse.json(
      { error: "Failed to export reports" },
      { status: 500 },
    );
  }
}

async function transformReportsBatch(batch: Record<string, unknown>[]) {
  // Get all unique user IDs from the batch
  const userIds = [...new Set(batch.map((report) => report.submittedBy))];

  // Fetch user data in a single query
  const users = await prisma.user.findMany({
    where: {
      id: {
        in: userIds,
      },
    },
    select: {
      id: true,
      name: true,
      username: true,
    },
  });

  // Create a map for quick user lookup
  const userMap = new Map(users.map((user) => [user.id, user]));

  // Transform each report
  return batch.map((report) => {
    const user = userMap.get(report.submittedBy);

    return {
      id: report.id,
      date: format(report.date, "dd/MMM/yyyy"),
      branch: report.branch?.name || "Unknown",
      branchCode: report.branch?.code || "Unknown",
      reportType: report.reportType,
      writeOffs: Number(report.writeOffs),
      ninetyPlus: Number(report.ninetyPlus),
      status: report.status,
      submittedBy: user?.name || "Unknown",
      submittedByUsername: user?.username || "Unknown",
      submittedAt: report.submittedAt
        ? format(report.submittedAt, "dd/MMM/yyyy HH:mm")
        : null,
      comments: report.comments || "",
      createdAt: format(report.createdAt, "dd/MMM/yyyy HH:mm"),
      writeOffsPlan: report.planReport
        ? Number(report.planReport.writeOffs)
        : null,
      ninetyPlusPlan: report.planReport
        ? Number(report.planReport.ninetyPlus)
        : null,
      // Store original date for sorting
      originalDate: report.date,
    };
  });
}

function generateCSV(
  reports: Record<string, unknown>[],
  totals: { totalWriteOffs: number; totalNinetyPlus: number },
) {
  try {
    // Configure CSV parser options
    const opts = {
      fields: [
        { label: "Date", value: "date" },
        { label: "Branch", value: "branch" },
        { label: "Branch Code", value: "branchCode" },
        { label: "Report Type", value: "reportType" },
        { label: "Write-offs", value: "writeOffs" },
        { label: "Write-offs Plan", value: "writeOffsPlan" },
        { label: "90+ Days", value: "ninetyPlus" },
        { label: "90+ Days Plan", value: "ninetyPlusPlan" },
        { label: "Status", value: "status" },
        { label: "Submitted By", value: "submittedBy" },
        { label: "Submitted At", value: "submittedAt" },
        { label: "Comments", value: "comments" },
        { label: "Created At", value: "createdAt" },
      ],
    };

    // Create parser instance
    const parser = new Parser(opts);
    let csv = parser.parse(reports);

    // Add totals at the end of the CSV
    csv += `\n\nSummary,,,,,,,,,,,,,\n`;
    csv += `Total Write-offs,${formatKHRCurrency(totals.totalWriteOffs)},,,,,,,,,,,\n`;
    csv += `Total 90+ Days,${formatKHRCurrency(totals.totalNinetyPlus)},,,,,,,,,,,\n`;
    csv += `Total Reports,${reports.length},,,,,,,,,,,\n`;

    // Return CSV response
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="reports-${format(new Date(), "dd-MMM-yyyy")}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error generating CSV:", error);
    throw error;
  }
}

async function generatePDF(
  reports: Record<string, unknown>[],
  totals: { totalWriteOffs: number; totalNinetyPlus: number },
) {
  try {
    // Log the number of reports being processed
    console.log(`Generating PDF for ${reports.length} reports`);

    // Check for duplicate IDs
    const reportIds = reports.map((r) => r.id);
    const uniqueIds = new Set(reportIds);
    if (reportIds.length !== uniqueIds.size) {
      console.warn(
        `Found ${reportIds.length - uniqueIds.size} duplicate report IDs in PDF generation`,
      );
    }
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();

    // Add a title to the PDF
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Add a page to the PDF document
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const margin = 50;

    // Add title
    page.drawText(`Reports - ${format(new Date(), "dd/MMM/yyyy")}`, {
      x: margin,
      y: height - margin,
      size: 16,
      font: helveticaBold,
    });

    // Define columns and their widths
    const columns = [
      { header: "Date", field: "date", width: 80 },
      { header: "Branch", field: "branch", width: 100 },
      { header: "Type", field: "reportType", width: 50 },
      { header: "Write-offs", field: "writeOffs", width: 80, isNumeric: true },
      { header: "90+ Days", field: "ninetyPlus", width: 80, isNumeric: true },
      { header: "Status", field: "status", width: 80 },
      { header: "By", field: "submittedBy", width: 100 },
    ];

    // Draw table header
    let x = margin;
    let y = height - margin - 30;

    columns.forEach((column) => {
      page.drawText(column.header, {
        x,
        y,
        size: 10,
        font: helveticaBold,
      });
      x += column.width;
    });

    // Draw a line under the header
    page.drawLine({
      start: { x: margin, y: y - 5 },
      end: { x: width - margin, y: y - 5 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });

    // Draw table rows
    y -= 20;
    const rowHeight = 20;

    // Process a maximum of 50 reports per page to avoid oversized PDFs
    const maxReportsPerPage = 35;
    const totalPages = Math.ceil(reports.length / maxReportsPerPage);

    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      // If this is not the first page, create a new page and reset y position
      if (pageIndex > 0) {
        const newPage = pdfDoc.addPage();
        y = height - margin - 50;

        // Draw page header
        newPage.drawText(
          `Reports - ${format(new Date(), "dd/MMM/yyyy")} - Page ${pageIndex + 1}`,
          {
            x: margin,
            y: height - margin,
            size: 14,
            font: helveticaBold,
          },
        );

        // Draw column headers
        x = margin;
        columns.forEach((column) => {
          newPage.drawText(column.header, {
            x,
            y,
            size: 10,
            font: helveticaBold,
          });
          x += column.width;
        });

        // Draw a line under the header
        newPage.drawLine({
          start: { x: margin, y: y - 5 },
          end: { x: width - margin, y: y - 5 },
          thickness: 1,
          color: rgb(0, 0, 0),
        });

        y -= 20;
      }

      const startIndex = pageIndex * maxReportsPerPage;
      const endIndex = Math.min(startIndex + maxReportsPerPage, reports.length);
      const pageReports = reports.slice(startIndex, endIndex);

      const currentPage = pageIndex > 0 ? pdfDoc.getPages()[pageIndex] : page;

      // Draw table rows
      pageReports.forEach((report) => {
        x = margin;

        columns.forEach((column) => {
          let value = report[column.field];

          // Format numeric values
          if (column.isNumeric && typeof value === "number") {
            value = formatKHRCurrencyForPDF(value);
          }

          // Capitalize report type
          if (column.field === "reportType") {
            value = value.charAt(0).toUpperCase() + value.slice(1);
          }

          // Format status
          if (column.field === "status") {
            value =
              value.replace("_", " ").charAt(0).toUpperCase() +
              value.replace("_", " ").slice(1);
          }

          // Truncate long text to fit in column
          const maxChars = Math.floor(column.width / 5);
          if (value && value.length > maxChars) {
            value = value.substring(0, maxChars - 3) + "...";
          }

          if (value !== null && value !== undefined) {
            currentPage.drawText(String(value), {
              x,
              y,
              size: 8,
              font: helveticaFont,
              maxWidth: column.width - 5,
            });
          }

          x += column.width;
        });

        y -= rowHeight;

        // Draw a thin line to separate rows
        currentPage.drawLine({
          start: { x: margin, y: y + rowHeight - 5 },
          end: { x: width - margin, y: y + rowHeight - 5 },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        });
      });
    }

    // Add a summary page with totals
    const summaryPage = pdfDoc.addPage();
    const summaryPageSize = summaryPage.getSize();

    // Add title for summary
    summaryPage.drawText("Summary Report", {
      x: margin,
      y: summaryPageSize.height - margin,
      size: 16,
      font: helveticaBold,
    });

    // Add date range
    summaryPage.drawText(`Generated on: ${format(new Date(), "dd/MMM/yyyy")}`, {
      x: margin,
      y: summaryPageSize.height - margin - 30,
      size: 10,
      font: helveticaFont,
    });

    // Add total reports count
    summaryPage.drawText(`Total Reports: ${reports.length}`, {
      x: margin,
      y: summaryPageSize.height - margin - 60,
      size: 12,
      font: helveticaBold,
    });

    // Add total write-offs
    summaryPage.drawText("Total Write-offs:", {
      x: margin,
      y: summaryPageSize.height - margin - 90,
      size: 12,
      font: helveticaBold,
    });

    summaryPage.drawText(formatKHRCurrencyForPDF(totals.totalWriteOffs), {
      x: margin + 150,
      y: summaryPageSize.height - margin - 90,
      size: 12,
      font: helveticaFont,
    });

    // Add total 90+ days
    summaryPage.drawText("Total 90+ Days:", {
      x: margin,
      y: summaryPageSize.height - margin - 120,
      size: 12,
      font: helveticaBold,
    });

    summaryPage.drawText(formatKHRCurrencyForPDF(totals.totalNinetyPlus), {
      x: margin + 150,
      y: summaryPageSize.height - margin - 120,
      size: 12,
      font: helveticaFont,
    });

    // Serialize the PDF to bytes
    const pdfBytes = await pdfDoc.save();

    // Return PDF response
    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="reports-${format(new Date(), "dd-MMM-yyyy")}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
}
