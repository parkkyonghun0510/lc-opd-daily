"use client";

import React, { useMemo } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ChartData, TooltipProps } from "../types";
import { CustomBranchTooltip } from "../tooltips/CustomBranchTooltip";
import { formatKHRCurrency } from "../utils/formatters";
import { cn } from "../utils/helpers";

interface BranchComparisonChartProps {
  data: ChartData[];
  loading: boolean;
  className?: string;
  title?: string;
  onBarClick?: (branchId: string) => void;
}

export const BranchComparisonChart: React.FC<BranchComparisonChartProps> = ({
  data,
  loading,
  className,
  title = "Branch Comparison",
  onBarClick,
}) => {
  // Sort data by writeOffs in descending order
  const sortedData = useMemo(() => {
    if (!data) return [];
    return [...data].sort(
      (a, b) => (b.writeOffs as number) - (a.writeOffs as number)
    );
  }, [data]);

  // Format the y-axis ticks
  const formatYAxis = (value: number) => {
    return formatKHRCurrency(value);
  };

  // Handle bar click to open branch details
  const handleBarClick = (data: any, index: number) => {
    if (onBarClick && data.payload && data.payload.branchId) {
      onBarClick(data.payload.branchId);
    }
  };

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    return (
      <CustomBranchTooltip active={active} payload={payload} label={label} />
    );
  };

  return (
    <Card className={cn("w-full shadow-sm", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sortedData}
              margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={70}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickFormatter={formatYAxis}
                width={80}
                tick={{ fontSize: 12 }}
                interval={0}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "#f3f4f6" }}
              />
              <Legend
                wrapperStyle={{ paddingTop: 10 }}
                formatter={(value) => (
                  <span className="text-sm font-medium">{value}</span>
                )}
              />
              <Bar
                dataKey="writeOffs"
                name="Write-Offs"
                fill="#4f46e5"
                onClick={handleBarClick}
                cursor={onBarClick ? "pointer" : "default"}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="ninetyPlus"
                name="90+ Days"
                fill="#ec4899"
                onClick={handleBarClick}
                cursor={onBarClick ? "pointer" : "default"}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
