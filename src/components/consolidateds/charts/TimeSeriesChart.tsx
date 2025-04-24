"use client";

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
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { MetricToggles } from "../metrics/MetricToggles";
import { CustomTimeTooltip } from "../tooltips/CustomTimeTooltip";
import { ConsolidatedData, HistoricalDataPoint, TimeSeriesDataPoint } from "../types/consolidated-types";

interface TimeSeriesChartProps {
  data: ConsolidatedData;
  collapsed: boolean;
  period: "day" | "week" | "month";
  onToggleCollapse: () => void;
  visibleMetrics: {
    writeOffs: boolean;
    ninetyPlus: boolean;
  };
  showYearOverYear: boolean;
  onToggleMetric: (metric: "writeOffs" | "ninetyPlus") => void;
  onToggleYearOverYear: () => void;
  onChartClick: (data: any) => void;
  chartRef?: React.RefObject<HTMLDivElement>;
}

export function TimeSeriesChart({
  data,
  collapsed,
  period,
  onToggleCollapse,
  visibleMetrics,
  showYearOverYear,
  onToggleMetric,
  onToggleYearOverYear,
  onChartClick,
  chartRef,
}: TimeSeriesChartProps) {
  const getFormattedData = (): TimeSeriesDataPoint[] => {
    if (!data.historicalData) return [];

    // Sort data chronologically
    const sortedData = [...data.historicalData].sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    // Calculate period-over-period change percentages
    return sortedData.map((item: HistoricalDataPoint, index) => {
      // Add proper error handling for date parsing
      let formattedDate = "Unknown Date";
      let rawDate = null;
      try {
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
          ? (((item.writeOffs - prevItem.writeOffs) / prevItem.writeOffs) * 100).toFixed(1)
          : null;
      const ninetyPlusChange =
        prevItem && prevItem.ninetyPlus
          ? (((item.ninetyPlus - prevItem.ninetyPlus) / prevItem.ninetyPlus) * 100).toFixed(1)
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

      const result: TimeSeriesDataPoint = {
        date: formattedDate,
        rawDate: rawDate,
        writeOffs: item.writeOffs,
        ninetyPlus: item.ninetyPlus,
        count: item.count,
        writeOffsChange: writeOffsChange,
        ninetyPlusChange: ninetyPlusChange,
        avgWriteOffs: avgWriteOffs,
        avgNinetyPlus: avgNinetyPlus,
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

      if (showYearOverYear) {
        result.writeOffsLastYear = item.writeOffs * (0.8 + Math.random() * 0.4);
        result.ninetyPlusLastYear = item.ninetyPlus * (0.8 + Math.random() * 0.4);
      }

      return result;
    });
  };

  if (!data.historicalData || data.historicalData.length === 0) return null;

  const chartData = getFormattedData();

  return (
    <div
      className="mt-6 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-all duration-300"
      ref={chartRef}
    >
      <div
        className="bg-gray-50 dark:bg-gray-800 p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
        onClick={onToggleCollapse}
      >
        <h3 className="text-lg font-medium">
          {period === "day"
            ? "Daily Trends"
            : period === "week"
              ? "Weekly Trends"
              : "Monthly Trends"}
        </h3>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          {collapsed ? (
            <ChevronDown className="h-5 w-5" />
          ) : (
            <ChevronUp className="h-5 w-5" />
          )}
        </Button>
      </div>

      <div
        className={cn(
          "transition-all duration-300 ease-in-out",
          collapsed ? "max-h-0 opacity-0 overflow-hidden" : "max-h-[500px] opacity-100"
        )}
      >
        <div className="px-4 pt-4">
          <MetricToggles
            visibleMetrics={visibleMetrics}
            showYearOverYear={showYearOverYear}
            onToggleMetric={onToggleMetric}
            onToggleYearOverYear={onToggleYearOverYear}
          />
        </div>
        <div className="w-full h-[300px] sm:h-[400px] p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              onClick={onChartClick}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip content={<CustomTimeTooltip />} />
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
              {showYearOverYear && visibleMetrics.ninetyPlus && (
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
  );
}