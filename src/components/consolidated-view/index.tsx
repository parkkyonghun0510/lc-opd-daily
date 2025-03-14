"use client";

import React, { useState, useEffect, useCallback } from "react";
import { format, subDays, subWeeks, subMonths } from "date-fns";
import {
  Calendar,
  Download,
  FileSpreadsheet,
  RefreshCw,
  ArrowUpDown,
  AlertCircle,
  FileText as FilePdf,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

// Import types
import { ConsolidatedData, FilterState, DateRangeState } from "./types";

// Import charts
import { BranchComparisonChart } from "./charts/BranchComparisonChart";
import { TimeSeriesChart } from "./charts/TimeSeriesChart";

// Import metrics
import { MetricCard } from "./metrics/MetricCard";

// Import filters
import { BranchFilters } from "./filters/BranchFilters";

// Import modals
import { BranchDetailsModal } from "./modals/BranchDetailsModal";

// Import utils
import {
  getFilteredBranchData,
  getFilteredChartData,
  getTimeSeriesData,
  getComparisonData,
  getYearOverYearData,
} from "./utils/dataTransformers";
import { ChartSkeleton } from "./skeletons/ChartSkeleton";
import { MetricCardSkeleton } from "./skeletons/MetricCardSkeleton";

// Add mock API functions (these would be replaced with real API calls)
// Mock function to generate consolidated data
const fetchConsolidatedData = async (
  fromDate: string,
  toDate: string
): Promise<ConsolidatedData> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Generate random data for demo purposes
  const branchCount = 10;
  const branches = Array.from({ length: branchCount }).map((_, index) => ({
    branchId: `branch-${index + 1}`,
    branchCode: `B${index + 1}`.padStart(4, "0"),
    branchName: `Branch ${index + 1}`,
    writeOffs: Math.floor(Math.random() * 1000000) + 50000,
    ninetyPlus: Math.floor(Math.random() * 500000) + 20000,
    reportsCount: Math.floor(Math.random() * 30) + 1,
    hasReports: Math.random() > 0.2, // 80% chance of having reports
    region: ["North", "South", "East", "West", "Central"][
      Math.floor(Math.random() * 5)
    ],
    size: ["small", "medium", "large"][Math.floor(Math.random() * 3)] as
      | "small"
      | "medium"
      | "large",
  }));

  // Calculate totals
  const totalWriteOffs = branches.reduce(
    (sum, branch) => sum + branch.writeOffs,
    0
  );
  const totalNinetyPlus = branches.reduce(
    (sum, branch) => sum + branch.ninetyPlus,
    0
  );
  const reportedBranches = branches.filter((b) => b.hasReports).length;

  // Generate historical data
  const days = 7;
  const historicalData = Array.from({ length: days }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - index));

    return {
      date: format(date, "yyyy-MM-dd"),
      writeOffs: Math.floor(Math.random() * 1000000) + 50000,
      ninetyPlus: Math.floor(Math.random() * 500000) + 20000,
      count:
        Math.floor(Math.random() * branchCount) + Math.floor(branchCount * 0.7),
    };
  });

  // Return formatted data with correct typings
  return {
    period: {
      start: fromDate,
      end: toDate,
      type: "week", // Fixed to a valid literal type instead of string
    },
    metrics: {
      totalWriteOffs,
      totalNinetyPlus,
      reportedBranches,
      totalBranches: branchCount,
      coveragePercentage: (reportedBranches / branchCount) * 100,
      // Add fields that are being accessed by MetricCard
      previousTotalWriteOffs: totalWriteOffs * 0.9,
      previousTotalNinetyPlus: totalNinetyPlus * 0.95,
      writeOffsChange: 10,
      ninetyPlusChange: 5,
      previousSubmissionRate: (reportedBranches / branchCount) * 100 * 0.9,
    },
    missingBranches: branches
      .filter((b) => !b.hasReports)
      .map((b) => ({ id: b.branchId, code: b.branchCode, name: b.branchName })),
    branchData: branches,
    historicalData,
  };
};

// Mock function to fetch plan data
const fetchPlanData = async (
  fromDate: string,
  toDate: string
): Promise<ConsolidatedData> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Get the actual data first
  const actualData = await fetchConsolidatedData(fromDate, toDate);

  // Modify it slightly to create plan data
  const planData: ConsolidatedData = {
    ...actualData,
    branchData: actualData.branchData.map((branch) => ({
      ...branch,
      writeOffs: branch.writeOffs * 0.9, // Plan is 90% of actual
      ninetyPlus: branch.ninetyPlus * 0.85, // Plan is 85% of actual
    })),
    metrics: {
      ...actualData.metrics,
      totalWriteOffs: actualData.metrics.totalWriteOffs * 0.9,
      totalNinetyPlus: actualData.metrics.totalNinetyPlus * 0.85,
    },
  };

  return planData;
};

// DateRangePicker component for custom date selection
const DateRangePicker = ({
  from,
  to,
  onSelect,
}: {
  from: Date | undefined;
  to: Date | undefined;
  onSelect: (range: DateRangeState) => void;
}) => {
  return (
    <div className="flex flex-col space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start text-left font-normal"
          >
            <Calendar className="mr-2 h-4 w-4" />
            {from && to ? (
              <>
                {format(from, "MMM dd, yyyy")} - {format(to, "MMM dd, yyyy")}
              </>
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComponent
            initialFocus
            mode="range"
            defaultMonth={from}
            selected={{
              from,
              to,
            }}
            onSelect={(selectedRange) => {
              onSelect({
                from: selectedRange?.from,
                to: selectedRange?.to,
              });
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

const ConsolidatedView: React.FC = () => {
  // State
  const [consolidatedData, setConsolidatedData] =
    useState<ConsolidatedData | null>(null);
  const [planData, setPlanData] = useState<ConsolidatedData | null>(null);
  const [period, setPeriod] = useState<string>("week");
  const [reportType, setReportType] = useState<string>("actual");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    region: "all",
    size: "all",
    search: "",
  });

  // Date range state
  const [dateRange, setDateRange] = useState<DateRangeState>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });

  // Modal state
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState<boolean>(false);

  const { toast } = useToast();

  // Fetch data based on period and report type
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Determine date range based on period
      let fromDate = new Date();
      let toDate = new Date();

      switch (period) {
        case "day":
          fromDate = subDays(new Date(), 1);
          break;
        case "week":
          fromDate = subWeeks(new Date(), 1);
          break;
        case "month":
          fromDate = subMonths(new Date(), 1);
          break;
        case "quarter":
          fromDate = subMonths(new Date(), 3);
          break;
        case "custom":
          // Check if from/to dates are defined before assigning
          if (dateRange.from) fromDate = dateRange.from;
          if (dateRange.to) toDate = dateRange.to;
          break;
      }

      // Format dates for API
      const formattedFromDate = format(fromDate, "yyyy-MM-dd");
      const formattedToDate = format(toDate, "yyyy-MM-dd");

      // Fetch actual data
      const actualData = await fetchConsolidatedData(
        formattedFromDate,
        formattedToDate
      );
      setConsolidatedData(actualData);

      // Fetch plan data if needed
      if (reportType === "plan" || reportType === "comparison") {
        const planDataResult = await fetchPlanData(
          formattedFromDate,
          formattedToDate
        );
        setPlanData(planDataResult);
      }
    } catch (err) {
      setError("Failed to fetch data. Please try again later.");
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, [period, reportType, dateRange]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle period change
  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
  };

  // Handle report type change
  const handleReportTypeChange = (newReportType: string) => {
    setReportType(newReportType);
  };

  // Handle filter changes
  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  // Handle branch click to open details modal
  const handleBranchClick = (branchId: string) => {
    setSelectedBranchId(branchId);
    setDetailsModalOpen(true);
  };

  // Handle date range change
  const handleDateRangeChange = (range: DateRangeState) => {
    setDateRange(range);
    if (range.from && range.to) {
      setPeriod("custom");
    }
  };

  // Handle export to Excel
  const handleExportExcel = () => {
    if (!consolidatedData) {
      toast({
        title: "No data to export",
        description: "Please wait for data to load before exporting.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Export to Excel",
      description: "Excel export functionality is not implemented in the demo.",
      duration: 3000,
    });
  };

  // Handle export to PDF
  const handleExportPDF = () => {
    if (!consolidatedData) {
      toast({
        title: "No data to export",
        description: "Please wait for data to load before exporting.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Export to PDF",
      description: "PDF export functionality is not implemented in the demo.",
      duration: 3000,
    });
  };

  // Generate report
  const handleGenerateReport = () => {
    toast({
      title: "Generate Report",
      description:
        "Report generation functionality is not implemented in the demo.",
      duration: 3000,
    });
  };

  // Get filtered data
  const filteredBranches = consolidatedData
    ? getFilteredBranchData(consolidatedData, filters)
    : [];

  const filteredChartData = consolidatedData
    ? getFilteredChartData(consolidatedData, filters)
    : [];

  const timeSeriesData = consolidatedData
    ? getTimeSeriesData(consolidatedData)
    : [];

  const comparisonData =
    consolidatedData && planData
      ? getComparisonData(consolidatedData, planData)
      : [];

  const yearOverYearData = consolidatedData
    ? getYearOverYearData(consolidatedData)
    : [];

  // Total counts for metrics
  const totalBranches = filteredBranches.length;
  const branchesWithReports = filteredBranches.filter(
    (b) => b.hasReports
  ).length;
  // Calculate submission rate
  const submissionRate =
    totalBranches > 0 ? (branchesWithReports / totalBranches) * 100 : 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Daily Reports Dashboard
          </h1>
          <p className="text-muted-foreground">
            Consolidated view of branch performance metrics and reports
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>

          <Button variant="outline" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Excel
          </Button>

          <Button variant="outline" onClick={handleExportPDF}>
            <FilePdf className="h-4 w-4 mr-2" />
            Export PDF
          </Button>

          <Button onClick={handleGenerateReport}>
            <Download className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      <Separator />

      {/* Error alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filter and period controls */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col space-y-4">
            {/* Time period selector */}
            <Tabs
              defaultValue="week"
              value={period}
              onValueChange={handlePeriodChange}
              className="w-full"
            >
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-4">
                <TabsList>
                  <TabsTrigger value="day">Day</TabsTrigger>
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="month">Month</TabsTrigger>
                  <TabsTrigger value="quarter">Quarter</TabsTrigger>
                  <TabsTrigger value="custom">Custom</TabsTrigger>
                </TabsList>

                {/* Report type selector */}
                <Tabs
                  defaultValue="actual"
                  value={reportType}
                  onValueChange={handleReportTypeChange}
                >
                  <TabsList>
                    <TabsTrigger value="actual">Actual</TabsTrigger>
                    <TabsTrigger value="plan">Plan</TabsTrigger>
                    <TabsTrigger value="comparison">Comparison</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Custom date range picker */}
              {period === "custom" && (
                <div className="mb-4">
                  <DateRangePicker
                    from={dateRange.from}
                    to={dateRange.to}
                    onSelect={handleDateRangeChange}
                  />
                </div>
              )}
            </Tabs>

            {/* Branch filters */}
            <BranchFilters
              branches={consolidatedData?.branchData || []}
              filters={filters}
              onFiltersChange={handleFiltersChange}
              loading={loading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              title="Write-Offs"
              value={consolidatedData?.metrics.totalWriteOffs || 0}
              previousValue={consolidatedData?.metrics.previousTotalWriteOffs}
              change={consolidatedData?.metrics.writeOffsChange}
              changePeriod={`vs previous ${period}`}
              icon={<ArrowUpDown className="h-4 w-4" />}
              inverseColors={true}
            />

            <MetricCard
              title="90+ Days"
              value={consolidatedData?.metrics.totalNinetyPlus || 0}
              previousValue={consolidatedData?.metrics.previousTotalNinetyPlus}
              change={consolidatedData?.metrics.ninetyPlusChange}
              changePeriod={`vs previous ${period}`}
              icon={<ArrowUpDown className="h-4 w-4" />}
              inverseColors={true}
            />

            <MetricCard
              title="Branches Reported"
              value={branchesWithReports || 0}
              percentageOf={totalBranches}
              showBadge={true}
              currency={false}
              icon={<AlertCircle className="h-4 w-4" />}
            />

            <MetricCard
              title="Submission Rate"
              value={submissionRate || 0}
              currency={false}
              change={
                consolidatedData?.metrics.previousSubmissionRate !== undefined
                  ? submissionRate -
                    (consolidatedData?.metrics.previousSubmissionRate || 0)
                  : undefined
              }
              changePeriod={`vs previous ${period}`}
              icon={<Calendar className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branch comparison chart */}
        {loading ? (
          <ChartSkeleton />
        ) : (
          <BranchComparisonChart
            data={filteredChartData}
            loading={loading}
            title="Branch Comparison"
            onBarClick={handleBranchClick}
          />
        )}

        {/* Time series chart */}
        {loading ? (
          <ChartSkeleton />
        ) : (
          <TimeSeriesChart
            data={timeSeriesData}
            loading={loading}
            title="Historical Trend"
          />
        )}

        {/* Additional charts based on report type */}
        {reportType === "comparison" &&
          !loading &&
          comparisonData.length > 0 && (
            <BranchComparisonChart
              data={comparisonData}
              loading={loading}
              title="Plan vs Actual Comparison"
              onBarClick={handleBranchClick}
            />
          )}

        {reportType === "comparison" &&
          !loading &&
          yearOverYearData.length > 0 && (
            <TimeSeriesChart
              data={yearOverYearData}
              loading={loading}
              title="Year over Year Comparison"
              showYearOverYear={true}
            />
          )}
      </div>

      {/* Branch details modal */}
      <BranchDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        branchId={selectedBranchId}
        consolidatedData={consolidatedData}
        planData={planData}
        reportType={reportType}
      />
    </div>
  );
};

export default ConsolidatedView;
