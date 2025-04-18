"use client";

import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { cn, formatKHRCurrency } from "@/lib/utils";
import { TooltipPayloadItem } from "../types/consolidated-types";

interface CustomBranchTooltipProps {
  active?: boolean;
  payload?: Array<TooltipPayloadItem>;
}

export function CustomBranchTooltip({ active, payload }: CustomBranchTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
      <div className="flex items-center space-x-2 mb-2">
        <div className="w-3 h-3 rounded-full bg-blue-500" />
        <span className="font-medium">
          {data.name} - {data.branchName}
        </span>
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
            <span className="font-medium text-sm">
              {formatKHRCurrency(entry.value)}
            </span>
          </div>

          {entry.dataKey === "writeOffs" && (
            <div className="text-xs text-gray-500 flex justify-between mt-1">
              <span>% of Total:</span>
              <Badge variant="outline" className="h-5 px-1 font-normal">
                {data.writeOffsPercentage}%
              </Badge>
            </div>
          )}

          {entry.dataKey === "ninetyPlus" && (
            <div className="text-xs text-gray-500 flex justify-between mt-1">
              <span>% of Total:</span>
              <Badge variant="outline" className="h-5 px-1 font-normal">
                {data.ninetyPlusPercentage}%
              </Badge>
            </div>
          )}
        </div>
      ))}

      <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
      <div className="flex justify-between text-xs text-gray-500">
        <span>Status:</span>
        <span>{data.hasReports ? "Reported" : "Missing"}</span>
      </div>
      <div className="text-xs text-blue-600 dark:text-blue-400 mt-2 flex justify-center items-center cursor-pointer">
        <ArrowRight className="h-3 w-3 mr-1" /> Click for details
      </div>
    </div>
  );
}