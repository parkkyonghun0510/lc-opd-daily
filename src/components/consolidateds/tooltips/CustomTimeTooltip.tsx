"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";
import { TooltipPayloadItem } from "../types/consolidated-types";

interface CustomTimeTooltipProps {
  active?: boolean;
  payload?: Array<TooltipPayloadItem>;
}

export function CustomTimeTooltip({ active, payload }: CustomTimeTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
      <div className="flex items-center space-x-2 mb-2">
        <div className="w-3 h-3 rounded-full bg-blue-500" />
        <span className="font-medium">{data.date}</span>
      </div>
      <div className="border-t border-gray-200 dark:border-gray-700 my-2" />

      {payload.map((entry: TooltipPayloadItem, index: number) => (
        <div key={`item-${index}`} className="py-1">
          <div className="flex justify-between items-center">
            <span className="flex items-center text-sm">
              <div
                className="w-2 h-2 rounded-full mr-1"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}:
            </span>
            <span
              className={cn(
                "flex items-center",
                (data.writeOffsChange || 0) > 0
                  ? "text-red-600 dark:text-red-400"
                  : (data.writeOffsChange || 0) < 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-500"
              )}
            >
              {(data.writeOffsChange || 0) > 0 && (
                <TrendingUp className="h-3 w-3 mr-1" />
              )}
              {(data.writeOffsChange || 0) < 0 && (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {(data.writeOffsChange || 0) === 0 && (
                <Minus className="h-3 w-3 mr-1" />
              )}
              {(data.writeOffsChange || 0) > 0 ? "+" : ""}
              {data.writeOffsChange || 0}%
            </span>
          </div>

          {entry.dataKey === "ninetyPlus" && data.ninetyPlusChange && (
            <div className="text-xs flex justify-between mt-1">
              <span>Change:</span>
              <span
                className={cn(
                  "flex items-center",
                  (data.ninetyPlusChange || 0) > 0
                    ? "text-red-600 dark:text-red-400"
                    : (data.ninetyPlusChange || 0) < 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-gray-500"
                )}
              >
                {(data.ninetyPlusChange || 0) > 0 && (
                  <TrendingUp className="h-3 w-3 mr-1" />
                )}
                {(data.ninetyPlusChange || 0) < 0 && (
                  <TrendingDown className="h-3 w-3 mr-1" />
                )}
                {(data.ninetyPlusChange || 0) === 0 && (
                  <Minus className="h-3 w-3 mr-1" />
                )}
                {(data.ninetyPlusChange || 0) > 0 ? "+" : ""}
                {data.ninetyPlusChange || 0}%
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
}