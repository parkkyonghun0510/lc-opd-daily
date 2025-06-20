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
import { ConsolidatedData } from "../types/consolidated-types";
import { formatKHRCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PlanVsActualChartProps {
  consolidatedData: ConsolidatedData;
  planData: ConsolidatedData;
}

interface ComparisonData {
  branch: string;
  actualWriteOffs: number;
  planWriteOffs: number;
  actualNinetyPlus: number;
  planNinetyPlus: number;
  writeOffsAchievement: number;
  ninetyPlusAchievement: number;
}

export function PlanVsActualChart({
  consolidatedData,
  planData,
}: PlanVsActualChartProps) {
  const getComparisonData = (): ComparisonData[] => {
    const comparisonData = consolidatedData.branchData.map((actualBranch) => {
      const planBranch = planData.branchData.find(
        (plan) => plan.branchId === actualBranch.branchId,
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
      (item) => item.planWriteOffs > 0 || item.planNinetyPlus > 0,
    );
  };

  const chartData = getComparisonData();

  const overallWriteOffsAchievement =
    planData.metrics.totalWriteOffs > 0
      ? (consolidatedData.metrics.totalWriteOffs /
          planData.metrics.totalWriteOffs) *
        100
      : 0;

  const overallNinetyPlusAchievement =
    planData.metrics.totalNinetyPlus > 0
      ? (consolidatedData.metrics.totalNinetyPlus /
          planData.metrics.totalNinetyPlus) *
        100
      : 0;

  return (
    <div className="mt-6">
      <h3 className="text-lg font-medium mb-4">Plan vs. Actual Comparison</h3>

      {/* Overall Achievement Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Write-offs Achievement
                </h4>
                <div className="flex items-baseline mt-1">
                  <span className="text-2xl font-bold">
                    {planData.metrics.totalWriteOffs > 0
                      ? `${overallWriteOffsAchievement.toFixed(1)}%`
                      : "N/A"}
                  </span>
                  <span className="ml-2 text-sm text-gray-500">
                    {formatKHRCurrency(consolidatedData.metrics.totalWriteOffs)}{" "}
                    / {formatKHRCurrency(planData.metrics.totalWriteOffs)}
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
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                )}
              >
                {planData.metrics.totalWriteOffs > 0
                  ? `${Math.round(overallWriteOffsAchievement)}%`
                  : "N/A"}
              </div>
            </div>
          </div>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  90+ Days Achievement
                </h4>
                <div className="flex items-baseline mt-1">
                  <span className="text-2xl font-bold">
                    {planData.metrics.totalNinetyPlus > 0
                      ? `${overallNinetyPlusAchievement.toFixed(1)}%`
                      : "N/A"}
                  </span>
                  <span className="ml-2 text-sm text-gray-500">
                    {formatKHRCurrency(
                      consolidatedData.metrics.totalNinetyPlus,
                    )}{" "}
                    / {formatKHRCurrency(planData.metrics.totalNinetyPlus)}
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
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                )}
              >
                {planData.metrics.totalNinetyPlus > 0
                  ? `${Math.round(overallNinetyPlusAchievement)}%`
                  : "N/A"}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Comparison Chart */}
      <div className="w-full h-80 border rounded-md p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="branch" />
            <YAxis />
            <Tooltip
              formatter={(value) => formatKHRCurrency(value as number)}
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
  );
}
