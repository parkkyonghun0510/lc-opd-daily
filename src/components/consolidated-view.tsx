"use client";
import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "@radix-ui/react-icons";
import { format, parseISO } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn, formatKHRCurrency } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  FileIcon,
  FileSpreadsheetIcon,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  EyeOff,
  ArrowRight,
  BarChart2,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  LineChart,
  Line,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";

// Define proper types for our data
interface Branch {
  branchId: string;
  branchCode: string;
  branchName: string;
  writeOffs: number;
  ninetyPlus: number;
  reportsCount: number;
  hasReports: boolean;
}

interface HistoricalDataPoint {
  date: string;
  writeOffs: number;
  ninetyPlus: number;
  count: number;
}

interface ConsolidatedData {
  period: {
    start: string;
    end: string;
    type: "day" | "week" | "month";
  };
  metrics: {
    totalWriteOffs: number;
    totalNinetyPlus: number;
    reportedBranches: number;
    totalBranches: number;
    coveragePercentage: number;
  };
  missingBranches: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  branchData: Branch[];
  historicalData: HistoricalDataPoint[];
}

// Custom tooltip interfaces
interface TooltipPayloadData {
  name: string;
  branchName?: string;
  branchCode?: string;
  writeOffs?: number;
  ninetyPlus?: number;
  date?: string;
  count?: number;
  writeOffsPercentage?: number;
  ninetyPlusPercentage?: number;
  hasReports?: boolean;
  writeOffsChange?: number;
  ninetyPlusChange?: number;
}

interface TooltipPayloadItem {
  payload: TooltipPayloadData;
  name: string;
  value: number;
  dataKey: string;
  color: string;
}

// Create a custom tooltip component for branch performance chart
const CustomBranchTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<TooltipPayloadItem>;
}) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
      <div className="flex items-center space-x-2 mb-2">
        <div className="w-3 h-3 rounded-full bg-blue-500" />
        <span className="font-medium">
          {data.name} - {data.branchName}
        </span>
      </div>
      <div className="border-t border-gray-200 dark:border-gray-700 my-2" />

      {payload.map((entry: TooltipPayloadItem, index: number) => (
        <div key={`item-${index}`} className="py-1">
          <div className="flex justify-between items-center">
            <span className="flex items-center text-sm">
              <div
                className="w-2 h-2 rounded-full mr-1"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}:
            </span>
            <span className="font-medium text-sm">
              {formatKHRCurrency(entry.value)}
            </span>
          </div>

          {entry.dataKey === "writeOffs" && (
            <div className="text-xs text-gray-500 flex justify-between mt-1">
              <span>% of Total:</span>
              <Badge variant="outline" className="h-5 px-1 font-normal">
                {data.writeOffsPercentage}%
              </Badge>
            </div>
          )}

          {entry.dataKey === "ninetyPlus" && (
            <div className="text-xs text-gray-500 flex justify-between mt-1">
              <span>% of Total:</span>
              <Badge variant="outline" className="h-5 px-1 font-normal">
                {data.ninetyPlusPercentage}%
              </Badge>
            </div>
          )}
        </div>
      ))}

      <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
      <div className="flex justify-between text-xs text-gray-500">
        <span>Status:</span>
        <span>{data.hasReports ? "Reported" : "Missing"}</span>
      </div>
      <div className="text-xs text-blue-600 dark:text-blue-400 mt-2 flex justify-center items-center cursor-pointer">
        <ArrowRight className="h-3 w-3 mr-1" /> Click for details
      </div>
    </div>
  );
};

// Create a custom tooltip component for time series chart
const CustomTimeTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<TooltipPayloadItem>;
}) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
      <div className="flex items-center space-x-2 mb-2">
        <div className="w-3 h-3 rounded-full bg-blue-500" />
        <span className="font-medium">{data.date}</span>
      </div>
      <div className="border-t border-gray-200 dark:border-gray-700 my-2" />

      {payload.map((entry: TooltipPayloadItem, index: number) => (
        <div key={`item-${index}`} className="py-1">
          <div className="flex justify-between items-center">
            <span className="flex items-center text-sm">
              <div
                className="w-2 h-2 rounded-full mr-1"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}:
            </span>
            <span
              className={cn(
                "flex items-center",
                (data.writeOffsChange || 0) > 0
                  ? "text-red-600 dark:text-red-400"
                  : (data.writeOffsChange || 0) < 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-500"
              )}
            >
              {(data.writeOffsChange || 0) > 0 && (
                <TrendingUp className="h-3 w-3 mr-1" />
              )}
              {(data.writeOffsChange || 0) < 0 && (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {(data.writeOffsChange || 0) === 0 && (
                <Minus className="h-3 w-3 mr-1" />
              )}
              {(data.writeOffsChange || 0) > 0 ? "+" : ""}
              {data.writeOffsChange || 0}%
            </span>
          </div>

          {entry.dataKey === "ninetyPlus" && data.ninetyPlusChange && (
            <div className="text-xs flex justify-between mt-1">
              <span>Change:</span>
              <span
                className={cn(
                  "flex items-center",
                  (data.ninetyPlusChange || 0) > 0
                    ? "text-red-600 dark:text-red-400"
                    : (data.ninetyPlusChange || 0) < 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-gray-500"
                )}
              >
                {(data.ninetyPlusChange || 0) > 0 && (
                  <TrendingUp className="h-3 w-3 mr-1" />
                )}
                {(data.ninetyPlusChange || 0) < 0 && (
                  <TrendingDown className="h-3 w-3 mr-1" />
                )}
                {(data.ninetyPlusChange || 0) === 0 && (
                  <Minus className="h-3 w-3 mr-1" />
                )}
                {(data.ninetyPlusChange || 0) > 0 ? "+" : ""}
                {data.ninetyPlusChange || 0}%
              </span>
            </div>
          )}
        </div>
      ))}

      <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
      <div className="flex justify-between text-xs text-gray-500">
        <span>Reports:</span>
        <span>{data.count} submitted</span>
      </div>
      <div className="text-xs text-blue-600 dark:text-blue-400 mt-2 flex justify-center items-center cursor-pointer">
        <ArrowRight className="h-3 w-3 mr-1" /> View trend details
      </div>
    </div>
  );
};

// After the custom tooltips but before the main component
// Create a skeleton loader component for charts
function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse space-y-3", className)}>
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
      <div className="h-[300px] bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 flex items-center justify-center">
        <BarChart2 className="h-16 w-16 text-gray-300 dark:text-gray-600" />
      </div>
    </div>
  );
}

// Create a component for the metrics card skeleton
function MetricCardSkeleton() {
  return (
    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 overflow-hidden">
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
          <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded mt-2 w-full"></div>
        </div>
      </CardContent>
    </Card>
  );
}

// Add a simple interface for the branch dialog props
interface BranchDetailDialogProps {
  selectedBranch: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectedBranchData: any;
  onClose: () => void;
}

// Add this dialog component for branch details
const BranchDetailDialog = ({
  selectedBranch,
  selectedBranchData,
  onClose,
}: BranchDetailDialogProps) => {
  const mockReports = [
    { date: "2023-05-01", amount: 12500000, status: "Approved" },
    { date: "2023-05-10", amount: 8750000, status: "Pending" },
    { date: "2023-05-15", amount: 15000000, status: "Rejected" },
    { date: "2023-05-22", amount: 9800000, status: "Approved" },
  ];

  return (
    <Dialog open={!!selectedBranch} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] dark:bg-gray-800 dark:border-gray-700 w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl dark:text-gray-100">
            {selectedBranch} Details
          </DialogTitle>
          <DialogDescription className="dark:text-gray-400">
            Detailed metrics and reports for this branch.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="dark:bg-gray-900 dark:border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium dark:text-gray-200">
                  Write-offs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold dark:text-gray-100">
                  {formatKHRCurrency(selectedBranchData?.writeOffs || 0)}
                </div>
                <div className="text-xs text-muted-foreground dark:text-gray-400 flex items-center mt-1">
                  {(selectedBranchData?.writeOffsTrend || 0) > 0 ? (
                    <TrendingUp className="text-red-500 h-4 w-4 mr-1" />
                  ) : (selectedBranchData?.writeOffsTrend || 0) < 0 ? (
                    <TrendingDown className="text-green-500 h-4 w-4 mr-1" />
                  ) : (
                    <Minus className="text-yellow-500 h-4 w-4 mr-1" />
                  )}
                  <span
                    className={cn(
                      (selectedBranchData?.writeOffsTrend || 0) > 0
                        ? "text-red-500"
                        : (selectedBranchData?.writeOffsTrend || 0) < 0
                          ? "text-green-500"
                          : "text-yellow-500"
                    )}
                  >
                    {(selectedBranchData?.writeOffsTrend || 0) !== 0
                      ? `${Math.abs(selectedBranchData?.writeOffsTrend || 0)}% ${
                          (selectedBranchData?.writeOffsTrend || 0) > 0
                            ? "increase"
                            : "decrease"
                        }`
                      : "No change"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="dark:bg-gray-900 dark:border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium dark:text-gray-200">
                  90+ Days Outstanding
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold dark:text-gray-100">
                  {formatKHRCurrency(selectedBranchData?.ninetyPlus || 0)}
                </div>
                <div className="text-xs text-muted-foreground dark:text-gray-400 flex items-center mt-1">
                  {(selectedBranchData?.ninetyPlusTrend || 0) > 0 ? (
                    <TrendingUp className="text-red-500 h-4 w-4 mr-1" />
                  ) : (selectedBranchData?.ninetyPlusTrend || 0) < 0 ? (
                    <TrendingDown className="text-green-500 h-4 w-4 mr-1" />
                  ) : (
                    <Minus className="text-yellow-500 h-4 w-4 mr-1" />
                  )}
                  <span
                    className={cn(
                      (selectedBranchData?.ninetyPlusTrend || 0) > 0
                        ? "text-red-500"
                        : (selectedBranchData?.ninetyPlusTrend || 0) < 0
                          ? "text-green-500"
                          : "text-yellow-500"
                    )}
                  >
                    {(selectedBranchData?.ninetyPlusTrend || 0) !== 0
                      ? `${Math.abs(selectedBranchData?.ninetyPlusTrend || 0)}% ${
                          (selectedBranchData?.ninetyPlusTrend || 0) > 0
                            ? "increase"
                            : "decrease"
                        }`
                      : "No change"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="overflow-x-auto">
            <Table className="border dark:border-gray-700 rounded-md">
              <TableHeader className="bg-muted/50 dark:bg-gray-900">
                <TableRow>
                  <TableHead className="font-semibold dark:text-gray-300 w-[100px]">
                    Date
                  </TableHead>
                  <TableHead className="font-semibold dark:text-gray-300 w-[140px] text-right">
                    Amount
                  </TableHead>
                  <TableHead className="font-semibold dark:text-gray-300 text-right">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockReports.map((report, i) => (
                  <TableRow key={i} className="dark:hover:bg-gray-900/60">
                    <TableCell className="dark:text-gray-300 font-medium">
                      {report.date}
                    </TableCell>
                    <TableCell className="dark:text-gray-300 text-right">
                      {formatKHRCurrency(report.amount)}
                    </TableCell>
                    <TableCell className="dark:text-gray-300 text-right">
                      <Badge
                        variant={
                          report.status === "Approved"
                            ? "success"
                            : report.status === "Pending"
                              ? "secondary"
                              : "default"
                        }
                        className="ml-auto"
                      >
                        {report.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              className="dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              onClick={onClose}
            >
              Close
            </Button>
            <Button
              size="sm"
              className="dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              <FileSpreadsheetIcon className="h-4 w-4 mr-1" />
              Export Data
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function ConsolidatedView() {
  const [date, setDate] = useState<Date | undefined>(new Date());
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
  }, []);

  useEffect(() => {
    fetchConsolidatedData();

    if (reportType === "actual") {
      fetchPlanDataForComparison();
    } else {
      setPlanData(null);
    }
  }, [date, period, reportType]);

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
    if (!date) return;

    // Check if date is valid before proceeding
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      setError("Invalid date selected. Please select a valid date.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const formattedDate = `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, "0")}-${date.getUTCDate().toString().padStart(2, "0")}`;
      const url = `/api/reports/consolidated?date=${formattedDate}&period=${period}&type=${reportType}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Error fetching data: ${response.statusText}`);
      }

      const data = await response.json();

      // Validate historical data to ensure dates are valid
      if (data && data.historicalData) {
        // Filter out any items with invalid dates
        data.historicalData = data.historicalData.filter(
          (item: HistoricalDataPoint) => {
            try {
              if (!item.date || typeof item.date !== "string") return false;
              // Try to parse the date to validate it
              const parsedDate = parseISO(item.date);
              return !isNaN(parsedDate.getTime());
            } catch {
              console.warn("Filtered out item with invalid date:", item);
              return false;
            }
          }
        );
      }

      setConsolidatedData(data);
      setError("");
    } catch {
      console.error("Error fetching consolidated data");
      setError("Failed to load consolidated data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPlanDataForComparison = async () => {
    if (!date) return;

    // Validate date
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      console.error("Invalid date for plan data comparison");
      return;
    }

    try {
      const formattedDate = `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, "0")}-${date.getUTCDate().toString().padStart(2, "0")}`;
      const url = `/api/reports/consolidated?date=${formattedDate}&period=${period}&type=plan`;

      const response = await fetch(url);

      if (!response.ok) {
        console.error("Failed to fetch plan data for comparison");
        return;
      }

      const data = await response.json();

      // Add validation for historicalData in plan data
      if (data && data.historicalData) {
        // Filter out any items with invalid dates
        data.historicalData = data.historicalData.filter(
          (item: HistoricalDataPoint) => {
            try {
              if (!item.date || typeof item.date !== "string") return false;
              // Try to parse the date to validate it
              const parsedDate = parseISO(item.date);
              return !isNaN(parsedDate.getTime());
            } catch {
              console.warn("Filtered out plan item with invalid date:", item);
              return false;
            }
          }
        );
      }

      setPlanData(data);
    } catch (error) {
      console.error("Error fetching plan data for comparison:", error);
    }
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

  const handleExportCSV = () => {
    if (!consolidatedData || !consolidatedData.branchData) {
      toast({
        title: "Error",
        description: "No data to export. Please generate a report first.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create CSV header
      let csvContent = "Branch,Write-Offs (KHR),90+ Days (KHR),Reported\n";

      // Add data rows
      consolidatedData.branchData.forEach((branch) => {
        csvContent += `${branch.branchCode},${branch.writeOffs},${
          branch.ninetyPlus
        },${branch.hasReports ? "Yes" : "No"}\n`;
      });

      // Add summary row
      csvContent += `\nTotal,${consolidatedData.metrics.totalWriteOffs},${consolidatedData.metrics.totalNinetyPlus},${consolidatedData.metrics.reportedBranches}/${consolidatedData.metrics.totalBranches}\n`;

      // Create blob and download link
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      // Format the current date for the filename
      const reportDate = new Date(consolidatedData.period.start);
      const formattedDate = reportDate.toISOString().split("T")[0];

      // Set link properties and trigger download
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `consolidated_report_${period}_${formattedDate}.csv`
      );
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

  const handleExportPDF = () => {
    if (!consolidatedData || !consolidatedData.branchData) {
      toast({
        title: "Error",
        description: "No data to export. Please generate a report first.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create a new window for the PDF content
      const printWindow = window.open("", "", "height=800,width=800");
      if (!printWindow) {
        throw new Error("Could not open print window");
      }

      // Format the date
      const reportDate = new Date(consolidatedData.period.start);
      const formattedDate = reportDate.toISOString().split("T")[0];

      // Create the HTML content
      printWindow.document.write(`
        <html>
          <head>
            <title>Consolidated Report ${
              period.charAt(0).toUpperCase() + period.slice(1)
            } - ${formattedDate}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              h1 { color: #333; }
              table { border-collapse: collapse; width: 100%; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              .summary { margin-top: 30px; font-weight: bold; }
              .footer { margin-top: 50px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <h1>Consolidated ${
              period.charAt(0).toUpperCase() + period.slice(1)
            } Report - ${formattedDate}</h1>
            
            <div>
              <p><strong>Total Write-Offs:</strong> ${formatKHRCurrency(
                consolidatedData?.metrics.totalWriteOffs || 0.0
              )}</p>
              <p><strong>Total 90+ Days:</strong> ${formatKHRCurrency(
                consolidatedData?.metrics.totalNinetyPlus || 0.0
              )}</p>
              <p><strong>Branches Reported:</strong> ${
                consolidatedData?.metrics.reportedBranches || 0.0
              } of ${consolidatedData?.metrics.totalBranches || 0.0}</p>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Write-Offs (KHR)</th>
                  <th>90+ Days (KHR)</th>
                  <th>Reported</th>
                </tr>
              </thead>
              <tbody>
                ${(consolidatedData?.branchData || [])
                  .map(
                    (branch) => `
                  <tr>
                    <td>${branch.branchCode}</td>
                    <td>${formatKHRCurrency(branch.writeOffs)}</td>
                    <td>${formatKHRCurrency(branch.ninetyPlus)}</td>
                    <td>${branch.hasReports ? "Yes" : "No"}</td>
                  </tr>
                `
                  )
                  .join("")}
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

      // Delay printing to ensure content is loaded
      setTimeout(() => {
        printWindow.print();
        toast({
          title: "Success",
          description: "PDF export initiated",
        });
      }, 500);
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({
        title: "Error",
        description: "Failed to export PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getChartData = () => {
    if (!consolidatedData) return [];

    return consolidatedData.branchData.map((branch: Branch) => ({
      name: branch.branchCode,
      writeOffs: branch.writeOffs,
      ninetyPlus: branch.ninetyPlus,
      branchId: branch.branchId,
      branchName: branch.branchName,
      hasReports: branch.hasReports,
      reportsCount: branch.reportsCount,
      writeOffsPercentage: consolidatedData.metrics.totalWriteOffs
        ? (
            (branch.writeOffs / consolidatedData.metrics.totalWriteOffs) *
            100
          ).toFixed(1)
        : "0",
      ninetyPlusPercentage: consolidatedData.metrics.totalNinetyPlus
        ? (
            (branch.ninetyPlus / consolidatedData.metrics.totalNinetyPlus) *
            100
          ).toFixed(1)
        : "0",
    }));
  };

  const getTimeSeriesData = () => {
    if (!consolidatedData || !consolidatedData.historicalData) return [];

    // Sort data chronologically
    const sortedData = [...consolidatedData.historicalData].sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    // Calculate period-over-period change percentages
    return sortedData.map((item: HistoricalDataPoint, index) => {
      // Add proper error handling for date parsing
      let formattedDate = "Unknown Date";
      let rawDate = null;
      try {
        // Check if item.date is a valid string before parsing
        if (item.date && typeof item.date === "string") {
          const [startDate] = item.date.split(" - ");
          rawDate = parseISO(startDate);
          if (isNaN(rawDate.getTime())) throw new Error("Invalid date");
          formattedDate = format(rawDate, "MMM dd");
        }
      } catch (error) {
        console.error("Error formatting date:", item.date, error);
      }

      // Calculate change from previous period if available
      const prevItem = index > 0 ? sortedData[index - 1] : null;
      const writeOffsChange =
        prevItem && prevItem.writeOffs
          ? (
              ((item.writeOffs - prevItem.writeOffs) / prevItem.writeOffs) *
              100
            ).toFixed(1)
          : null;
      const ninetyPlusChange =
        prevItem && prevItem.ninetyPlus
          ? (
              ((item.ninetyPlus - prevItem.ninetyPlus) / prevItem.ninetyPlus) *
              100
            ).toFixed(1)
          : null;

      // Add average for the last 3 periods if available
      const last3Periods =
        index >= 2
          ? sortedData.slice(Math.max(0, index - 2), index + 1)
          : sortedData.slice(0, index + 1);

      const avgWriteOffs =
        last3Periods.reduce((sum, curr) => sum + curr.writeOffs, 0) /
        last3Periods.length;
      const avgNinetyPlus =
        last3Periods.reduce((sum, curr) => sum + curr.ninetyPlus, 0) /
        last3Periods.length;

      return {
        date: formattedDate,
        rawDate: rawDate,
        writeOffs: item.writeOffs,
        ninetyPlus: item.ninetyPlus,
        count: item.count,
        // Add trend information
        writeOffsChange: writeOffsChange,
        ninetyPlusChange: ninetyPlusChange,
        avgWriteOffs: avgWriteOffs,
        avgNinetyPlus: avgNinetyPlus,
        // Direction indicators for tooltips
        writeOffsTrend: writeOffsChange
          ? parseFloat(writeOffsChange) > 0
            ? "increasing"
            : "decreasing"
          : "stable",
        ninetyPlusTrend: ninetyPlusChange
          ? parseFloat(ninetyPlusChange) > 0
            ? "increasing"
            : "decreasing"
          : "stable",
      };
    });
  };

  const getComparisonData = () => {
    if (!consolidatedData || !planData) return [];

    const comparisonData = consolidatedData.branchData.map((actualBranch) => {
      const planBranch = planData.branchData.find(
        (plan) => plan.branchId === actualBranch.branchId
      );

      return {
        branch: actualBranch.branchCode,
        actualWriteOffs: actualBranch.writeOffs,
        planWriteOffs: planBranch?.writeOffs || 0,
        actualNinetyPlus: actualBranch.ninetyPlus,
        planNinetyPlus: planBranch?.ninetyPlus || 0,
        writeOffsAchievement: planBranch?.writeOffs
          ? (actualBranch.writeOffs / planBranch.writeOffs) * 100
          : 0,
        ninetyPlusAchievement: planBranch?.ninetyPlus
          ? (actualBranch.ninetyPlus / planBranch.ninetyPlus) * 100
          : 0,
      };
    });

    return comparisonData.filter(
      (item) => item.planWriteOffs > 0 || item.planNinetyPlus > 0
    );
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
    data: Record<string, string | number | boolean | undefined>
  ) => {
    if (!data) return;

    // For branch performance chart
    if (data.branchId) {
      // Ensure branchId is treated as a string for the state setter
      const branchIdString = String(data.branchId);
      setSelectedBranchId(branchIdString);
      setDetailsModalOpen(true);

      // Log the interaction
      console.log("Branch clicked:", data.branchName);
    }
    // For time series chart
    else if (data.rawDate) {
      // Ensure rawDate is a valid date input for format function
      const rawDate = data.rawDate;
      if (typeof rawDate === "string" || typeof rawDate === "number") {
        // Find the specific date data
        console.log("Date clicked:", format(rawDate, "yyyy-MM-dd"));

        // You could implement date-specific drill down here
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

  // Add this component for the metric toggles
  const MetricToggles = () => (
    <div className="flex flex-wrap gap-2 mb-4">
      <Button
        variant={visibleMetrics.writeOffs ? "default" : "outline"}
        size="sm"
        onClick={() => toggleMetricVisibility("writeOffs")}
        className={cn(
          "h-9 text-sm flex-1 sm:flex-initial",
          visibleMetrics.writeOffs ? "bg-blue-600 hover:bg-blue-700" : ""
        )}
      >
        {visibleMetrics.writeOffs ? (
          <Eye className="h-4 w-4 mr-1" />
        ) : (
          <EyeOff className="h-4 w-4 mr-1" />
        )}
        Write-offs
      </Button>
      <Button
        variant={visibleMetrics.ninetyPlus ? "default" : "outline"}
        size="sm"
        onClick={() => toggleMetricVisibility("ninetyPlus")}
        className={cn(
          "h-9 text-sm flex-1 sm:flex-initial",
          visibleMetrics.ninetyPlus ? "bg-green-600 hover:bg-green-700" : ""
        )}
      >
        {visibleMetrics.ninetyPlus ? (
          <Eye className="h-4 w-4 mr-1" />
        ) : (
          <EyeOff className="h-4 w-4 mr-1" />
        )}
        90+ Days
      </Button>
      <Button
        variant={showYearOverYear ? "default" : "outline"}
        size="sm"
        onClick={() => setShowYearOverYear(!showYearOverYear)}
        className={cn(
          "h-9 text-sm flex-1 sm:flex-initial",
          showYearOverYear ? "bg-purple-600 hover:bg-purple-700" : ""
        )}
      >
        <BarChart2 className="h-4 w-4 mr-1" />
        Year-over-Year
      </Button>
    </div>
  );

  // Add a new function to get year-over-year comparison data
  const getYearOverYearData = () => {
    if (!consolidatedData || !consolidatedData.historicalData) return [];

    // For demo purposes, we'll simulate last year's data
    // In a real app, you would fetch this from the API
    const thisYearData = getTimeSeriesData();
    const lastYearData = thisYearData.map((item) => ({
      ...item,
      writeOffsLastYear: item.writeOffs * (0.8 + Math.random() * 0.4), // 80-120% of current value
      ninetyPlusLastYear: item.ninetyPlus * (0.8 + Math.random() * 0.4),
    }));

    return lastYearData;
  };

  // Update ChartClickPayload to be compatible with handleBarClick parameter type
  interface ChartClickPayload {
    name?: string;
    branchName?: string;
    branchCode?: string;
    writeOffs?: number;
    ninetyPlus?: number;
    date?: string;
    count?: number;
    writeOffsPercentage?: number;
    ninetyPlusPercentage?: number;
    hasReports?: boolean;
    writeOffsChange?: number;
    ninetyPlusChange?: number;
    [key: string]: string | number | boolean | undefined;
  }

  interface ChartClickData {
    activePayload?: Array<{
      payload: ChartClickPayload;
    }>;
  }

  const handleChartClick = (data: ChartClickData) => {
    if (!data || !data.activePayload || !data.activePayload[0]) return;

    const clickedData = data.activePayload[0].payload;
    handleBarClick(clickedData);
  };

  // Branch Details Modal (moved inside the main component)
  const BranchDetailsModal = ({
    isOpen,
    onClose,
    branchId,
  }: {
    isOpen: boolean;
    onClose: () => void;
    branchId: string | null;
  }) => {
    // Find the branch data
    const branch =
      branchId && consolidatedData
        ? consolidatedData.branchData.find((b) => b.branchId === branchId)
        : null;

    if (!branch) return null;

    // Find plan data for this branch if we have it
    const planBranch =
      reportType === "actual" && planData
        ? planData.branchData.find((p) => p.branchId === branchId)
        : null;

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {branch.branchCode} - {branch.branchName}
            </DialogTitle>
            <DialogDescription>
              Detailed branch performance metrics
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    Write-offs
                  </h3>
                  <div className="text-2xl font-bold">
                    {formatKHRCurrency(branch.writeOffs)}
                  </div>
                  {planBranch && (
                    <div className="mt-2 text-sm">
                      <span className="text-gray-500">Plan: </span>
                      {formatKHRCurrency(planBranch.writeOffs)}
                      <Badge
                        className={cn(
                          "ml-2",
                          branch.writeOffs >= planBranch.writeOffs
                            ? "bg-green-100 text-green-800"
                            : "bg-amber-100 text-amber-800"
                        )}
                      >
                        {planBranch.writeOffs > 0
                          ? `${Math.round(
                              (branch.writeOffs / planBranch.writeOffs) * 100
                            )}%`
                          : "N/A"}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    90+ Days
                  </h3>
                  <div className="text-2xl font-bold">
                    {formatKHRCurrency(branch.ninetyPlus)}
                  </div>
                  {planBranch && (
                    <div className="mt-2 text-sm">
                      <span className="text-gray-500">Plan: </span>
                      {formatKHRCurrency(planBranch.ninetyPlus)}
                      <Badge
                        className={cn(
                          "ml-2",
                          branch.ninetyPlus >= planBranch.ninetyPlus
                            ? "bg-green-100 text-green-800"
                            : "bg-amber-100 text-amber-800"
                        )}
                      >
                        {planBranch.ninetyPlus > 0
                          ? `${Math.round(
                              (branch.ninetyPlus / planBranch.ninetyPlus) * 100
                            )}%`
                          : "N/A"}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-500">
                    % of Total Write-offs:
                  </span>
                  <span className="font-medium">
                    {(
                      (branch.writeOffs /
                        (consolidatedData?.metrics.totalWriteOffs || 1)) *
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-500">
                    % of Total 90+ Days:
                  </span>
                  <span className="font-medium">
                    {(
                      (branch.ninetyPlus /
                        (consolidatedData?.metrics.totalNinetyPlus || 1)) *
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Report Status:</span>
                  <Badge
                    variant={branch.hasReports ? "default" : "outline"}
                    className={
                      branch.hasReports
                        ? "bg-green-500"
                        : "text-amber-600 border-amber-600"
                    }
                  >
                    {branch.hasReports ? "Reported" : "Missing"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={() => {
                onClose();
                // In a real app, you could navigate to a dedicated branch page
                toast({
                  title: "Branch reports",
                  description: `Viewing all reports for ${branch.branchCode} is not implemented in this demo`,
                });
              }}
            >
              View All Reports
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // Handle closing the branch detail dialog
  const handleCloseDialog = () => {
    setSelectedBranch(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consolidated Reports</CardTitle>
        <CardDescription>
          View aggregated metrics across all branches
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b dark:border-gray-700">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                Consolidated Reports
              </h1>
              <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
                Comprehensive view of branch data
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
              <Button
                variant="outline"
                className="w-full sm:w-auto dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 text-sm"
                onClick={() => router.push("/dashboard")}
              >
                <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
                Back to Dashboard
              </Button>

              <div className="flex items-center w-full sm:w-auto mt-3 sm:mt-0">
                <Tabs
                  defaultValue={reportType}
                  onValueChange={(v) =>
                    handleReportTypeChange(v as "plan" | "actual")
                  }
                  className="w-full sm:w-auto"
                >
                  <TabsList className="w-full sm:w-auto dark:bg-gray-800">
                    <TabsTrigger
                      value="plan"
                      className="flex-1 dark:data-[state=active]:bg-gray-700"
                    >
                      Plan
                    </TabsTrigger>
                    <TabsTrigger
                      value="actual"
                      className="flex-1 dark:data-[state=active]:bg-gray-700"
                    >
                      Actual
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </div>

          {/* Period Selection */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-0">
                View by:
              </span>
              <Tabs
                value={period}
                onValueChange={(value: string) => {
                  if (
                    value === "day" ||
                    value === "week" ||
                    value === "month"
                  ) {
                    setPeriod(value as "day" | "week" | "month");
                  }
                }}
                className="w-full sm:w-auto"
              >
                <TabsList className="w-full sm:w-auto dark:bg-gray-800">
                  <TabsTrigger
                    value="day"
                    className="flex-1 dark:data-[state=active]:bg-gray-700"
                  >
                    Daily
                  </TabsTrigger>
                  <TabsTrigger
                    value="week"
                    className="flex-1 dark:data-[state=active]:bg-gray-700"
                  >
                    Weekly
                  </TabsTrigger>
                  <TabsTrigger
                    value="month"
                    className="flex-1 dark:data-[state=active]:bg-gray-700"
                  >
                    Monthly
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {consolidatedData
                ? `Data for ${
                    period === "day"
                      ? "daily"
                      : period === "week"
                        ? "weekly"
                        : "monthly"
                  } period ${format(date || new Date(), "MMMM d, yyyy")}`
                : "Select a date and period to view data"}
            </p>
          </div>

          {/* Date Selection and Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
            <div className="flex items-center w-full sm:w-auto">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className="w-full sm:w-[240px] justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(newDate) => {
                      // Ensure we set a valid date or fallback to today
                      setDate(newDate || new Date());
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <Button
                onClick={handleGenerateReport}
                disabled={!date || isLoading}
                className="flex-1 sm:flex-none sm:w-32"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Generate"
                )}
              </Button>
              <div className="flex gap-2 flex-1 sm:flex-none">
                <Button
                  onClick={handleExportCSV}
                  variant="outline"
                  className="flex-1 sm:flex-none flex items-center justify-center"
                  disabled={!consolidatedData}
                >
                  <FileSpreadsheetIcon className="mr-2 h-4 w-4" />
                  <span className="hidden md:inline">Export CSV</span>
                  <span className="md:hidden">CSV</span>
                </Button>
                <Button
                  onClick={handleExportPDF}
                  variant="outline"
                  className="flex-1 sm:flex-none flex items-center justify-center"
                  disabled={!consolidatedData}
                >
                  <FileIcon className="mr-2 h-4 w-4" />
                  <span className="hidden md:inline">Export PDF</span>
                  <span className="md:hidden">PDF</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Wrap content in a div that can be animated during transitions */}
          <div
            id="consolidated-content"
            className="transition-all duration-300 ease-in-out transform"
          >
            {/* Loading state with skeletons */}
            {isLoading && (
              <div className="space-y-6 py-2">
                {/* Metrics cards skeleton */}
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
                  <MetricCardSkeleton />
                  <MetricCardSkeleton />
                  <MetricCardSkeleton />
                  <MetricCardSkeleton />
                </div>

                {/* Chart skeletons */}
                <ChartSkeleton className="mt-6" />
                <ChartSkeleton className="mt-6" />
              </div>
            )}

            {/* Enhanced error state with retry button */}
            {error && !isLoading && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 p-6 rounded-lg mb-6 animate-in slide-in-from-top-4 duration-300">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 mt-0.5 mr-2 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1 text-lg flex items-center">
                      Error Loading Data
                      <span className="ml-2 text-xs font-normal bg-red-100 dark:bg-red-900/50 py-0.5 px-1.5 rounded-full">
                        Data Fetch Failed
                      </span>
                    </h3>
                    <p className="text-sm mb-4">{error}</p>

                    <div className="bg-white dark:bg-gray-800 rounded p-3 border border-red-100 dark:border-red-800/30 mb-4">
                      <h4 className="text-sm font-medium mb-1 flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        Possible causes:
                      </h4>
                      <ul className="text-xs list-disc pl-5 space-y-1">
                        <li>Network connection issue</li>
                        <li>Server is temporarily unavailable</li>
                        <li>
                          You might not have permission to access this data
                        </li>
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
              <>
                {/* Metrics Overview Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 transition-all duration-300 ease-in-out">
                  <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200 overflow-hidden">
                    <CardContent className="p-4 md:p-6">
                      <div className="flex flex-col">
                        <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
                          Total Write-offs
                        </span>
                        <span className="text-lg sm:text-xl md:text-2xl font-bold mt-2 transition-all duration-300 ease-in-out animate-in fade-in-50 slide-in-from-bottom-5">
                          {formatKHRCurrency(
                            consolidatedData.metrics.totalWriteOffs
                          )}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200 overflow-hidden">
                    <CardContent className="p-4 md:p-6">
                      <div className="flex flex-col">
                        <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
                          Total 90+ Days
                        </span>
                        <span
                          className="text-lg sm:text-xl md:text-2xl font-bold mt-2 transition-all duration-300 ease-in-out animate-in fade-in-50 slide-in-from-bottom-5"
                          style={{ animationDelay: "100ms" }}
                        >
                          {formatKHRCurrency(
                            consolidatedData.metrics.totalNinetyPlus
                          )}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Branch Coverage Card with Enhanced Visual Indicator */}
                  <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200 overflow-hidden">
                    <CardContent className="p-4 md:p-6">
                      <div className="flex flex-col">
                        <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
                          Branch Coverage
                        </span>
                        <div className="flex flex-col sm:flex-row sm:items-end mt-2">
                          <span
                            className="text-lg sm:text-xl md:text-2xl font-bold transition-all duration-300 ease-in-out animate-in fade-in-50 slide-in-from-bottom-5"
                            style={{ animationDelay: "200ms" }}
                          >
                            {consolidatedData.metrics.reportedBranches}/
                            {consolidatedData.metrics.totalBranches}
                          </span>
                          <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 sm:ml-2 sm:mb-1">
                            (
                            {Math.round(
                              consolidatedData.metrics.coveragePercentage
                            )}
                            %)
                          </span>
                        </div>

                        {/* Visual progress indicator for branch coverage */}
                        <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full mt-3 overflow-hidden relative">
                          {/* Animated progress bar */}
                          <div
                            className="h-full rounded-full transition-all duration-1000 ease-out-expo"
                            style={{
                              width: `${consolidatedData.metrics.coveragePercentage}%`,
                              backgroundColor:
                                consolidatedData.metrics.coveragePercentage >=
                                80
                                  ? "#10b981" // green for good coverage
                                  : consolidatedData.metrics
                                        .coveragePercentage >= 50
                                    ? "#f59e0b" // amber for medium coverage
                                    : "#ef4444", // red for poor coverage
                            }}
                          />

                          {/* Milestone markers */}
                          <div className="absolute top-0 left-0 w-full h-full flex items-center justify-between px-[3px]">
                            {[25, 50, 75].map((milestone) => (
                              <div
                                key={milestone}
                                className="w-0.5 h-1/2 bg-gray-300 dark:bg-gray-600 rounded-full z-10"
                                style={{
                                  left: `${milestone}%`,
                                  transform: "translateX(-50%)",
                                }}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Label for coverage quality */}
                        <div className="mt-2 text-xs">
                          <span
                            className={cn(
                              "inline-block px-2 py-0.5 rounded-full font-medium",
                              consolidatedData.metrics.coveragePercentage >= 80
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : consolidatedData.metrics.coveragePercentage >=
                                    50
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                  : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            )}
                          >
                            {consolidatedData.metrics.coveragePercentage >= 80
                              ? "Good"
                              : consolidatedData.metrics.coveragePercentage >=
                                  50
                                ? "Average"
                                : "Poor"}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200 overflow-hidden">
                    <CardContent className="p-4 md:p-6">
                      <div className="flex flex-col">
                        <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
                          Missing Reports
                        </span>
                        <div className="flex flex-col sm:flex-row sm:items-end mt-2">
                          <span
                            className="text-lg sm:text-xl md:text-2xl font-bold transition-all duration-300 ease-in-out animate-in fade-in-50 slide-in-from-bottom-5"
                            style={{ animationDelay: "300ms" }}
                          >
                            {consolidatedData.missingBranches.length}
                          </span>
                          <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 sm:ml-2 sm:mb-1">
                            branches
                          </span>
                        </div>

                        {consolidatedData.missingBranches.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 text-xs h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            View missing branches
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Branch Performance Chart - Collapsible */}
                <div
                  className="mt-6 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-all duration-300"
                  ref={chartRefs.branchPerformance}
                >
                  <div
                    className="bg-gray-50 dark:bg-gray-800 p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                    onClick={() => toggleSection("branchPerformance")}
                  >
                    <h3 className="text-lg font-medium">Branch Performance</h3>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      {collapsedSections.branchPerformance ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronUp className="h-5 w-5" />
                      )}
                    </Button>
                  </div>

                  <div
                    className={cn(
                      "transition-all duration-300 ease-in-out",
                      collapsedSections.branchPerformance
                        ? "max-h-0 opacity-0 overflow-hidden"
                        : "max-h-[500px] opacity-100"
                    )}
                  >
                    {/* Metric Toggle Controls */}
                    <div className="px-4 pt-4">
                      <MetricToggles />
                    </div>
                    <div className="w-full h-[300px] sm:h-[400px] p-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={getChartData()}
                          margin={{ top: 20, right: 20, left: 0, bottom: 5 }}
                          onClick={handleChartClick}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 10 }}
                            height={40}
                            interval={0}
                            angle={-45}
                            textAnchor="end"
                          />
                          <YAxis
                            width={55}
                            tick={{ fontSize: 10 }}
                            tickFormatter={(value) =>
                              value >= 1000000
                                ? `${(value / 1000000).toFixed(1)}M`
                                : value >= 1000
                                  ? `${(value / 1000).toFixed(1)}K`
                                  : value
                            }
                          />
                          <RechartsTooltip content={<CustomBranchTooltip />} />
                          <Legend wrapperStyle={{ fontSize: "12px" }} />
                          {visibleMetrics.writeOffs && (
                            <Bar
                              dataKey="writeOffs"
                              name="Write-offs"
                              fill="#8884d8"
                              cursor="pointer"
                            />
                          )}
                          {visibleMetrics.ninetyPlus && (
                            <Bar
                              dataKey="ninetyPlus"
                              name="90+ Days"
                              fill="#82ca9d"
                              cursor="pointer"
                            />
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Time Series Chart - Collapsible */}
                {consolidatedData.historicalData &&
                  consolidatedData.historicalData.length > 0 && (
                    <div
                      className="mt-6 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-all duration-300"
                      ref={chartRefs.timeSeries}
                    >
                      <div
                        className="bg-gray-50 dark:bg-gray-800 p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                        onClick={() => toggleSection("timeSeries")}
                      >
                        <h3 className="text-lg font-medium">
                          {period === "day"
                            ? "Daily Trends"
                            : period === "week"
                              ? "Weekly Trends"
                              : "Monthly Trends"}
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          {collapsedSections.timeSeries ? (
                            <ChevronDown className="h-5 w-5" />
                          ) : (
                            <ChevronUp className="h-5 w-5" />
                          )}
                        </Button>
                      </div>

                      <div
                        className={cn(
                          "transition-all duration-300 ease-in-out",
                          collapsedSections.timeSeries
                            ? "max-h-0 opacity-0 overflow-hidden"
                            : "max-h-[500px] opacity-100"
                        )}
                      >
                        {/* Metric Toggle Controls */}
                        <div className="px-4 pt-4">
                          <MetricToggles />
                        </div>
                        <div className="w-full h-[300px] sm:h-[400px] p-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={
                                showYearOverYear
                                  ? getYearOverYearData()
                                  : getTimeSeriesData()
                              }
                              margin={{
                                top: 20,
                                right: 30,
                                left: 20,
                                bottom: 5,
                              }}
                              onClick={handleChartClick}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis />
                              <RechartsTooltip
                                content={<CustomTimeTooltip />}
                              />
                              <Legend />
                              {visibleMetrics.writeOffs && (
                                <Bar
                                  dataKey="writeOffs"
                                  name="Write-offs"
                                  fill="#8884d8"
                                  cursor="pointer"
                                />
                              )}
                              {showYearOverYear && visibleMetrics.writeOffs && (
                                <Bar
                                  dataKey="writeOffsLastYear"
                                  name="Write-offs (Last Year)"
                                  fill="#8884d8"
                                  fillOpacity={0.4}
                                  cursor="pointer"
                                />
                              )}
                              {visibleMetrics.ninetyPlus && (
                                <Bar
                                  dataKey="ninetyPlus"
                                  name="90+ Days"
                                  fill="#82ca9d"
                                  cursor="pointer"
                                />
                              )}
                              {showYearOverYear &&
                                visibleMetrics.ninetyPlus && (
                                  <Bar
                                    dataKey="ninetyPlusLastYear"
                                    name="90+ Days (Last Year)"
                                    fill="#82ca9d"
                                    fillOpacity={0.4}
                                    cursor="pointer"
                                  />
                                )}
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Trend Analysis Line Chart - Collapsible */}
                {consolidatedData &&
                  consolidatedData.historicalData &&
                  consolidatedData.historicalData.length > 0 && (
                    <div
                      className="mt-6 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-all duration-300"
                      ref={chartRefs.trendAnalysis}
                    >
                      <div
                        className="bg-gray-50 dark:bg-gray-800 p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                        onClick={() => toggleSection("trendAnalysis")}
                      >
                        <h3 className="text-lg font-medium">Trend Analysis</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          {collapsedSections.trendAnalysis ? (
                            <ChevronDown className="h-5 w-5" />
                          ) : (
                            <ChevronUp className="h-5 w-5" />
                          )}
                        </Button>
                      </div>

                      <div
                        className={cn(
                          "transition-all duration-300 ease-in-out",
                          collapsedSections.trendAnalysis
                            ? "max-h-0 opacity-0 overflow-hidden"
                            : "max-h-[500px] opacity-100"
                        )}
                      >
                        <div className="w-full h-[300px] sm:h-[400px] p-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={getTimeSeriesData().reverse()} // Reverse to show oldest to newest
                              margin={{
                                top: 20,
                                right: 30,
                                left: 20,
                                bottom: 5,
                              }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis />
                              <RechartsTooltip
                                contentStyle={{
                                  backgroundColor: "rgba(255, 255, 255, 0.9)",
                                  border: "1px solid #ccc",
                                  borderRadius: "4px",
                                  padding: "10px",
                                }}
                              />
                              <Legend />
                              <Line
                                type="monotone"
                                dataKey="writeOffs"
                                name="Write-offs"
                                stroke="#8884d8"
                                activeDot={{ r: 8 }}
                                strokeWidth={2}
                              />
                              <Line
                                type="monotone"
                                dataKey="ninetyPlus"
                                name="90+ Days"
                                stroke="#82ca9d"
                                activeDot={{ r: 8 }}
                                strokeWidth={2}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                          <div className="text-sm text-gray-500 mt-2 text-center">
                            Trend over time showing write-offs and 90+ days
                            outstanding amounts
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Plan vs Actual Comparison (only show when viewing actual data and plan data is available) */}
                {reportType === "actual" && planData && (
                  <div className="mt-6">
                    <h3 className="text-lg font-medium mb-4">
                      Plan vs. Actual Comparison
                    </h3>

                    {/* Overall Achievement Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                Write-offs Achievement
                              </h4>
                              <div className="flex items-baseline mt-1">
                                <span className="text-2xl font-bold">
                                  {planData.metrics.totalWriteOffs > 0
                                    ? `${(
                                        (consolidatedData.metrics
                                          .totalWriteOffs /
                                          planData.metrics.totalWriteOffs) *
                                        100
                                      ).toFixed(1)}%`
                                    : "N/A"}
                                </span>
                                <span className="ml-2 text-sm text-gray-500">
                                  {formatKHRCurrency(
                                    consolidatedData.metrics.totalWriteOffs
                                  )}{" "}
                                  /{" "}
                                  {formatKHRCurrency(
                                    planData.metrics.totalWriteOffs
                                  )}
                                </span>
                              </div>
                            </div>
                            <div
                              className={cn(
                                "text-lg font-semibold rounded-full w-12 h-12 flex items-center justify-center",
                                planData.metrics.totalWriteOffs > 0 &&
                                  consolidatedData.metrics.totalWriteOffs >=
                                    planData.metrics.totalWriteOffs
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              )}
                            >
                              {planData.metrics.totalWriteOffs > 0
                                ? `${Math.round(
                                    (consolidatedData.metrics.totalWriteOffs /
                                      planData.metrics.totalWriteOffs) *
                                      100
                                  )}%`
                                : "N/A"}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                90+ Days Achievement
                              </h4>
                              <div className="flex items-baseline mt-1">
                                <span className="text-2xl font-bold">
                                  {planData.metrics.totalNinetyPlus > 0
                                    ? `${(
                                        (consolidatedData.metrics
                                          .totalNinetyPlus /
                                          planData.metrics.totalNinetyPlus) *
                                        100
                                      ).toFixed(1)}%`
                                    : "N/A"}
                                </span>
                                <span className="ml-2 text-sm text-gray-500">
                                  {formatKHRCurrency(
                                    consolidatedData.metrics.totalNinetyPlus
                                  )}{" "}
                                  /{" "}
                                  {formatKHRCurrency(
                                    planData.metrics.totalNinetyPlus
                                  )}
                                </span>
                              </div>
                            </div>
                            <div
                              className={cn(
                                "text-lg font-semibold rounded-full w-12 h-12 flex items-center justify-center",
                                planData.metrics.totalNinetyPlus > 0 &&
                                  consolidatedData.metrics.totalNinetyPlus >=
                                    planData.metrics.totalNinetyPlus
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              )}
                            >
                              {planData.metrics.totalNinetyPlus > 0
                                ? `${Math.round(
                                    (consolidatedData.metrics.totalNinetyPlus /
                                      planData.metrics.totalNinetyPlus) *
                                      100
                                  )}%`
                                : "N/A"}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Comparison Chart */}
                    <div className="w-full h-80 border rounded-md p-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={getComparisonData()}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="branch" />
                          <YAxis />
                          <RechartsTooltip
                            formatter={(value) =>
                              formatKHRCurrency(value as number)
                            }
                            labelFormatter={(label) => `Branch: ${label}`}
                          />
                          <Legend />
                          <Bar
                            dataKey="planWriteOffs"
                            name="Plan Write-offs"
                            fill="#8884d8"
                            opacity={0.6}
                          />
                          <Bar
                            dataKey="actualWriteOffs"
                            name="Actual Write-offs"
                            fill="#8884d8"
                          />
                          <Bar
                            dataKey="planNinetyPlus"
                            name="Plan 90+ Days"
                            fill="#82ca9d"
                            opacity={0.6}
                          />
                          <Bar
                            dataKey="actualNinetyPlus"
                            name="Actual 90+ Days"
                            fill="#82ca9d"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="text-sm text-gray-500 mt-2 text-center">
                        Comparison of planned vs. actual figures for each branch
                      </div>
                    </div>
                  </div>
                )}

                {/* Branch Status Table */}
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-4">Branch Status</h3>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">
                            Branch
                          </TableHead>
                          <TableHead className="whitespace-nowrap text-right">
                            Write-offs
                          </TableHead>
                          {reportType === "actual" && planData && (
                            <TableHead className="whitespace-nowrap text-center">
                              Achievement
                            </TableHead>
                          )}
                          <TableHead className="whitespace-nowrap text-right">
                            90+ Days
                          </TableHead>
                          {reportType === "actual" && planData && (
                            <TableHead className="whitespace-nowrap text-center">
                              Achievement
                            </TableHead>
                          )}
                          <TableHead className="whitespace-nowrap text-center">
                            Status
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {consolidatedData.branchData.map((branch: Branch) => {
                          // Find corresponding plan data for this branch when in actual view
                          const planBranch =
                            reportType === "actual" && planData
                              ? planData.branchData.find(
                                  (plan) => plan.branchId === branch.branchId
                                )
                              : null;

                          // Calculate achievement percentages
                          const writeOffsAchievement =
                            planBranch?.writeOffs && planBranch.writeOffs > 0
                              ? (branch.writeOffs / planBranch.writeOffs) * 100
                              : 0;

                          const ninetyPlusAchievement =
                            planBranch?.ninetyPlus && planBranch.ninetyPlus > 0
                              ? (branch.ninetyPlus / planBranch.ninetyPlus) *
                                100
                              : 0;

                          return (
                            <TableRow key={branch.branchId}>
                              <TableCell className="whitespace-nowrap font-medium">
                                {branch.branchCode}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-right">
                                {formatKHRCurrency(branch.writeOffs)}
                              </TableCell>
                              {reportType === "actual" && planData && (
                                <TableCell className="whitespace-nowrap text-center">
                                  {planBranch?.writeOffs &&
                                  planBranch.writeOffs > 0 ? (
                                    <Badge
                                      className={cn(
                                        "font-medium",
                                        writeOffsAchievement >= 100
                                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                          : writeOffsAchievement >= 80
                                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                      )}
                                    >
                                      {writeOffsAchievement.toFixed(1)}%
                                    </Badge>
                                  ) : (
                                    <span className="text-gray-400">N/A</span>
                                  )}
                                </TableCell>
                              )}
                              <TableCell className="whitespace-nowrap text-right">
                                {formatKHRCurrency(branch.ninetyPlus)}
                              </TableCell>
                              {reportType === "actual" && planData && (
                                <TableCell className="whitespace-nowrap text-center">
                                  {planBranch?.ninetyPlus &&
                                  planBranch.ninetyPlus > 0 ? (
                                    <Badge
                                      className={cn(
                                        "font-medium",
                                        ninetyPlusAchievement >= 100
                                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                          : ninetyPlusAchievement >= 80
                                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                      )}
                                    >
                                      {ninetyPlusAchievement.toFixed(1)}%
                                    </Badge>
                                  ) : (
                                    <span className="text-gray-400">N/A</span>
                                  )}
                                </TableCell>
                              )}
                              <TableCell className="whitespace-nowrap text-center">
                                {branch.hasReports ? (
                                  <Badge className="bg-green-500">
                                    Reported
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="border-yellow-500 text-yellow-500"
                                  >
                                    Missing
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
      <BranchDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        branchId={selectedBranchId}
      />
      {/* Branch detail dialog */}
      {selectedBranch && (
        <BranchDetailDialog
          selectedBranch={selectedBranch}
          selectedBranchData={consolidatedData?.branchData.find(
            (item) =>
              item.branchCode === selectedBranch ||
              item.branchName === selectedBranch
          )}
          onClose={handleCloseDialog}
        />
      )}
    </Card>
  );
}
