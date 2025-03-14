"use client";

import { ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn, formatKHRCurrency } from "@/lib/utils";
import { TooltipProps } from "../types";

export const CustomTimeTooltip = ({ active, payload }: TooltipProps) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
      <div className="font-medium mb-2">{data.date}</div>
      <div className="border-t border-gray-200 dark:border-gray-700 my-2" />

      {payload.map((entry, index) => (
        <div key={`item-${index}`} className="py-1">
          <div className="flex justify-between items-center">
            <span className="flex items-center text-sm">
              <div
                className="w-2 h-2 rounded-full mr-1"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}:
            </span>
            <span className="font-medium text-sm">
              {formatKHRCurrency(entry.value as number)}
            </span>
          </div>

          {entry.dataKey === "writeOffs" && data.writeOffsChange && (
            <div className="text-xs flex justify-between mt-1">
              <span>Change:</span>
              <span
                className={cn(
                  "flex items-center",
                  parseFloat(data.writeOffsChange as string) > 0
                    ? "text-red-600 dark:text-red-400"
                    : parseFloat(data.writeOffsChange as string) < 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-500"
                )}
              >
                {parseFloat(data.writeOffsChange as string) > 0 && (
                  <TrendingUp className="h-3 w-3 mr-1" />
                )}
                {parseFloat(data.writeOffsChange as string) < 0 && (
                  <TrendingDown className="h-3 w-3 mr-1" />
                )}
                {parseFloat(data.writeOffsChange as string) === 0 && (
                  <Minus className="h-3 w-3 mr-1" />
                )}
                {parseFloat(data.writeOffsChange as string) > 0 ? "+" : ""}
                {data.writeOffsChange}%
              </span>
            </div>
          )}

          {entry.dataKey === "ninetyPlus" && data.ninetyPlusChange && (
            <div className="text-xs flex justify-between mt-1">
              <span>Change:</span>
              <span
                className={cn(
                  "flex items-center",
                  parseFloat(data.ninetyPlusChange as string) > 0
                    ? "text-red-600 dark:text-red-400"
                    : parseFloat(data.ninetyPlusChange as string) < 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-500"
                )}
              >
                {parseFloat(data.ninetyPlusChange as string) > 0 && (
                  <TrendingUp className="h-3 w-3 mr-1" />
                )}
                {parseFloat(data.ninetyPlusChange as string) < 0 && (
                  <TrendingDown className="h-3 w-3 mr-1" />
                )}
                {parseFloat(data.ninetyPlusChange as string) === 0 && (
                  <Minus className="h-3 w-3 mr-1" />
                )}
                {parseFloat(data.ninetyPlusChange as string) > 0 ? "+" : ""}
                {data.ninetyPlusChange}%
              </span>
            </div>
          )}
        </div>
      ))}

      <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
      <div className="flex justify-between text-xs text-gray-500">
        <span>Reports:</span>
        <span>{data.count} submitted</span>
      </div>
      <div className="text-xs text-blue-600 dark:text-blue-400 mt-2 flex justify-center items-center cursor-pointer">
        <ArrowRight className="h-3 w-3 mr-1" /> View trend details
      </div>
    </div>
  );
};
