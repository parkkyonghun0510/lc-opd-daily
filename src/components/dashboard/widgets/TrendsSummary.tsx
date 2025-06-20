"use client";

import { formatKHRCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingDown,
  TrendingUp,
  Minus,
  BarChart2,
  Building,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendsSummaryProps {
  trends: {
    writeOffs: {
      average: number;
      trend: number;
      direction: "up" | "down" | "stable";
    };
    ninetyPlus: {
      average: number;
      trend: number;
      direction: "up" | "down" | "stable";
    };
    branchPerformance: Array<{
      branchId: string;
      averageWriteOffs: number;
      averageNinetyPlus: number;
      reportCount: number;
    }>;
  };
}

export function TrendsSummary({ trends }: TrendsSummaryProps) {
  const getTrendIcon = (direction: "up" | "down" | "stable") => {
    switch (direction) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendColor = (direction: "up" | "down" | "stable") => {
    switch (direction) {
      case "up":
        return "text-red-500";
      case "down":
        return "text-green-500";
      default:
        return "text-gray-500";
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Write-offs Trend Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Write-offs Trend
          </CardTitle>
          {getTrendIcon(trends.writeOffs.direction)}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatKHRCurrency(trends.writeOffs.average)}
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <p
              className={cn(
                "text-sm font-medium",
                getTrendColor(trends.writeOffs.direction),
              )}
            >
              {trends.writeOffs.trend.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500">avg. change</p>
          </div>
        </CardContent>
      </Card>

      {/* 90+ Days Trend Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">90+ Days Trend</CardTitle>
          {getTrendIcon(trends.ninetyPlus.direction)}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatKHRCurrency(trends.ninetyPlus.average)}
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <p
              className={cn(
                "text-sm font-medium",
                getTrendColor(trends.ninetyPlus.direction),
              )}
            >
              {trends.ninetyPlus.trend.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500">avg. change</p>
          </div>
        </CardContent>
      </Card>

      {/* Branch Performance Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Top Branches</CardTitle>
          <Building className="h-4 w-4 text-gray-500" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {trends.branchPerformance.length > 0 ? (
              trends.branchPerformance.map((branch, index) => (
                <div
                  key={branch.branchId}
                  className="flex items-center justify-between text-sm"
                >
                  <span
                    className="truncate flex-1"
                    title={`Branch ${branch.branchId}`}
                  >
                    Branch {branch.branchId}
                  </span>
                  <div className="flex items-center gap-2">
                    <BarChart2 className="h-3 w-3 text-gray-400" />
                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                      {formatKHRCurrency(branch.averageWriteOffs)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No branch data available</p>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Average write-offs by branch
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
