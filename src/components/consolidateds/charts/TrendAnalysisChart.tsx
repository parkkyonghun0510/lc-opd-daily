"use client";

import {
  LineChart,
  Line,
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
import { ConsolidatedData, TimeSeriesDataPoint } from "../types/consolidated-types";

interface TrendAnalysisChartProps {
  data: ConsolidatedData;
  collapsed: boolean;
  onToggleCollapse: () => void;
  chartRef?: React.RefObject<HTMLDivElement>;
}

export function TrendAnalysisChart({
  data,
  collapsed,
  onToggleCollapse,
  chartRef,
}: TrendAnalysisChartProps) {
  const getFormattedData = (): TimeSeriesDataPoint[] => {
    if (!data.historicalData || !data.historicalData.length) return [];

    return data.historicalData.map((item) => ({
      date: item.date,
      rawDate: null,
      writeOffs: item.writeOffs,
      ninetyPlus: item.ninetyPlus,
      count: item.count,
      writeOffsChange: null,
      ninetyPlusChange: null,
      avgWriteOffs: 0,
      avgNinetyPlus: 0,
      writeOffsTrend: "stable",
      ninetyPlusTrend: "stable",
    })).reverse(); // Reverse to show oldest to newest
  };

  const chartData = getFormattedData();

  if (!data.historicalData || data.historicalData.length === 0) return null;

  return (
    <div
      className="mt-6 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-all duration-300"
      ref={chartRef}
    >
      <div
        className="bg-gray-50 dark:bg-gray-800 p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
        onClick={onToggleCollapse}
      >
        <h3 className="text-lg font-medium">Trend Analysis</h3>
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
        <div className="w-full h-[300px] sm:h-[400px] p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip
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
            Trend over time showing write-offs and 90+ days outstanding amounts
          </div>
        </div>
      </div>
    </div>
  );
}