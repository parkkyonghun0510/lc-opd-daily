"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatKHRCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConsolidatedData } from "../types/consolidated-types";

interface MetricCardsProps {
  data: ConsolidatedData;
  onViewMissingBranches?: () => void;
}

export function MetricCards({ data, onViewMissingBranches }: MetricCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 transition-all duration-300 ease-in-out">
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200 overflow-hidden">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
              Total Write-offs
            </span>
            <span className="text-lg sm:text-xl md:text-2xl font-bold mt-2 transition-all duration-300 ease-in-out animate-in fade-in-50 slide-in-from-bottom-5">
              {formatKHRCurrency(data.metrics.totalWriteOffs)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200 overflow-hidden">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
              Total 90+ Days
            </span>
            <span
              className="text-lg sm:text-xl md:text-2xl font-bold mt-2 transition-all duration-300 ease-in-out animate-in fade-in-50 slide-in-from-bottom-5"
              style={{ animationDelay: "100ms" }}
            >
              {formatKHRCurrency(data.metrics.totalNinetyPlus)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Branch Coverage Card with Enhanced Visual Indicator */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200 overflow-hidden">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
              Branch Coverage
            </span>
            <div className="flex flex-col sm:flex-row sm:items-end mt-2">
              <span
                className="text-lg sm:text-xl md:text-2xl font-bold transition-all duration-300 ease-in-out animate-in fade-in-50 slide-in-from-bottom-5"
                style={{ animationDelay: "200ms" }}
              >
                {data.metrics.reportedBranches}/{data.metrics.totalBranches}
              </span>
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 sm:ml-2 sm:mb-1">
                ({Math.round(data.metrics.coveragePercentage)}%)
              </span>
            </div>

            {/* Visual progress indicator for branch coverage */}
            <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full mt-3 overflow-hidden relative">
              {/* Animated progress bar */}
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out-expo"
                style={{
                  width: `${data.metrics.coveragePercentage}%`,
                  backgroundColor:
                    data.metrics.coveragePercentage >= 80
                      ? "#10b981" // green for good coverage
                      : data.metrics.coveragePercentage >= 50
                        ? "#f59e0b" // amber for medium coverage
                        : "#ef4444", // red for poor coverage
                }}
              />

              {/* Milestone markers */}
              <div className="absolute top-0 left-0 w-full h-full flex items-center justify-between px-[3px]">
                {[25, 50, 75].map((milestone) => (
                  <div
                    key={milestone}
                    className="w-0.5 h-1/2 bg-gray-300 dark:bg-gray-600 rounded-full z-10"
                    style={{
                      left: `${milestone}%`,
                      transform: "translateX(-50%)",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Label for coverage quality */}
            <div className="mt-2 text-xs">
              <span
                className={`inline-block px-2 py-0.5 rounded-full font-medium ${
                  data.metrics.coveragePercentage >= 80
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : data.metrics.coveragePercentage >= 50
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                }`}
              >
                {data.metrics.coveragePercentage >= 80
                  ? "Good"
                  : data.metrics.coveragePercentage >= 50
                    ? "Average"
                    : "Poor"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200 overflow-hidden">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col">
            <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
              Missing Reports
            </span>
            <div className="flex flex-col sm:flex-row sm:items-end mt-2">
              <span
                className="text-lg sm:text-xl md:text-2xl font-bold transition-all duration-300 ease-in-out animate-in fade-in-50 slide-in-from-bottom-5"
                style={{ animationDelay: "300ms" }}
              >
                {data.missingBranches.length}
              </span>
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 sm:ml-2 sm:mb-1">
                branches
              </span>
            </div>

            {data.missingBranches.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                onClick={onViewMissingBranches}
              >
                View missing branches
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
