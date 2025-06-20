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
import { MetricToggles } from "../metrics/MetricToggles";
import { CustomBranchTooltip } from "../tooltips/CustomBranchTooltip";
import { ConsolidatedData } from "../types/consolidated-types";

interface BranchPerformanceChartProps {
  data: ConsolidatedData;
  collapsed: boolean;
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

export function BranchPerformanceChart({
  data,
  collapsed,
  onToggleCollapse,
  visibleMetrics,
  showYearOverYear,
  onToggleMetric,
  onToggleYearOverYear,
  onChartClick,
  chartRef,
}: BranchPerformanceChartProps) {
  const chartData = data.branchData.map((branch) => ({
    name: branch.branchCode,
    writeOffs: branch.writeOffs,
    ninetyPlus: branch.ninetyPlus,
    branchId: branch.branchId,
    branchName: branch.branchName,
    hasReports: branch.hasReports,
    reportsCount: branch.reportsCount,
    writeOffsPercentage: data.metrics.totalWriteOffs
      ? ((branch.writeOffs / data.metrics.totalWriteOffs) * 100).toFixed(1)
      : "0",
    ninetyPlusPercentage: data.metrics.totalNinetyPlus
      ? ((branch.ninetyPlus / data.metrics.totalNinetyPlus) * 100).toFixed(1)
      : "0",
  }));

  return (
    <div
      className="mt-6 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-all duration-300"
      ref={chartRef}
    >
      <div
        className="bg-gray-50 dark:bg-gray-800 p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
        onClick={onToggleCollapse}
      >
        <h3 className="text-lg font-medium">Branch Performance</h3>
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
          collapsed
            ? "max-h-0 opacity-0 overflow-hidden"
            : "max-h-[500px] opacity-100",
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
              margin={{ top: 20, right: 20, left: 0, bottom: 5 }}
              onClick={onChartClick}
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
              <Tooltip content={<CustomBranchTooltip />} />
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
  );
}
