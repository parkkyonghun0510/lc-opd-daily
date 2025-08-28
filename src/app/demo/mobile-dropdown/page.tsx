"use client";

import { useState } from "react";
import { MobileSelect } from "@/components/ui/mobile-select";
import { MobileBranchSelector } from "@/components/ui/mobile-branch-selector";
import { MobileStatusFilter } from "@/components/ui/mobile-status-filter";
import { MobileReportFilters } from "@/components/ui/mobile-report-filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MobileDropdownDemo() {
  const [selectedValue, setSelectedValue] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [reportType, setReportType] = useState("actual");

  const demoOptions = [
    { value: "option1", label: "Option 1" },
    { value: "option2", label: "Option 2" },
    { value: "option3", label: "Option 3" },
    { value: "option4", label: "Option 4" },
    { value: "option5", label: "Option 5" },
  ];

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Mobile Dropdown Demo</h1>
        <p className="text-muted-foreground">
          Testing mobile-optimized dropdown components with 44px touch targets
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Mobile Select */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Mobile Select</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <MobileSelect
              value={selectedValue}
              onValueChange={setSelectedValue}
              options={demoOptions}
              placeholder="Select an option"
              aria-label="Demo select"
            />
            <p className="text-sm text-muted-foreground">
              Selected: {selectedValue || "None"}
            </p>
          </CardContent>
        </Card>

        {/* Mobile Status Filter */}
        <Card>
          <CardHeader>
            <CardTitle>Status Filter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <MobileStatusFilter
              value={selectedStatus}
              onChange={setSelectedStatus}
              placeholder="Select status"
            />
            <p className="text-sm text-muted-foreground">
              Selected: {selectedStatus || "None"}
            </p>
          </CardContent>
        </Card>

        {/* Mobile Branch Selector */}
        <Card>
          <CardHeader>
            <CardTitle>Branch Selector</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <MobileBranchSelector
              userId="demo-user-id"
              value={selectedBranch}
              onChange={setSelectedBranch}
              placeholder="Select branch"
              showAllOption={true}
              hierarchical={true}
            />
            <p className="text-sm text-muted-foreground">
              Selected: {selectedBranch || "None"}
            </p>
          </CardContent>
        </Card>

        {/* Full Report Filters */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Complete Report Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <MobileReportFilters
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              selectedBranchId={selectedBranch}
              setSelectedBranchId={setSelectedBranch}
              selectedUserId=""
              setSelectedUserId={() => {}}
              reportType={reportType}
              setReportType={setReportType}
              status={selectedStatus}
              setStatus={setSelectedStatus}
              handleFilter={() => console.log("Filter applied")}
              clearFilters={() => {
                setStartDate(undefined);
                setEndDate(undefined);
                setSelectedBranch("");
                setSelectedStatus("");
                setReportType("actual");
              }}
              exportToCSV={() => console.log("Export CSV")}
              exportToPDF={() => console.log("Export PDF")}
              isLoading={false}
              isExporting={false}
            />
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-semibold mb-2">Current State:</h3>
        <div className="space-y-1 text-sm">
          <p>Basic Select: {selectedValue || "None"}</p>
          <p>Status: {selectedStatus || "None"}</p>
          <p>Branch: {selectedBranch || "None"}</p>
          <p>Report Type: {reportType}</p>
          <p>Start Date: {startDate ? startDate.toLocaleDateString() : "None"}</p>
          <p>End Date: {endDate ? endDate.toLocaleDateString() : "None"}</p>
        </div>
      </div>
    </div>
  );
}