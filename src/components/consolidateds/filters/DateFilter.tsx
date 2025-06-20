"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "@radix-ui/react-icons";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DateFilterProps {
  date: Date | undefined;
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
  filterType: "single" | "range";
  onDateChange: (date: Date | undefined) => void;
  onDateRangeChange: (range: {
    from: Date | undefined;
    to: Date | undefined;
  }) => void;
  onFilterTypeChange: (type: "single" | "range") => void;
}

export function DateFilter({
  date,
  dateRange,
  filterType,
  onDateChange,
  onDateRangeChange,
  onFilterTypeChange,
}: DateFilterProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-0">
          Filter by:
        </span>
        <Tabs
          value={filterType}
          onValueChange={(value: string) => {
            if (value === "single" || value === "range") {
              onFilterTypeChange(value);
            }
          }}
          className="w-full sm:w-auto"
        >
          <TabsList className="w-full sm:w-auto dark:bg-gray-800">
            <TabsTrigger
              value="single"
              className="flex-1 dark:data-[state=active]:bg-gray-700"
            >
              Single Date
            </TabsTrigger>
            <TabsTrigger
              value="range"
              className="flex-1 dark:data-[state=active]:bg-gray-700"
            >
              Date Range
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex items-center w-full sm:w-auto">
        {filterType === "single" ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className="w-full sm:w-[240px] justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(newDate) => {
                  // Ensure we set a valid date or fallback to today
                  onDateChange(newDate || new Date());
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        ) : (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className="w-full sm:w-[300px] justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{
                  from: dateRange.from,
                  to: dateRange.to,
                }}
                onSelect={(range) => {
                  onDateRangeChange({
                    from: range?.from,
                    to: range?.to,
                  });
                }}
                numberOfMonths={2}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
