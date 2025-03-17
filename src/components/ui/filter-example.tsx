"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterManager } from "./filter-manager";

interface FilterExampleProps {
  className?: string;
}

export function FilterExample({ className }: FilterExampleProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [status, setStatus] = useState("all");
  const [dateRange, setDateRange] = useState("");

  const initialState = {
    search: "",
    status: "all",
    dateRange: "",
  };

  return (
    <FilterManager
      storageKey="example-filters"
      initialState={initialState}
      className={className}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dateRange">Date Range</Label>
          <Input
            id="dateRange"
            type="date"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          />
        </div>
      </div>
    </FilterManager>
  );
}
