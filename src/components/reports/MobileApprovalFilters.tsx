"use client";

import { useState } from "react";
import { format } from "date-fns";
import { 
  Calendar, 
  Filter, 
  Search, 
  FilterX,
  SortAsc,
  SortDesc,
  Settings,
  Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MobileSelect } from "@/components/ui/mobile-select";
import { MobileStatusFilter } from "@/components/ui/mobile-status-filter";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { cn } from "@/lib/utils";

// Types - flexible to work with existing reducers
export type FilterState = {
  searchTerm: string;
  branchFilter: string;
  reportTypeFilter: string;
  statusFilter: string;
  dateRange: {
    from?: Date;
    to?: Date;
  };
  sortField: string; // More flexible than union type
  sortDirection: 'asc' | 'desc';
  currentPage: number;
};

interface Branch {
  id: string;
  name: string;
  code?: string; // Make code optional to match the existing interface
}

interface MobileApprovalFiltersProps {
  filters: FilterState;
  onFilterChange: (filterType: string, value: any) => void;
  onResetFilters: () => void;
  onToggleSortDirection: () => void;
  onSetSortField: (field: string) => void;
  branches: Record<string, Branch>;
  resultsCount: number;
  currentPage: number;
  totalPages: number;
  className?: string;
}

const sortOptions = {
  date: 'Report Date',
  created: 'Submission Date',
  branch: 'Branch',
  writeOffs: 'Write-offs',
  ninetyPlus: '90+ Days'
} as const;

const reportTypeOptions = [
  { value: "all", label: "All Types" },
  { value: "plan", label: "Plan" },
  { value: "actual", label: "Actual" },
];

const statusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' }
];

export function MobileApprovalFilters({
  filters,
  onFilterChange,
  onResetFilters,
  onToggleSortDirection,
  onSetSortField,
  branches,
  resultsCount,
  currentPage,
  totalPages,
  className,
}: MobileApprovalFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  // Create branch options
  const branchOptions = [
    { value: "all", label: "All Branches" },
    ...Object.values(branches)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((branch) => ({
        value: branch.id,
        label: branch.code ? `${branch.name} (${branch.code})` : branch.name,
      })),
  ];

  // Create sort options for select
  const sortSelectOptions = Object.entries(sortOptions).map(([key, label]) => ({
    value: key,
    label,
  }));

  const handleDateRangeSelect = (range: { from?: Date; to?: Date } | undefined) => {
    onFilterChange('dateRange', range);
  };

  const hasActiveFilters = 
    filters.searchTerm !== "" ||
    filters.branchFilter !== "all" ||
    filters.reportTypeFilter !== "all" ||
    filters.statusFilter !== "pending_approval" ||
    filters.dateRange?.from ||
    filters.dateRange?.to;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-md flex items-center">
            <Filter className="h-4 w-4 mr-2" aria-hidden="true" />
            Filter Reports
            {hasActiveFilters && (
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
        <div className="text-sm text-muted-foreground">
          Filter reports by status, branch, type, and date range
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search - Always visible */}
        <div className="flex items-center space-x-2">
          <Search className="h-4 w-4 text-gray-500" aria-hidden="true" />
          <Input
            placeholder="Search branch, user..."
            value={filters.searchTerm}
            onChange={(e) => onFilterChange('search', e.target.value)}
            className="flex-1 min-h-[44px] md:min-h-[36px]"
            aria-label="Search reports"
          />
        </div>

        {/* Collapsible Filters */}
        {showFilters && (
          <div className="space-y-4">
            {/* Branch Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500">
                Branch
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <MobileSelect
                  value={filters.branchFilter}
                  onValueChange={(value) => onFilterChange('branch', value)}
                  options={branchOptions}
                  placeholder="All Branches"
                  aria-label="Filter by Branch"
                  triggerClassName="pl-9"
                />
              </div>
            </div>

            {/* Report Type Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500">
                Report Type
              </label>
              <MobileSelect
                value={filters.reportTypeFilter}
                onValueChange={(value) => onFilterChange('reportType', value)}
                options={reportTypeOptions}
                placeholder="All Types"
                aria-label="Filter by Report Type"
              />
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500">
                Status
              </label>
              <MobileSelect
                value={filters.statusFilter}
                onValueChange={(value) => onFilterChange('status', value)}
                options={statusOptions}
                placeholder="All Statuses"
                aria-label="Filter by Status"
              />
            </div>

            {/* Date Range Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500">
                Date Range
              </label>
              <DatePickerWithRange
                date={{
                  from: filters.dateRange?.from,
                  to: filters.dateRange?.to,
                }}
                setDate={handleDateRangeSelect}
                className="w-full"
              />
            </div>
          </div>
        )}

        {/* Results Summary and Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
          <div className="text-sm text-gray-500" role="status">
            {resultsCount} reports found, showing page {currentPage} of {totalPages}
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onResetFilters}
              className="text-xs min-h-[44px] md:min-h-[36px]"
              aria-label="Reset all filters"
            >
              <FilterX className="h-3 w-3 mr-1" aria-hidden="true" />
              Reset Filters
            </Button>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Sort by:</label>
              <MobileSelect
                value={filters.sortField}
                onValueChange={onSetSortField}
                options={sortSelectOptions}
                placeholder="Sort by Date"
                aria-label="Sort field selection"
                triggerClassName="w-[150px]"
              />

              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleSortDirection}
                className="min-h-[44px] md:min-h-[36px] min-w-[44px] md:min-w-[36px]"
                aria-label={`Sort ${filters.sortDirection === "asc" ? "ascending" : "descending"}`}
              >
                {filters.sortDirection === "asc" ? (
                  <SortAsc className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <SortDesc className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <h4 className="text-sm font-medium">Active Filters:</h4>
            <div className="flex flex-wrap gap-2">
              {filters.searchTerm && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                  Search: "{filters.searchTerm}"
                </span>
              )}
              {filters.branchFilter !== "all" && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                  Branch: {branches[filters.branchFilter]?.name || "Unknown"}
                </span>
              )}
              {filters.reportTypeFilter !== "all" && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                  Type: {filters.reportTypeFilter}
                </span>
              )}
              {filters.statusFilter !== "pending_approval" && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                  Status: {statusOptions.find(s => s.value === filters.statusFilter)?.label}
                </span>
              )}
              {filters.dateRange?.from && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                  From: {format(filters.dateRange.from, "MMM d, yyyy")}
                </span>
              )}
              {filters.dateRange?.to && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                  To: {format(filters.dateRange.to, "MMM d, yyyy")}
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}