"use client";

import { Eye, EyeOff, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MetricTogglesProps {
  visibleMetrics: {
    writeOffs: boolean;
    ninetyPlus: boolean;
  };
  showYearOverYear: boolean;
  onToggleMetric: (metric: "writeOffs" | "ninetyPlus") => void;
  onToggleYearOverYear: () => void;
}

export function MetricToggles({
  visibleMetrics,
  showYearOverYear,
  onToggleMetric,
  onToggleYearOverYear,
}: MetricTogglesProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <Button
        variant={visibleMetrics.writeOffs ? "default" : "outline"}
        size="sm"
        onClick={() => onToggleMetric("writeOffs")}
        className={cn(
          "h-9 text-sm flex-1 sm:flex-initial",
          visibleMetrics.writeOffs ? "bg-blue-600 hover:bg-blue-700" : ""
        )}
      >
        {visibleMetrics.writeOffs ? (
          <Eye className="h-4 w-4 mr-1" />
        ) : (
          <EyeOff className="h-4 w-4 mr-1" />
        )}
        Write-offs
      </Button>
      <Button
        variant={visibleMetrics.ninetyPlus ? "default" : "outline"}
        size="sm"
        onClick={() => onToggleMetric("ninetyPlus")}
        className={cn(
          "h-9 text-sm flex-1 sm:flex-initial",
          visibleMetrics.ninetyPlus ? "bg-green-600 hover:bg-green-700" : ""
        )}
      >
        {visibleMetrics.ninetyPlus ? (
          <Eye className="h-4 w-4 mr-1" />
        ) : (
          <EyeOff className="h-4 w-4 mr-1" />
        )}
        90+ Days
      </Button>
      <Button
        variant={showYearOverYear ? "default" : "outline"}
        size="sm"
        onClick={onToggleYearOverYear}
        className={cn(
          "h-9 text-sm flex-1 sm:flex-initial",
          showYearOverYear ? "bg-purple-600 hover:bg-purple-700" : ""
        )}
      >
        <BarChart2 className="h-4 w-4 mr-1" />
        Year-over-Year
      </Button>
    </div>
  );
}