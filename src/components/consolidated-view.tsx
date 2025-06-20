"use client";

// React Hooks
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// UI Components
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";

// Icons
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  FileIcon,
  FileSpreadsheetIcon,
  Loader2,
  RefreshCw,
} from "lucide-react";

// Utilities
import { format, parseISO } from "date-fns";
import { cn, formatKHRCurrency } from "@/lib/utils";

// Consolidated Components
import {
  // Charts
  BranchPerformanceChart,
  PlanVsActualChart,
  TimeSeriesChart,
  TrendAnalysisChart,

  // Dialogs
  BranchDetailDialog,
  BranchDetailsModal,
  ExportOptionsDialog,

  // Filters
  DateFilter,
  ReportTypeFilter,

  // Metrics
  MetricCards,
  MetricToggles,

  // Skeletons
  ChartSkeleton,
  MetricCardSkeleton,

  // Tables
  BranchStatusTable,

  // Types
  type ConsolidatedData,
  type HistoricalDataPoint,
  type ExportSettings,
} from "@/components/consolidateds";

/**
 * ConsolidatedView Component
 *
 * Displays consolidated reports data across branches with interactive
 * charts, filters, and metrics.
 */
export default function ConsolidatedView() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: new Date(),
    to: new Date(),
  });
  const [filterType, setFilterType] = useState<"single" | "range">("single");
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const [reportType, setReportType] = useState<"plan" | "actual">("actual");
  const [isLoading, setIsLoading] = useState(false);
  const [consolidatedData, setConsolidatedData] =
    useState<ConsolidatedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planData, setPlanData] = useState<ConsolidatedData | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({
    branchPerformance: false,
    timeSeries: false,
    trendAnalysis: false,
  });
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [visibleMetrics, setVisibleMetrics] = useState({
    writeOffs: true,
    ninetyPlus: true,
  });
  const [showYearOverYear, setShowYearOverYear] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportType, setExportType] = useState<"csv" | "pdf">("csv");

  // Scroll references for animations
  const chartRefs = {
    branchPerformance: useRef<HTMLDivElement>(null),
    timeSeries: useRef<HTMLDivElement>(null),
    trendAnalysis: useRef<HTMLDivElement>(null),
  };

  const router = useRouter();

  useEffect(() => {
    // Initialize with current date if not set
    if (!date || isNaN(date.getTime())) {
      setDate(new Date());
    }

    if (!dateRange.from || isNaN(dateRange.from.getTime())) {
      setDateRange((prev) => ({ ...prev, from: new Date() }));
    }

    if (!dateRange.to || isNaN(dateRange.to.getTime())) {
      setDateRange((prev) => ({ ...prev, to: new Date() }));
    }
  }, []);

  useEffect(() => {
    fetchConsolidatedData();

    if (reportType === "actual") {
      fetchPlanDataForComparison();
    } else {
      setPlanData(null);
    }
  }, [date, dateRange, filterType, reportType]);

  // Animation effect when period changes
  useEffect(() => {
    // Reset collapsed sections when period changes
    setCollapsedSections({
      branchPerformance: false,
      timeSeries: false,
      trendAnalysis: false,
    });

    // Add a slight delay to ensure DOM is updated
    const timeout = setTimeout(() => {
      // Scroll to each section with smooth behavior
      if (chartRefs.branchPerformance.current) {
        chartRefs.branchPerformance.current.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [period]);

  const fetchConsolidatedData = async () => {
    // Validate inputs before proceeding
    if (
      (filterType === "single" && !date) ||
      (filterType === "range" && (!dateRange.from || !dateRange.to))
    ) {
      return;
    }

    // Check if date is valid
    if (
      filterType === "single" &&
      (!(date instanceof Date) || isNaN(date.getTime()))
    ) {
      setError("Invalid date selected. Please select a valid date.");
      return;
    }

    // Check if date range is valid
    if (filterType === "range") {
      if (
        !(dateRange.from instanceof Date) ||
        isNaN(dateRange.from.getTime()) ||
        !(dateRange.to instanceof Date) ||
        isNaN(dateRange.to.getTime())
      ) {
        setError("Invalid date range selected. Please select valid dates.");
        return;
      }
    }

    setIsLoading(true);
    setError("");

    try {
      // Build API URL based on filter type
      const url = buildApiUrl();
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Error fetching data: ${response.statusText}`);
      }

      const data = await response.json();

      // Validate historical data to ensure dates are valid
      if (data && data.historicalData) {
        data.historicalData = validateHistoricalData(data.historicalData);
      }

      setConsolidatedData(data);
    } catch (error) {
      console.error("Error fetching consolidated data:", error);
      setError("Failed to load consolidated data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPlanDataForComparison = async () => {
    // Validate inputs before proceeding
    if (
      (filterType === "single" && !date) ||
      (filterType === "range" && (!dateRange.from || !dateRange.to))
    ) {
      return;
    }

    // Validate date inputs
    if (
      (filterType === "single" &&
        (!(date instanceof Date) || isNaN(date.getTime()))) ||
      (filterType === "range" &&
        (!(dateRange.from instanceof Date) ||
          isNaN(dateRange.from.getTime()) ||
          !(dateRange.to instanceof Date) ||
          isNaN(dateRange.to.getTime())))
    ) {
      console.error("Invalid date for plan data comparison");
      return;
    }

    try {
      // Build API URL for plan data
      const url = buildApiUrl("plan");
      const response = await fetch(url);

      if (!response.ok) {
        console.error("Failed to fetch plan data for comparison");
        return;
      }

      const data = await response.json();

      // Validate historical data in plan data
      if (data && data.historicalData) {
        data.historicalData = validateHistoricalData(data.historicalData);
      }

      setPlanData(data);
    } catch (error) {
      console.error("Error fetching plan data for comparison:", error);
    }
  };

  // Helper function to build the API URL based on filter type and report type
  const buildApiUrl = (type = reportType) => {
    if (filterType === "single") {
      const formattedDate = formatDateForApi(date!);
      return `/api/reports/consolidated?date=${formattedDate}&type=${type}`;
    } else {
      const formattedFromDate = formatDateForApi(dateRange.from!);
      const formattedToDate = formatDateForApi(dateRange.to!);
      return `/api/reports/consolidated?fromDate=${formattedFromDate}&toDate=${formattedToDate}&type=${type}`;
    }
  };

  // Helper function to format date for API calls
  const formatDateForApi = (date: Date) => {
    return `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, "0")}-${date.getUTCDate().toString().padStart(2, "0")}`;
  };

  // Helper function to validate historical data
  const validateHistoricalData = (historicalData: HistoricalDataPoint[]) => {
    return historicalData.filter((item) => {
      try {
        if (!item.date || typeof item.date !== "string") return false;
        const parsedDate = parseISO(item.date);
        return !isNaN(parsedDate.getTime());
      } catch (error) {
        console.warn("Filtered out item with invalid date:", item);
        return false;
      }
    });
  };

  const handleGenerateReport = async () => {
    await fetchConsolidatedData();
    toast({
      title: "Report Generated",
      description: `Consolidated report for ${
        date ? format(date, "PPP") : "today"
      } has been generated.`,
    });
  };

  const handleExportCSV = (settings: ExportSettings) => {
    if (!consolidatedData || !consolidatedData.branchData) {
      toast({
        title: "Error",
        description: "No data to export. Please generate a report first.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Filter branches based on settings
      let filteredBranches = [...consolidatedData.branchData];

      // Apply status filter
      if (settings.statusFilter === "reported") {
        filteredBranches = filteredBranches.filter(
          (branch) => branch.hasReports,
        );
      } else if (settings.statusFilter === "missing") {
        filteredBranches = filteredBranches.filter(
          (branch) => !branch.hasReports,
        );
      }

      // Apply branch filter if any
      if (settings.branchFilter.length > 0) {
        filteredBranches = filteredBranches.filter((branch) =>
          settings.branchFilter.includes(branch.branchId),
        );
      }

      // Apply sorting
      filteredBranches.sort((a, b) => {
        const aValue = a[settings.sortBy as keyof typeof a];
        const bValue = b[settings.sortBy as keyof typeof b];

        // Handle special case for boolean values
        if (typeof aValue === "boolean" && typeof bValue === "boolean") {
          return settings.sortDirection === "asc"
            ? aValue === bValue
              ? 0
              : aValue
                ? 1
                : -1
            : aValue === bValue
              ? 0
              : aValue
                ? -1
                : 1;
        }

        // Handle numeric values
        if (typeof aValue === "number" && typeof bValue === "number") {
          return settings.sortDirection === "asc"
            ? aValue - bValue
            : bValue - aValue;
        }

        // Handle string values
        const aStr = String(aValue || "");
        const bStr = String(bValue || "");
        return settings.sortDirection === "asc"
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });

      // Get date range information for header
      const reportStartDate = new Date(consolidatedData.period.start);
      const reportEndDate = new Date(consolidatedData.period.end);
      const startDateStr = format(reportStartDate, "yyyy-MM-dd");
      const endDateStr = format(reportEndDate, "yyyy-MM-dd");

      // Format period type for header
      const periodTypeStr =
        consolidatedData.period.type.charAt(0).toUpperCase() +
        consolidatedData.period.type.slice(1);

      // Create date range string based on period type
      let dateRangeStr = "";
      if (filterType === "single") {
        dateRangeStr = `Date: ${format(date || new Date(), "PPP")}`;
      } else {
        dateRangeStr = `Date Range: ${dateRange.from ? format(dateRange.from, "PPP") : ""} to ${dateRange.to ? format(dateRange.to, "PPP") : ""}`;
      }

      // Create CSV metadata header
      let csvContent = "LC OPD Daily Report System\n";
      csvContent += `Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}\n`;
      csvContent += `${dateRangeStr}\n`;
      csvContent += `Period Type: ${periodTypeStr}\n\n`;

      // Include metrics summary if specified
      if (settings.includeMetrics) {
        csvContent += "SUMMARY METRICS\n";
        csvContent += `Total Write-Offs,${consolidatedData.metrics.totalWriteOffs}\n`;
        csvContent += `Total 90+ Days,${consolidatedData.metrics.totalNinetyPlus}\n`;
        csvContent += `Branches Reported,${consolidatedData.metrics.reportedBranches}/${consolidatedData.metrics.totalBranches}\n`;
        csvContent += `Coverage Percentage,${consolidatedData.metrics.coveragePercentage.toFixed(2)}%\n\n`;
      }

      // Create column headers based on selected fields
      const headers: string[] = [];
      settings.includeFields.forEach((field) => {
        switch (field) {
          case "branchCode":
            headers.push("Branch Code");
            break;
          case "branchName":
            headers.push("Branch Name");
            break;
          case "writeOffs":
            headers.push("Write-Offs (KHR)");
            break;
          case "ninetyPlus":
            headers.push("90+ Days (KHR)");
            break;
          case "hasReports":
            headers.push("Reported");
            break;
          case "reportsCount":
            headers.push("Reports Count");
            break;
        }
      });

      // Add headers row
      csvContent += headers.join(",") + "\n";

      // Add data rows
      filteredBranches.forEach((branch) => {
        const row: string[] = [];

        settings.includeFields.forEach((field) => {
          switch (field) {
            case "branchCode":
              row.push(branch.branchCode);
              break;
            case "branchName":
              row.push(`"${branch.branchName}"`);
              break;
            case "writeOffs":
              row.push(branch.writeOffs.toString());
              break;
            case "ninetyPlus":
              row.push(branch.ninetyPlus.toString());
              break;
            case "hasReports":
              row.push(branch.hasReports ? "Yes" : "No");
              break;
            case "reportsCount":
              row.push(branch.reportsCount.toString());
              break;
          }
        });

        csvContent += row.join(",") + "\n";
      });

      // Add summary row if specified
      if (settings.includeSummary) {
        const summaryRow: string[] = [];

        settings.includeFields.forEach((field) => {
          switch (field) {
            case "branchCode":
              summaryRow.push("TOTAL");
              break;
            case "branchName":
              summaryRow.push("");
              break;
            case "writeOffs":
              summaryRow.push(
                consolidatedData.metrics.totalWriteOffs.toString(),
              );
              break;
            case "ninetyPlus":
              summaryRow.push(
                consolidatedData.metrics.totalNinetyPlus.toString(),
              );
              break;
            case "hasReports":
              summaryRow.push(
                `${consolidatedData.metrics.reportedBranches}/${consolidatedData.metrics.totalBranches}`,
              );
              break;
            case "reportsCount":
              summaryRow.push("");
              break;
          }
        });

        csvContent += "\n" + summaryRow.join(",") + "\n";
      }

      // Create blob and download link
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      // Format the current date for the filename
      const formattedDate = format(reportStartDate, "yyyy-MM-dd");
      const formattedEndDate = format(reportEndDate, "yyyy-MM-dd");

      // Create filename with date range if using range filter
      const filename =
        filterType === "range"
          ? `consolidated_report_${reportType}_${formattedDate}_to_${formattedEndDate}.csv`
          : `consolidated_report_${reportType}_${formattedDate}.csv`;

      // Set link properties and trigger download
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Success",
        description: "CSV exported successfully",
      });
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast({
        title: "Error",
        description: "Failed to export CSV. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleExportPDF = (settings: ExportSettings) => {
    if (!consolidatedData || !consolidatedData.branchData) {
      toast({
        title: "Error",
        description: "No data to export. Please generate a report first.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Filter branches based on settings
      let filteredBranches = [...consolidatedData.branchData];

      // Apply status filter
      if (settings.statusFilter === "reported") {
        filteredBranches = filteredBranches.filter(
          (branch) => branch.hasReports,
        );
      } else if (settings.statusFilter === "missing") {
        filteredBranches = filteredBranches.filter(
          (branch) => !branch.hasReports,
        );
      }

      // Apply branch filter if any
      if (settings.branchFilter.length > 0) {
        filteredBranches = filteredBranches.filter((branch) =>
          settings.branchFilter.includes(branch.branchId),
        );
      }

      // Apply sorting
      filteredBranches.sort((a, b) => {
        const aValue = a[settings.sortBy as keyof typeof a];
        const bValue = b[settings.sortBy as keyof typeof b];

        // Handle special case for boolean values
        if (typeof aValue === "boolean" && typeof bValue === "boolean") {
          return settings.sortDirection === "asc"
            ? aValue === bValue
              ? 0
              : aValue
                ? 1
                : -1
            : aValue === bValue
              ? 0
              : aValue
                ? -1
                : 1;
        }

        // Handle numeric values
        if (typeof aValue === "number" && typeof bValue === "number") {
          return settings.sortDirection === "asc"
            ? aValue - bValue
            : bValue - aValue;
        }

        // Handle string values
        const aStr = String(aValue || "");
        const bStr = String(bValue || "");
        return settings.sortDirection === "asc"
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });

      // Create a new window for the PDF content
      const printWindow = window.open("", "", `height=800,width=800`);
      if (!printWindow) {
        throw new Error("Could not open print window");
      }

      // Format dates
      const reportStartDate = new Date(consolidatedData.period.start);
      const reportEndDate = new Date(consolidatedData.period.end);
      const startDateStr = format(reportStartDate, "PPP");
      const endDateStr = format(reportEndDate, "PPP");

      // Create date range string based on filter type
      let dateRangeStr = "";
      if (filterType === "single") {
        dateRangeStr = `Date: ${format(date || new Date(), "PPP")}`;
      } else {
        dateRangeStr = `Date Range: ${dateRange.from ? format(dateRange.from, "PPP") : ""} to ${dateRange.to ? format(dateRange.to, "PPP") : ""}`;
      }

      // Get logo URL
      const logoUrl = window.location.origin + "/lc-logo.png";

      // Format period type for title
      const periodTypeStr =
        consolidatedData.period.type.charAt(0).toUpperCase() +
        consolidatedData.period.type.slice(1);

      // Create column headers based on selected fields
      const headers: string[] = [];
      settings.includeFields.forEach((field) => {
        switch (field) {
          case "branchCode":
            headers.push("Branch Code");
            break;
          case "branchName":
            headers.push("Branch Name");
            break;
          case "writeOffs":
            headers.push("Write-Offs (KHR)");
            break;
          case "ninetyPlus":
            headers.push("90+ Days (KHR)");
            break;
          case "hasReports":
            headers.push("Reported");
            break;
          case "reportsCount":
            headers.push("Reports Count");
            break;
        }
      });

      // Create the HTML content
      printWindow.document.write(`
        <html>
          <head>
            <title>Consolidated Report ${reportType} - ${startDateStr}</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                margin: 20px; 
                ${settings.orientation === "landscape" ? "width: 1100px;" : "width: 800px;"}
              }
              .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
              .logo { max-height: 60px; }
              .report-title { text-align: right; }
              h1 { color: #333; margin: 0; }
              .report-meta { color: #666; margin-top: 5px; }
              .date-range { font-weight: bold; }
              table { border-collapse: collapse; width: 100%; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              .summary { margin-top: 30px; font-weight: bold; }
              .footer { margin-top: 50px; font-size: 12px; color: #666; }
              .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
              .metric-card { border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
              .metric-title { font-size: 14px; color: #666; margin: 0; }
              .metric-value { font-size: 22px; font-weight: bold; margin: 10px 0 0 0; }
              @media print {
                @page {
                  size: ${settings.orientation};
                }
                body {
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <img src="${logoUrl}" class="logo" alt="Company Logo">
              <div class="report-title">
                <h1>Consolidated ${periodTypeStr} Report</h1>
                <div class="report-meta">
                  <p>Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}</p>
                  <p class="date-range">${dateRangeStr}</p>
                </div>
              </div>
            </div>
            
            ${
              settings.includeMetrics
                ? `
            <div class="metrics">
              <div class="metric-card">
                <p class="metric-title">Total Write-Offs</p>
                <p class="metric-value">${formatKHRCurrency(
                  consolidatedData?.metrics.totalWriteOffs || 0.0,
                )}</p>
              </div>
              <div class="metric-card">
                <p class="metric-title">Total 90+ Days</p>
                <p class="metric-value">${formatKHRCurrency(
                  consolidatedData?.metrics.totalNinetyPlus || 0.0,
                )}</p>
              </div>
              <div class="metric-card">
                <p class="metric-title">Branches Reported</p>
                <p class="metric-value">${
                  consolidatedData?.metrics.reportedBranches || 0.0
                } of ${consolidatedData?.metrics.totalBranches || 0.0}</p>
              </div>
            </div>
            `
                : ""
            }
            
            <table>
              <thead>
                <tr>
                  ${headers.map((header) => `<th>${header}</th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${filteredBranches
                  .map((branch) => {
                    const cells: string[] = [];

                    settings.includeFields.forEach((field) => {
                      switch (field) {
                        case "branchCode":
                          cells.push(`<td>${branch.branchCode}</td>`);
                          break;
                        case "branchName":
                          cells.push(`<td>${branch.branchName}</td>`);
                          break;
                        case "writeOffs":
                          cells.push(
                            `<td>${formatKHRCurrency(branch.writeOffs)}</td>`,
                          );
                          break;
                        case "ninetyPlus":
                          cells.push(
                            `<td>${formatKHRCurrency(branch.ninetyPlus)}</td>`,
                          );
                          break;
                        case "hasReports":
                          cells.push(
                            `<td>${branch.hasReports ? "Yes" : "No"}</td>`,
                          );
                          break;
                        case "reportsCount":
                          cells.push(`<td>${branch.reportsCount}</td>`);
                          break;
                      }
                    });

                    return `<tr>${cells.join("")}</tr>`;
                  })
                  .join("")}
                
                ${
                  settings.includeSummary
                    ? `
                <tr class="summary">
                  ${settings.includeFields
                    .map((field) => {
                      switch (field) {
                        case "branchCode":
                          return `<td>TOTAL</td>`;
                        case "branchName":
                          return `<td></td>`;
                        case "writeOffs":
                          return `<td>${formatKHRCurrency(consolidatedData.metrics.totalWriteOffs)}</td>`;
                        case "ninetyPlus":
                          return `<td>${formatKHRCurrency(consolidatedData.metrics.totalNinetyPlus)}</td>`;
                        case "hasReports":
                          return `<td>${consolidatedData.metrics.reportedBranches}/${consolidatedData.metrics.totalBranches}</td>`;
                        case "reportsCount":
                          return `<td></td>`;
                        default:
                          return `<td></td>`;
                      }
                    })
                    .join("")}
                </tr>
                `
                    : ""
                }
              </tbody>
            </table>
            
            <div class="footer">
              <p>Generated on ${new Date().toLocaleString()}</p>
            </div>
          </body>
        </html>
      `);

      printWindow.document.close();
      printWindow.focus();

      // Delay printing to ensure content is loaded and logo is rendered
      setTimeout(() => {
        printWindow.print();
        toast({
          title: "Success",
          description: "PDF export initiated",
        });
      }, 1000);
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({
        title: "Error",
        description: "Failed to export PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleReportTypeChange = (value: "plan" | "actual") => {
    setReportType(value);
  };

  // Toggle collapsible section
  const toggleSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Add a function for retrying data fetch
  const handleRetry = () => {
    fetchConsolidatedData();
    if (reportType === "actual") {
      fetchPlanDataForComparison();
    }
    toast({
      title: "Retrying...",
      description: "Attempting to fetch the data again",
    });
  };

  // Handle chart bar click for drill-down
  const handleBarClick = (
    data: Record<string, string | number | boolean | undefined>,
  ) => {
    if (!data) return;

    // For branch performance chart
    if (data.branchId) {
      // Ensure branchId is treated as a string for the state setter
      const branchIdString = String(data.branchId);
      setSelectedBranchId(branchIdString);
      setDetailsModalOpen(true);
    }
    // For time series chart
    else if (data.rawDate) {
      // Ensure rawDate is a valid date input for format function
      const rawDate = data.rawDate.toLocaleString();
      if (typeof rawDate === "string" || typeof rawDate === "number") {
        toast({
          title: "Date selected",
          description: `Showing details for ${format(rawDate, "PPP")}`,
        });
      } else {
        console.error("Invalid date format:", rawDate);
      }
    }
  };

  // Toggle visibility of metrics
  const toggleMetricVisibility = (metric: "writeOffs" | "ninetyPlus") => {
    setVisibleMetrics((prev) => ({
      ...prev,
      [metric]: !prev[metric],
    }));
  };

  interface ChartClickData {
    activePayload?: Array<{
      payload: Record<string, string | number | boolean | undefined>;
    }>;
  }

  const handleChartClick = (data: ChartClickData) => {
    if (!data || !data.activePayload || !data.activePayload[0]) return;

    const clickedData = data.activePayload[0].payload;
    handleBarClick(clickedData);
  };

  // Handle closing the branch detail dialog
  const handleCloseDialog = () => {
    setSelectedBranch(null);
  };

  return (
    <Card className="w-full overflow-hidden border shadow-sm">
      <CardHeader className="border-b bg-muted/50 px-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-2xl font-bold">
              Consolidated Reports
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              View aggregated metrics across all branches
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full justify-start md:mt-0 md:w-auto"
            onClick={() => router.push("/dashboard")}
          >
            <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
            Back to Dashboard
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:gap-6">
            {/* Report type and date filters */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:flex md:items-center md:justify-between">
              <div className="w-full md:w-auto">
                <ReportTypeFilter
                  reportType={reportType}
                  onReportTypeChange={handleReportTypeChange}
                />
              </div>
              <div className="w-full md:flex-1 md:max-w-lg">
                <DateFilter
                  filterType={filterType}
                  date={date}
                  dateRange={dateRange}
                  onFilterTypeChange={(type) => setFilterType(type)}
                  onDateChange={setDate}
                  onDateRangeChange={setDateRange}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 sm:flex-nowrap">
              <Button
                onClick={handleGenerateReport}
                disabled={
                  (filterType === "single" && !date) ||
                  (filterType === "range" &&
                    (!dateRange.from || !dateRange.to)) ||
                  isLoading
                }
                className="flex-1 sm:flex-none sm:w-32"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <span>Generate</span>
                )}
              </Button>
              <div className="flex flex-1 gap-2 sm:justify-end">
                <Button
                  onClick={() => {
                    setExportType("csv");
                    setExportDialogOpen(true);
                  }}
                  variant="outline"
                  size="sm"
                  className="flex w-full items-center justify-center sm:w-auto"
                  disabled={!consolidatedData}
                >
                  <FileSpreadsheetIcon className="mr-2 h-4 w-4" />
                  <span className="hidden md:inline">Export CSV</span>
                  <span className="md:hidden">CSV</span>
                </Button>
                <Button
                  onClick={() => {
                    setExportType("pdf");
                    setExportDialogOpen(true);
                  }}
                  variant="outline"
                  size="sm"
                  className="flex w-full items-center justify-center sm:w-auto"
                  disabled={!consolidatedData}
                >
                  <FileIcon className="mr-2 h-4 w-4" />
                  <span className="hidden md:inline">Export PDF</span>
                  <span className="md:hidden">PDF</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Loading state with skeletons */}
          {isLoading && (
            <div className="animate-in fade-in-50 slide-in-from-top-4 duration-300 space-y-6 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
              </div>
              <ChartSkeleton className="mt-8" />
              <ChartSkeleton className="mt-6" />
            </div>
          )}

          {/* Enhanced error state with retry button */}
          {error && !isLoading && (
            <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 text-red-900 shadow-sm dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="flex items-center text-lg font-semibold mb-2">
                    Error Loading Data
                    <span className="ml-2 text-xs font-normal bg-red-100 dark:bg-red-900/50 py-0.5 px-1.5 rounded-full">
                      Data Fetch Failed
                    </span>
                  </h3>
                  <p className="text-sm mb-4">{error}</p>

                  <div className="rounded bg-white dark:bg-gray-800 p-3 border border-red-100 dark:border-red-800/30 mb-4">
                    <h4 className="text-sm font-medium mb-1 flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      Possible causes:
                    </h4>
                    <ul className="text-xs list-disc pl-5 space-y-1">
                      <li>Network connection issue</li>
                      <li>Server is temporarily unavailable</li>
                      <li>You might not have permission to access this data</li>
                      <li>The requested date range contains no data</li>
                    </ul>
                  </div>

                  <div className="flex space-x-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetry}
                      className="bg-white dark:bg-gray-800 border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      Retry
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setError(null)}
                      className="hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Data display - only shown when data is loaded */}
          {consolidatedData && !isLoading && !error && (
            <div className="animate-in fade-in-50 slide-in-from-bottom-4 duration-300">
              {/* Metrics Overview Cards */}
              <div className="mb-8">
                <MetricCards
                  data={consolidatedData}
                  onViewMissingBranches={() => {
                    toast({
                      title: "Missing Branches",
                      description: `${consolidatedData.missingBranches.length} branches have not reported.`,
                    });
                  }}
                />
              </div>

              {/* Charts Section */}
              <div className="space-y-6">
                {/* Branch Performance Chart */}
                <div className="rounded-lg border shadow-sm">
                  {consolidatedData && (
                    <BranchPerformanceChart
                      data={consolidatedData}
                      collapsed={collapsedSections.branchPerformance}
                      onToggleCollapse={() =>
                        toggleSection("branchPerformance")
                      }
                      visibleMetrics={visibleMetrics}
                      showYearOverYear={showYearOverYear}
                      onToggleMetric={toggleMetricVisibility}
                      onToggleYearOverYear={() =>
                        setShowYearOverYear(!showYearOverYear)
                      }
                      onChartClick={handleChartClick}
                    />
                  )}
                </div>

                {/* Time Series Chart */}
                <div className="rounded-lg border shadow-sm">
                  {consolidatedData &&
                    consolidatedData.historicalData &&
                    consolidatedData.historicalData.length > 0 && (
                      <TimeSeriesChart
                        data={consolidatedData}
                        collapsed={collapsedSections.timeSeries}
                        period={period}
                        onToggleCollapse={() => toggleSection("timeSeries")}
                        visibleMetrics={visibleMetrics}
                        showYearOverYear={showYearOverYear}
                        onToggleMetric={toggleMetricVisibility}
                        onToggleYearOverYear={() =>
                          setShowYearOverYear(!showYearOverYear)
                        }
                        onChartClick={handleChartClick}
                      />
                    )}
                </div>

                {/* Trend Analysis Chart */}
                <div className="rounded-lg border shadow-sm">
                  {consolidatedData &&
                    consolidatedData.historicalData &&
                    consolidatedData.historicalData.length > 0 && (
                      <TrendAnalysisChart
                        data={consolidatedData}
                        collapsed={collapsedSections.trendAnalysis}
                        onToggleCollapse={() => toggleSection("trendAnalysis")}
                      />
                    )}
                </div>

                {/* Plan vs Actual Comparison */}
                {reportType === "actual" && planData && consolidatedData && (
                  <div className="rounded-lg border shadow-sm overflow-hidden">
                    <div className="bg-muted/50 p-4">
                      <h3 className="text-lg font-medium">
                        Plan vs. Actual Comparison
                      </h3>
                    </div>
                    <div className="p-4">
                      <PlanVsActualChart
                        consolidatedData={consolidatedData}
                        planData={planData}
                      />
                    </div>
                  </div>
                )}

                {/* Branch Status Table */}
                <div className="rounded-lg border shadow-sm overflow-hidden">
                  {consolidatedData && (
                    <div className="space-y-4">
                      <div className="bg-muted/50 p-4">
                        <h3 className="text-lg font-medium">Branch Status</h3>
                      </div>
                      <div className="p-4">
                        <BranchStatusTable
                          consolidatedData={consolidatedData}
                          planData={planData}
                          reportType={reportType}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      {/* Modal components */}
      <BranchDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        branchId={selectedBranchId}
        consolidatedData={consolidatedData}
        planData={planData}
        reportType={reportType}
      />

      {selectedBranch && (
        <BranchDetailDialog
          selectedBranch={selectedBranch}
          selectedBranchData={consolidatedData?.branchData.find(
            (item) =>
              item.branchCode === selectedBranch ||
              item.branchName === selectedBranch,
          )}
          onClose={handleCloseDialog}
        />
      )}

      <ExportOptionsDialog
        isOpen={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        onExport={(settings) =>
          exportType === "csv"
            ? handleExportCSV(settings)
            : handleExportPDF(settings)
        }
        exportType={exportType}
        consolidatedData={consolidatedData}
      />
    </Card>
  );
}
