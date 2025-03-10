"use client";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "@radix-ui/react-icons";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileIcon, FileSpreadsheetIcon } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Mock data for demonstration
const mockConsolidatedData = {
  date: "2023-03-06",
  totalWriteOffs: 396000.0,
  totalNinetyPlus: 520000.0,
  reportedBranches: 6,
  totalBranches: 15,
  branches: [
    {
      branch: "01-PNH",
      writeOffs: 23000.0,
      ninetyPlus: 100000.0,
      reported: true,
    },
    { branch: "02-BTB", writeOffs: 23000.0, ninetyPlus: 335.0, reported: true },
    { branch: "03-SRP", writeOffs: 48000.0, ninetyPlus: 335.0, reported: true },
    {
      branch: "04-KTI",
      writeOffs: 245000.0,
      ninetyPlus: 100000.0,
      reported: true,
    },
    {
      branch: "05-SHV",
      writeOffs: 75000.0,
      ninetyPlus: 100000.0,
      reported: true,
    },
    {
      branch: "06-STR",
      writeOffs: 4000.0,
      ninetyPlus: 220000.0,
      reported: true,
    },
    { branch: "07-KCH", writeOffs: 0, ninetyPlus: 0, reported: false },
    { branch: "08-KKG", writeOffs: 0, ninetyPlus: 0, reported: false },
    { branch: "09-PST", writeOffs: 0, ninetyPlus: 0, reported: false },
    { branch: "10-BMC", writeOffs: 0, ninetyPlus: 0, reported: false },
    { branch: "11-KPT", writeOffs: 0, ninetyPlus: 0, reported: false },
    { branch: "12-SRL", writeOffs: 0, ninetyPlus: 0, reported: false },
    { branch: "13-SRG", writeOffs: 0, ninetyPlus: 0, reported: false },
    { branch: "14-OMC", writeOffs: 0, ninetyPlus: 0, reported: false },
    { branch: "15-RLU", writeOffs: 0, ninetyPlus: 0, reported: false },
    { branch: "16-KTM", writeOffs: 0, ninetyPlus: 0, reported: false },
  ],
};

// Mock weekly data
const mockWeeklyData = {
  startDate: "2023-03-01",
  endDate: "2023-03-07",
  totalWriteOffs: 1250000.0,
  totalNinetyPlus: 1800000.0,
  reportedBranches: 12,
  totalBranches: 15,
  branches: [
    {
      branch: "01-PNH",
      writeOffs: 120000.0,
      ninetyPlus: 350000.0,
      reported: true,
    },
    {
      branch: "02-BTB",
      writeOffs: 85000.0,
      ninetyPlus: 120000.0,
      reported: true,
    },
    {
      branch: "03-SRP",
      writeOffs: 95000.0,
      ninetyPlus: 110000.0,
      reported: true,
    },
    {
      branch: "04-KTI",
      writeOffs: 145000.0,
      ninetyPlus: 200000.0,
      reported: true,
    },
    {
      branch: "05-SHV",
      writeOffs: 175000.0,
      ninetyPlus: 250000.0,
      reported: true,
    },
    {
      branch: "06-STR",
      writeOffs: 104000.0,
      ninetyPlus: 320000.0,
      reported: true,
    },
    {
      branch: "07-KCH",
      writeOffs: 85000.0,
      ninetyPlus: 110000.0,
      reported: true,
    },
    {
      branch: "08-KKG",
      writeOffs: 75000.0,
      ninetyPlus: 90000.0,
      reported: true,
    },
    {
      branch: "09-PST",
      writeOffs: 65000.0,
      ninetyPlus: 80000.0,
      reported: true,
    },
    {
      branch: "10-BMC",
      writeOffs: 55000.0,
      ninetyPlus: 70000.0,
      reported: true,
    },
    {
      branch: "11-KPT",
      writeOffs: 45000.0,
      ninetyPlus: 60000.0,
      reported: true,
    },
    {
      branch: "12-SRL",
      writeOffs: 35000.0,
      ninetyPlus: 50000.0,
      reported: true,
    },
    { branch: "13-SRG", writeOffs: 0, ninetyPlus: 0, reported: false },
    { branch: "14-OMC", writeOffs: 0, ninetyPlus: 0, reported: false },
    { branch: "15-RLU", writeOffs: 0, ninetyPlus: 0, reported: false },
  ],
  dailyTotals: [
    { date: "2023-03-01", writeOffs: 180000, ninetyPlus: 250000 },
    { date: "2023-03-02", writeOffs: 195000, ninetyPlus: 270000 },
    { date: "2023-03-03", writeOffs: 210000, ninetyPlus: 290000 },
    { date: "2023-03-04", writeOffs: 225000, ninetyPlus: 310000 },
    { date: "2023-03-05", writeOffs: 240000, ninetyPlus: 330000 },
    { date: "2023-03-06", writeOffs: 200000, ninetyPlus: 350000 },
  ],
};

// Mock monthly data
const mockMonthlyData = {
  month: "March 2023",
  totalWriteOffs: 5200000.0,
  totalNinetyPlus: 7500000.0,
  reportedBranches: 15,
  totalBranches: 15,
  branches: [
    {
      branch: "01-PNH",
      writeOffs: 520000.0,
      ninetyPlus: 750000.0,
      reported: true,
    },
    {
      branch: "02-BTB",
      writeOffs: 480000.0,
      ninetyPlus: 620000.0,
      reported: true,
    },
    {
      branch: "03-SRP",
      writeOffs: 450000.0,
      ninetyPlus: 580000.0,
      reported: true,
    },
    {
      branch: "04-KTI",
      writeOffs: 445000.0,
      ninetyPlus: 570000.0,
      reported: true,
    },
    {
      branch: "05-SHV",
      writeOffs: 435000.0,
      ninetyPlus: 560000.0,
      reported: true,
    },
    {
      branch: "06-STR",
      writeOffs: 425000.0,
      ninetyPlus: 550000.0,
      reported: true,
    },
    {
      branch: "07-KCH",
      writeOffs: 415000.0,
      ninetyPlus: 540000.0,
      reported: true,
    },
    {
      branch: "08-KKG",
      writeOffs: 405000.0,
      ninetyPlus: 530000.0,
      reported: true,
    },
    {
      branch: "09-PST",
      writeOffs: 395000.0,
      ninetyPlus: 520000.0,
      reported: true,
    },
    {
      branch: "10-BMC",
      writeOffs: 385000.0,
      ninetyPlus: 510000.0,
      reported: true,
    },
    {
      branch: "11-KPT",
      writeOffs: 375000.0,
      ninetyPlus: 500000.0,
      reported: true,
    },
    {
      branch: "12-SRL",
      writeOffs: 365000.0,
      ninetyPlus: 490000.0,
      reported: true,
    },
    {
      branch: "13-SRG",
      writeOffs: 355000.0,
      ninetyPlus: 480000.0,
      reported: true,
    },
    {
      branch: "14-OMC",
      writeOffs: 345000.0,
      ninetyPlus: 470000.0,
      reported: true,
    },
    {
      branch: "15-RLU",
      writeOffs: 335000.0,
      ninetyPlus: 460000.0,
      reported: true,
    },
  ],
  weeklyTotals: [
    { week: "Week 1", writeOffs: 1200000, ninetyPlus: 1800000 },
    { week: "Week 2", writeOffs: 1300000, ninetyPlus: 1900000 },
    { week: "Week 3", writeOffs: 1400000, ninetyPlus: 2000000 },
    { week: "Week 4", writeOffs: 1300000, ninetyPlus: 1800000 },
  ],
};

export default function ConsolidatedView() {
  const [date, setDate] = useState<Date>();
  const [consolidatedData, setConsolidatedData] = useState<any>();
  const [isLoading, setIsLoading] = useState(false);
  const [viewType, setViewType] = useState("daily"); // daily, weekly, monthly

  const handleGenerateReport = async () => {
    if (!date) {
      toast({
        title: "Error",
        description: "Please select a date",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Format the date for the API - YYYY-MM-DD format without timezone
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const formattedDate = `${year}-${month}-${day}T00:00:00.000Z`;

      console.log("Formatted date for API:", formattedDate);

      // Call the API with the appropriate parameters
      const apiUrl = `/api/consolidated?date=${encodeURIComponent(
        formattedDate
      )}&includeInactive=true&viewType=${viewType}`;
      console.log("Calling API with URL:", apiUrl);

      const response = await fetch(apiUrl);

      console.log("API response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error response:", errorText);
        throw new Error(
          `Failed to fetch consolidated data: ${response.status} ${errorText}`
        );
      }

      const data = await response.json();
      console.log("Received data from API:", data);

      // Check if the API returned valid data
      if (!data || !data.branches || data.branches.length === 0) {
        console.warn("API returned empty data, using mock data for display");
        // Use appropriate mock data based on view type
        if (viewType === "daily") {
          setConsolidatedData(mockConsolidatedData);
        } else if (viewType === "weekly") {
          setConsolidatedData(mockWeeklyData);
        } else if (viewType === "monthly") {
          setConsolidatedData(mockMonthlyData);
        }

        toast({
          title: "Warning",
          description: `No data available for the selected ${viewType} view. Showing mock data.`,
          variant: "default",
        });
      } else {
        // Process the API data to match the expected structure
        const processedData = {
          ...data,
          totalWriteOffs: data.statistics?.totalWriteOffs || 0,
          totalNinetyPlus: data.statistics?.totalNinetyPlus || 0,
          reportedBranches: data.statistics?.reportedBranches || 0,
          totalBranches: data.statistics?.totalBranches || 0,
        };

        // Use the real data
        setConsolidatedData(processedData);
        toast({
          title: "Success",
          description: "Report generated successfully",
        });
      }
    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        title: "Error",
        description: "Failed to generate report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!consolidatedData || !consolidatedData.branches) {
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
      consolidatedData.branches.forEach((branch) => {
        csvContent += `${branch.branch},${branch.writeOffs},${
          branch.ninetyPlus
        },${branch.reported ? "Yes" : "No"}\n`;
      });

      // Add summary row
      csvContent += `\nTotal,${consolidatedData.totalWriteOffs},${consolidatedData.totalNinetyPlus},${consolidatedData.reportedBranches}/${consolidatedData.totalBranches}\n`;

      // Create blob and download link
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      // Format the current date for the filename
      const reportDate = new Date(consolidatedData.date);
      const formattedDate = reportDate.toISOString().split("T")[0];

      // Set link properties and trigger download
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `consolidated_report_${viewType}_${formattedDate}.csv`
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
    if (!consolidatedData || !consolidatedData.branches) {
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
      const reportDate = new Date(consolidatedData.date);
      const formattedDate = reportDate.toISOString().split("T")[0];

      // Create the HTML content
      printWindow.document.write(`
        <html>
          <head>
            <title>Consolidated Report ${
              viewType.charAt(0).toUpperCase() + viewType.slice(1)
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
              viewType.charAt(0).toUpperCase() + viewType.slice(1)
            } Report - ${formattedDate}</h1>
            
            <div>
              <p><strong>Total Write-Offs:</strong> ${formatCurrency(
                consolidatedData?.totalWriteOffs || 0.0
              )}</p>
              <p><strong>Total 90+ Days:</strong> ${formatCurrency(
                consolidatedData?.totalNinetyPlus || 0.0
              )}</p>
              <p><strong>Branches Reported:</strong> ${
                consolidatedData?.reportedBranches || 0.0
              } of ${consolidatedData?.totalBranches || 0.0}</p>
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
                ${(consolidatedData?.branches || [])
                  .map(
                    (branch) => `
                  <tr>
                    <td>${branch.branch}</td>
                    <td>${formatCurrency(branch.writeOffs)}</td>
                    <td>${formatCurrency(branch.ninetyPlus)}</td>
                    <td>${branch.reported ? "Yes" : "No"}</td>
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("km-KH", {
      style: "currency",
      currency: "KHR",
      currencyDisplay: "symbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Prepare chart data from branches
  const getChartData = () => {
    if (!consolidatedData || !consolidatedData.branches) return [];

    // Filter only reported branches and sort by write-offs
    return consolidatedData.branches
      .filter((branch) => branch.reported)
      .sort((a, b) => b.writeOffs - a.writeOffs)
      .slice(0, 10) // Show top 10 branches
      .map((branch) => ({
        name: branch.branch,
        writeOffs: branch.writeOffs,
        ninetyPlus: branch.ninetyPlus,
      }));
  };

  // Get time series data for weekly/monthly views
  const getTimeSeriesData = () => {
    if (!consolidatedData) return [];

    if (viewType === "weekly" && consolidatedData.dailyTotals) {
      return consolidatedData.dailyTotals;
    } else if (viewType === "monthly" && consolidatedData.weeklyTotals) {
      return consolidatedData.weeklyTotals;
    }

    return [];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consolidated Report</CardTitle>
        <CardDescription>
          View consolidated data for all branches
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4">
          {/* View Type Tabs */}
          <Tabs
            defaultValue="daily"
            value={viewType}
            onValueChange={setViewType}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="daily">Daily View</TabsTrigger>
              <TabsTrigger value="weekly">Weekly View</TabsTrigger>
              <TabsTrigger value="monthly">Monthly View</TabsTrigger>
            </TabsList>

            <TabsContent value="daily" className="mt-4">
              <p className="text-sm text-muted-foreground mb-4">
                View consolidated data for a specific date across all branches.
              </p>
            </TabsContent>

            <TabsContent value="weekly" className="mt-4">
              <p className="text-sm text-muted-foreground mb-4">
                View weekly consolidated data starting from the selected date.
              </p>
            </TabsContent>

            <TabsContent value="monthly" className="mt-4">
              <p className="text-sm text-muted-foreground mb-4">
                View monthly consolidated data for the month of the selected
                date.
              </p>
            </TabsContent>
          </Tabs>

          {/* Date Selection and Action Buttons */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-2">
              <span className="text-sm font-medium">
                {viewType === "daily"
                  ? "Select Date"
                  : viewType === "weekly"
                  ? "Select Start Date"
                  : "Select Month"}
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full md:w-auto justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Select a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleGenerateReport}
                disabled={!date || isLoading}
                className="w-32"
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
              <div className="flex gap-2 w-full md:w-auto">
                <Button
                  onClick={handleExportCSV}
                  variant="outline"
                  className="flex items-center flex-1 md:flex-auto"
                  disabled={!consolidatedData}
                >
                  <FileSpreadsheetIcon className="mr-2 h-4 w-4" />
                  <span className="md:inline">CSV</span>
                </Button>
                <Button
                  onClick={handleExportPDF}
                  variant="outline"
                  className="flex items-center flex-1 md:flex-auto"
                  disabled={!consolidatedData}
                >
                  <FileIcon className="mr-2 h-4 w-4" />
                  <span className="md:inline">PDF</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          {consolidatedData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-4">
              <Card className="bg-white dark:bg-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Total Write-offs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(consolidatedData?.totalWriteOffs || 0.0)}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Total 90+ Days
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(consolidatedData?.totalNinetyPlus || 0.0)}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Reporting Branches
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {consolidatedData?.reportedBranches || 0} /{" "}
                    {consolidatedData?.totalBranches || 0}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {viewType === "daily"
                      ? "Date"
                      : viewType === "weekly"
                      ? "Week Range"
                      : "Month"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {viewType === "daily"
                      ? consolidatedData?.date
                        ? new Date(consolidatedData.date).toLocaleDateString()
                        : "N/A"
                      : viewType === "weekly"
                      ? `${consolidatedData?.startDate || ""} - ${
                          consolidatedData?.endDate || ""
                        }`
                      : consolidatedData?.month || "N/A"}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Branch Performance Chart */}
          {consolidatedData && (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-4">Branch Performance</h3>
              <div className="w-full h-80 border rounded-md p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={getChartData()}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => formatCurrency(value as number)}
                    />
                    <Legend />
                    <Bar dataKey="writeOffs" name="Write-offs" fill="#8884d8" />
                    <Bar dataKey="ninetyPlus" name="90+ Days" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Time Series Chart for Weekly/Monthly Views */}
          {consolidatedData &&
            (viewType === "weekly" || viewType === "monthly") && (
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-4">
                  {viewType === "weekly" ? "Daily Trends" : "Weekly Trends"}
                </h3>
                <div className="w-full h-80 border rounded-md p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={getTimeSeriesData()}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey={viewType === "weekly" ? "date" : "week"}
                      />
                      <YAxis />
                      <Tooltip
                        formatter={(value) => formatCurrency(value as number)}
                      />
                      <Legend />
                      <Bar
                        dataKey="writeOffs"
                        name="Write-offs"
                        fill="#8884d8"
                      />
                      <Bar
                        dataKey="ninetyPlus"
                        name="90+ Days"
                        fill="#82ca9d"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

          {/* Branch Status Table */}
          {consolidatedData && (
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
                      <TableHead className="whitespace-nowrap text-right">
                        90+ Days
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-center">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(consolidatedData?.branches || []).map((branch) => (
                      <TableRow key={branch.branch}>
                        <TableCell className="whitespace-nowrap font-medium">
                          {branch.branch}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {formatCurrency(branch.writeOffs)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {formatCurrency(branch.ninetyPlus)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-center">
                          {branch.reported ? (
                            <Badge className="bg-green-500">Reported</Badge>
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
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* No Data Message */}
          {!consolidatedData && !isLoading && (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="text-muted-foreground mb-2">
                No data to display
              </div>
              <p className="text-sm text-muted-foreground">
                Select a date and view type, then click Generate to view the
                report.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
