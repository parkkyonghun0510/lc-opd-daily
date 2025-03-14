"use client";

import React, { useEffect, useState } from "react";
import { Search, X as XIcon } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Branch, FilterState } from "../types";
import { cn } from "../utils/helpers";

interface BranchFiltersProps {
  branches: Branch[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  className?: string;
  loading?: boolean;
}

export const BranchFilters: React.FC<BranchFiltersProps> = ({
  branches,
  filters,
  onFiltersChange,
  className,
  loading = false,
}) => {
  // Extract unique values for filter options
  const [regions, setRegions] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [activeFilterCount, setActiveFilterCount] = useState<number>(0);

  // Extract unique field values for filter options
  useEffect(() => {
    if (!branches || branches.length === 0) return;

    const uniqueRegions = [
      "all",
      ...new Set(branches.map((branch) => branch.region)),
    ];
    const uniqueSizes = [
      "all",
      ...new Set(branches.map((branch) => branch.size)),
    ];

    setRegions(uniqueRegions);
    setSizes(uniqueSizes);
  }, [branches]);

  // Count active filters
  useEffect(() => {
    let count = 0;
    if (filters.region !== "all") count++;
    if (filters.size !== "all") count++;
    if (filters.search) count++;
    setActiveFilterCount(count);
  }, [filters]);

  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      search: e.target.value,
    });
  };

  // Handle filter value changes
  const handleFilterChange = (filterName: keyof FilterState, value: string) => {
    onFiltersChange({
      ...filters,
      [filterName]: value,
    });
  };

  // Reset all filters
  const handleResetFilters = () => {
    onFiltersChange({
      region: "all",
      size: "all",
      search: "",
    });
  };

  return (
    <Card className={cn("shadow-sm", className)}>
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
          {/* Search input */}
          <div className="relative flex-grow">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search branches..."
              value={filters.search}
              onChange={handleSearchChange}
              className="pl-8 h-10"
            />
            {filters.search && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-8 w-8"
                onClick={() => handleFilterChange("search", "")}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Region filter */}
          <Select
            value={filters.region}
            onValueChange={(value) => handleFilterChange("region", value)}
            disabled={loading || regions.length <= 1}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              {regions.map((region) => (
                <SelectItem key={region} value={region}>
                  {region === "all" ? "All Regions" : region}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Size filter */}
          <Select
            value={filters.size}
            onValueChange={(value) => handleFilterChange("size", value)}
            disabled={loading || sizes.length <= 1}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Size" />
            </SelectTrigger>
            <SelectContent>
              {sizes.map((size) => (
                <SelectItem key={size} value={size}>
                  {size === "all" ? "All Sizes" : size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Reset filters */}
          {activeFilterCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="flex items-center"
            >
              <XIcon className="h-4 w-4 mr-1" />
              Reset filters
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
