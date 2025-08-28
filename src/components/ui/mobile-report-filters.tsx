"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { 
  Calendar, 
  Filter, 
  X, 
  RefreshCw, 
  Loader2, 
  FileSpreadsheetIcon, 
  FileIcon,
  Save,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MobileStatusFilter } from "@/components/ui/mobile-status-filter";
import { MobileBranchSelector } from "@/components/ui/mobile-branch-selector";
import { MobileSelect } from "@/components/ui/mobile-select";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserData } from "@/contexts/UserDataContext";
import { cn } from "@/lib/utils";

interface FilterPreset {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  branchId?: string;
  userId?: string;
  reportType: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

interface MobileReportFiltersProps {
  startDate: Date | undefined;
  setStartDate: (date: Date | undefined) => void;
  endDate: Date | undefined;
  setEndDate: (date: Date | undefined) => void;
  selectedBranchId: string | undefined;
  setSelectedBranchId: (id: string | undefined) => void;
  selectedUserId: string | undefined;
  setSelectedUserId: (id: string | undefined) => void;
  reportType: string;
  setReportType: (type: string) => void;
  status: string | undefined;
  setStatus: (status: string | undefined) => void;
  handleFilter: () => void;
  clearFilters: () => void;
  exportToCSV: () => void;
  exportToPDF: () => void;
  isLoading: boolean;
  isExporting: boolean;
}

export function MobileReportFilters({
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  selectedBranchId,
  setSelectedBranchId,
  selectedUserId,
  setSelectedUserId,
  reportType,
  setReportType,
  status,
  setStatus,
  handleFilter,
  clearFilters,
  exportToCSV,
  exportToPDF,
  isLoading,
  isExporting,
}: MobileReportFiltersProps) {
  const { userData } = useUserData();
  const [showFilters, setShowFilters] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);

  const reportTypeOptions = [
    { value: "actual", label: "Actual Reports" },
    { value: "plan", label: "Plan Reports" },
  ];

  // Track if filters are applied
  useEffect(() => {
    const isFiltered =
      startDate !== undefined ||
      endDate !== undefined ||
      selectedBranchId !== undefined ||
      selectedUserId !== undefined ||
      status !== undefined;

    setFiltersApplied(isFiltered);
  }, [startDate, endDate, selectedBranchId, selectedUserId, status]);

  const handleDateRangeSelect = (range: { from?: Date; to?: Date } | undefined) => {
    setStartDate(range?.from);
    setEndDate(range?.to);
  };

  const dateRange = {
    from: startDate,
    to: endDate,
  };

  const handleClearFilters = () => {
    clearFilters();
    setShowFilters(false);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Report Filters
            {filtersApplied && (
              <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                Active
              </span>
            )}
          </CardTitle>
          
          <Button
            variant="ghost"
            size="sm"
            className="min-h-[44px] md:min-h-[36px]"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Settings className="h-4 w-4 mr-2" />
            {showFilters ? "Hide" : "Show"} Filters
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {showFilters && (
          <div className="space-y-6">
            {/* Date Range Filter */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Date Range
              </label>
              <DatePickerWithRange
                date={dateRange}
                setDate={handleDateRangeSelect}
                className="w-full"
              />
            </div>

            {/* Branch Filter */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Branch
              </label>
              <MobileBranchSelector
                userId={userData?.id || ""}
                value={selectedBranchId}
                onChange={(id) => setSelectedBranchId(id || undefined)}
                placeholder="All My Branches"
                showAllOption={true}
                hierarchical={true}
              />
            </div>

            {/* User Filter (Admin only) */}
            {userData?.role === "ADMIN" && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Submitted By
                </label>
                <Input
                  placeholder="All users"
                  value={selectedUserId || ""}
                  onChange={(e) => setSelectedUserId(e.target.value || undefined)}
                  className="min-h-[44px] md:min-h-[36px]"
                />
              </div>
            )}

            {/* Report Type Filter */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Report Type
              </label>
              <MobileSelect
                value={reportType}
                onValueChange={setReportType}
                options={reportTypeOptions}
                placeholder="Choose report type"
                className="w-full"
                aria-label="Select report type"
              />
            </div>

            {/* Status Filter */}
            <MobileStatusFilter
              value={status}
              onChange={setStatus}
              placeholder="Choose status"
              showAnyOption={true}
            />

            {/* Filter Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleClearFilters}
                className="flex items-center justify-center min-h-[44px] md:min-h-[36px]"
                disabled={!filtersApplied}
              >
                <X className="mr-2 h-4 w-4" />
                Clear Filters
              </Button>

              <Button
                onClick={handleFilter}
                disabled={isLoading}
                className="flex items-center justify-center min-h-[44px] md:min-h-[36px] flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Apply Filters
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Quick Actions - Always visible */}
        <div className="space-y-3 pt-4 border-t">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Export Options
          </h4>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={isExporting}
              className="flex items-center justify-center min-h-[44px] md:min-h-[36px] flex-1"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <FileSpreadsheetIcon className="mr-2 h-4 w-4" />
                  Export CSV
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={exportToPDF}
              disabled={isExporting}
              className="flex items-center justify-center min-h-[44px] md:min-h-[36px] flex-1"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <FileIcon className="mr-2 h-4 w-4" />
                  Export PDF
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Active Filters Summary */}
        {filtersApplied && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <h4 className="text-sm font-medium">Active Filters:</h4>
            <div className="flex flex-wrap gap-2">
              {startDate && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                  From: {format(startDate, "MMM d, yyyy")}
                </span>
              )}
              {endDate && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                  To: {format(endDate, "MMM d, yyyy")}
                </span>
              )}
              {selectedBranchId && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                  Branch Selected
                </span>
              )}
              {status && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                  Status: {status.replace("_", " ")}
                </span>
              )}
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                Type: {reportType === "actual" ? "Actual" : "Plan"}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}