import { format, parseISO } from "date-fns";
import {
  Branch,
  ChartData,
  ConsolidatedData,
  FilterState,
  HistoricalDataPoint,
} from "../types";

export const getFilteredBranchData = (
  consolidatedData: ConsolidatedData | null,
  filters: FilterState
): Branch[] => {
  if (!consolidatedData || !consolidatedData.branchData) return [];

  return consolidatedData.branchData.filter((branch) => {
    // Apply region filter
    if (filters.region !== "all" && branch.region !== filters.region) {
      return false;
    }

    // Apply size filter
    if (filters.size !== "all" && branch.size !== filters.size) {
      return false;
    }

    // Apply search filter
    if (
      filters.search &&
      !branch.branchName.toLowerCase().includes(filters.search.toLowerCase()) &&
      !branch.branchCode.toLowerCase().includes(filters.search.toLowerCase())
    ) {
      return false;
    }

    return true;
  });
};

export const getFilteredChartData = (
  consolidatedData: ConsolidatedData | null,
  filters: FilterState
): ChartData[] => {
  if (!consolidatedData) return [];

  const filteredData = getFilteredBranchData(consolidatedData, filters).map(
    (branch) => ({
      name: branch.branchCode,
      writeOffs: branch.writeOffs,
      ninetyPlus: branch.ninetyPlus,
      branchId: branch.branchId,
      branchName: branch.branchName,
      hasReports: branch.hasReports,
      reportsCount: branch.reportsCount,
      region: branch.region,
      size: branch.size,
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
    })
  );

  return filteredData;
};

export const getTimeSeriesData = (
  consolidatedData: ConsolidatedData | null
): ChartData[] => {
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
        rawDate = parseISO(item.date);
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
      name: formattedDate,
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

export const getComparisonData = (
  consolidatedData: ConsolidatedData | null,
  planData: ConsolidatedData | null
): ChartData[] => {
  if (!consolidatedData || !planData) return [];

  const comparisonData = consolidatedData.branchData.map((actualBranch) => {
    const planBranch = planData.branchData.find(
      (plan) => plan.branchId === actualBranch.branchId
    );

    return {
      name: actualBranch.branchCode,
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
      writeOffs: actualBranch.writeOffs,
      ninetyPlus: actualBranch.ninetyPlus,
    };
  });

  return comparisonData.filter(
    (item) =>
      (item.planWriteOffs as number) > 0 || (item.planNinetyPlus as number) > 0
  );
};

export const getYearOverYearData = (
  consolidatedData: ConsolidatedData | null
): ChartData[] => {
  if (!consolidatedData || !consolidatedData.historicalData) return [];

  // For demo purposes, we'll simulate last year's data
  // In a real app, you would fetch this from the API
  const thisYearData = getTimeSeriesData(consolidatedData);

  const lastYearData = thisYearData.map((item) => ({
    ...item,
    writeOffsLastYear: item.writeOffs * (0.8 + Math.random() * 0.4), // 80-120% of current value
    ninetyPlusLastYear: item.ninetyPlus * (0.8 + Math.random() * 0.4),
  }));

  return lastYearData;
};
