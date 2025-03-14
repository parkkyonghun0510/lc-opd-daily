"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ChartData, TooltipProps } from "../types";
import { CustomTimeTooltip } from "../tooltips/CustomTimeTooltip";
import { formatKHRCurrency } from "../utils/formatters";
import { cn } from "../utils/helpers";

interface TimeSeriesChartProps {
  data: ChartData[];
  loading: boolean;
  className?: string;
  title?: string;
  showYearOverYear?: boolean;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  data,
  loading,
  className,
  title = "Historical Trend",
  showYearOverYear = false,
}) => {
  // Format the y-axis ticks
  const formatYAxis = (value: number) => {
    return formatKHRCurrency(value);
  };

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    return (
      <CustomTimeTooltip active={active} payload={payload} label={label} />
    );
  };

  // Add a reference line at zero
  const minValue = Math.min(
    ...data.map((item) =>
      Math.min(Number(item.writeOffs), Number(item.ninetyPlus))
    )
  );

  const shouldShowReferenceLine = minValue < 0;

  return (
    <Card className={cn("w-full shadow-sm", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis
                tickFormatter={formatYAxis}
                width={80}
                tick={{ fontSize: 12 }}
              />
              {shouldShowReferenceLine && <ReferenceLine y={0} stroke="#666" />}
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: 10 }}
                formatter={(value) => (
                  <span className="text-sm font-medium">{value}</span>
                )}
              />
              <Line
                type="monotone"
                dataKey="writeOffs"
                name="Write-Offs"
                stroke="#4f46e5"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="ninetyPlus"
                name="90+ Days"
                stroke="#ec4899"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />

              {showYearOverYear && (
                <>
                  <Line
                    type="monotone"
                    dataKey="writeOffsLastYear"
                    name="Write-Offs Last Year"
                    stroke="#4f46e5"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ninetyPlusLastYear"
                    name="90+ Days Last Year"
                    stroke="#ec4899"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 3 }}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
