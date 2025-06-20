"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ReportTypeFilterProps {
  reportType: "plan" | "actual";
  onReportTypeChange: (value: "plan" | "actual") => void;
}

export function ReportTypeFilter({
  reportType,
  onReportTypeChange,
}: ReportTypeFilterProps) {
  return (
    <div className="flex items-center w-full sm:w-auto mt-3 sm:mt-0">
      <Tabs
        defaultValue={reportType}
        onValueChange={(v) => onReportTypeChange(v as "plan" | "actual")}
        className="w-full sm:w-auto"
      >
        <TabsList className="w-full sm:w-auto dark:bg-gray-800">
          <TabsTrigger
            value="plan"
            className="flex-1 dark:data-[state=active]:bg-gray-700"
          >
            Plan
          </TabsTrigger>
          <TabsTrigger
            value="actual"
            className="flex-1 dark:data-[state=active]:bg-gray-700"
          >
            Actual
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
