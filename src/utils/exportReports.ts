import { saveAs } from "file-saver";
import * as XLSX from "xlsx";

interface Report {
  date: string;
  branch: {
    name: string;
    code: string;
  };
  writeOffs: number;
  ninetyPlus: number;
  status: string;
  reportType: string;
  user?: {
    name: string;
  };
  submittedAt: string;
  riskScore?: number;
}

interface TrendAnalysis {
  writeOffs: {
    average: number;
    trend: number;
    direction: "up" | "down" | "stable";
  };
  ninetyPlus: {
    average: number;
    trend: number;
    direction: "up" | "down" | "stable";
  };
  branchPerformance: Array<{
    branchId: string;
    averageWriteOffs: number;
    averageNinetyPlus: number;
    reportCount: number;
  }>;
}

interface ExportOptions {
  format: "csv" | "xlsx";
  includeAnalytics?: boolean;
  onProgress?: (progress: number) => void;
}

interface ExportResult {
  success: boolean;
  fileName: string;
  error?: string;
}

export async function exportReports(
  reports: Report[],
  trends: TrendAnalysis | null,
  options: ExportOptions,
): Promise<ExportResult> {
  const { format, includeAnalytics = true, onProgress } = options;

  try {
    // Validate input
    if (!reports || !Array.isArray(reports) || reports.length === 0) {
      throw new Error("No reports data provided for export");
    }

    onProgress?.(10);

    // Prepare reports data with proper type checking
    const reportsData = reports.map((report, index) => {
      // Progress update for data preparation
      if (index % Math.ceil(reports.length / 10) === 0) {
        onProgress?.(10 + Math.floor((index / reports.length) * 40));
      }

      return {
        Date: report.date,
        Branch: report.branch?.name || "Unknown",
        "Branch Code": report.branch?.code || "N/A",
        "Write-offs":
          typeof report.writeOffs === "number"
            ? report.writeOffs.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })
            : "N/A",
        "90+ Days":
          typeof report.ninetyPlus === "number"
            ? report.ninetyPlus.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })
            : "N/A",
        Status: report.status,
        "Report Type": report.reportType,
        "Submitted By": report.user?.name || "",
        "Submitted At": new Date(report.submittedAt).toLocaleString(),
        "Risk Score": report.riskScore?.toFixed(2) || "N/A",
      };
    });

    onProgress?.(50);

    // Prepare analytics data if requested
    const analyticsData =
      includeAnalytics && trends
        ? [
            ["Analytics Summary"],
            ["Write-offs Analysis"],
            ["Average Write-offs", formatCurrency(trends.writeOffs.average)],
            ["Trend", trends.writeOffs.direction],
            ["Change", formatCurrency(trends.writeOffs.trend)],
            [],
            ["90+ Days Analysis"],
            ["Average 90+ Days", formatCurrency(trends.ninetyPlus.average)],
            ["Trend", trends.ninetyPlus.direction],
            ["Change", formatCurrency(trends.ninetyPlus.trend)],
            [],
            ["Branch Performance"],
            [
              "Branch",
              "Average Write-offs",
              "Average 90+ Days",
              "Report Count",
            ],
            ...trends.branchPerformance.map((branch) => [
              branch.branchId,
              formatCurrency(branch.averageWriteOffs),
              formatCurrency(branch.averageNinetyPlus),
              branch.reportCount,
            ]),
          ]
        : [];

    onProgress?.(75);

    const fileName = `reports_export_${new Date().toISOString().split("T")[0]}`;

    if (format === "csv") {
      const csvContent = await generateCSV(reportsData, analyticsData);
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      saveAs(blob, `${fileName}.csv`);
    } else {
      await generateExcel(reportsData, analyticsData, fileName);
    }

    onProgress?.(100);

    return {
      success: true,
      fileName: `${fileName}.${format}`,
    };
  } catch (error) {
    console.error("Export error:", error);
    return {
      success: false,
      fileName: "",
      error: error instanceof Error ? error.message : "Unknown export error",
    };
  }
}

// Helper functions
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

async function generateCSV(
  reportsData: Record<string, string | number>[],
  analyticsData: (string | number)[][],
): Promise<string> {
  const csvRows = [
    Object.keys(reportsData[0]).join(","),
    ...reportsData.map((row) =>
      Object.values(row)
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    ),
  ];

  if (analyticsData.length > 0) {
    csvRows.push("", "", "Analytics Summary");
    csvRows.push(
      ...analyticsData.map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
      ),
    );
  }

  return csvRows.join("\n");
}

async function generateExcel(
  reportsData: Record<string, string | number>[],
  analyticsData: (string | number)[][],
  fileName: string,
): Promise<void> {
  const wb = XLSX.utils.book_new();

  // Add reports sheet with styling
  const ws = XLSX.utils.json_to_sheet(reportsData);

  // Add header styling
  const headerRange = XLSX.utils.decode_range(ws["!ref"] || "A1:Z1");
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[cellRef]) continue;

    ws[cellRef].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: "CCE5FF" } },
    };
  }

  XLSX.utils.book_append_sheet(wb, ws, "Reports");

  // Add analytics sheet if included
  if (analyticsData.length > 0) {
    const analyticsWs = XLSX.utils.aoa_to_sheet(analyticsData);
    XLSX.utils.book_append_sheet(wb, analyticsWs, "Analytics");
  }

  // Generate and save file
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
