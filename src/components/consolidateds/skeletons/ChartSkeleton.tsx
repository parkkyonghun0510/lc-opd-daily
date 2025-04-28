"use client";

import { BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChartSkeletonProps {
  className?: string;
}

export function ChartSkeleton({ className }: ChartSkeletonProps) {
  return (
    <div className={cn("animate-pulse space-y-3", className)}>
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
      <div className="h-[300px] bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 flex items-center justify-center">
        <BarChart2 className="h-16 w-16 text-gray-300 dark:text-gray-600" />
      </div>
    </div>
  );
}