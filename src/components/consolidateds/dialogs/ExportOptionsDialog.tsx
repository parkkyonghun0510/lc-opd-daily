"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConsolidatedData } from "../types/consolidated-types";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export interface ExportOption {
  id: string;
  label: string;
}

export interface ExportOptionsProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportSettings) => void;
  exportType: "csv" | "pdf";
  consolidatedData: ConsolidatedData | null;
}

export interface ExportSettings {
  includeFields: string[];
  statusFilter: "all" | "reported" | "missing";
  sortBy: string;
  sortDirection: "asc" | "desc";
  branchFilter: string[];
  includeMetrics: boolean;
  includeSummary: boolean;
  fileFormat: string;
  orientation?: "portrait" | "landscape"; // For PDF only
}

export function ExportOptionsDialog({
  isOpen,
  onClose,
  onExport,
  exportType,
  consolidatedData,
}: ExportOptionsProps) {
  const [settings, setSettings] = React.useState<ExportSettings>({
    includeFields: ["branchCode", "writeOffs", "ninetyPlus", "hasReports"],
    statusFilter: "all",
    sortBy: "branchCode",
    sortDirection: "asc",
    branchFilter: [],
    includeMetrics: true,
    includeSummary: true,
    fileFormat: exportType === "csv" ? "csv" : "pdf",
    orientation: "portrait",
  });

  const fieldOptions: ExportOption[] = [
    { id: "branchCode", label: "Branch Code" },
    { id: "branchName", label: "Branch Name" },
    { id: "writeOffs", label: "Write-Offs" },
    { id: "ninetyPlus", label: "90+ Days" },
    { id: "hasReports", label: "Report Status" },
    { id: "reportsCount", label: "Reports Count" },
  ];

  const sortOptions: ExportOption[] = [
    { id: "branchCode", label: "Branch Code" },
    { id: "branchName", label: "Branch Name" },
    { id: "writeOffs", label: "Write-Offs (Amount)" },
    { id: "ninetyPlus", label: "90+ Days (Amount)" },
    { id: "hasReports", label: "Report Status" },
  ];

  const handleCheckboxChange = (field: string) => {
    setSettings((prev) => {
      if (prev.includeFields.includes(field)) {
        return {
          ...prev,
          includeFields: prev.includeFields.filter((f) => f !== field),
        };
      } else {
        return {
          ...prev,
          includeFields: [...prev.includeFields, field],
        };
      }
    });
  };

  const handleExport = () => {
    onExport(settings);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export Options - {exportType.toUpperCase()}</DialogTitle>
          <DialogDescription>
            Customize your export options below
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="fields" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="fields">Fields</TabsTrigger>
            <TabsTrigger value="filters">Filters</TabsTrigger>
            <TabsTrigger value="format">Format</TabsTrigger>
          </TabsList>

          {/* Fields Tab */}
          <TabsContent value="fields" className="space-y-4 pt-4">
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Include Fields</h4>
              <div className="grid grid-cols-2 gap-3">
                {fieldOptions.map((option) => (
                  <div key={option.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`field-${option.id}`}
                      checked={settings.includeFields.includes(option.id)}
                      onCheckedChange={() => handleCheckboxChange(option.id)}
                    />
                    <Label
                      htmlFor={`field-${option.id}`}
                      className="text-sm font-normal"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Sorting</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="sort-by" className="text-sm">
                    Sort By
                  </Label>
                  <Select
                    value={settings.sortBy}
                    onValueChange={(value) =>
                      setSettings({ ...settings, sortBy: value })
                    }
                  >
                    <SelectTrigger id="sort-by" className="w-full">
                      <SelectValue placeholder="Sort by..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sortOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="sort-direction" className="text-sm">
                    Direction
                  </Label>
                  <Select
                    value={settings.sortDirection}
                    onValueChange={(value: "asc" | "desc") =>
                      setSettings({ ...settings, sortDirection: value })
                    }
                  >
                    <SelectTrigger id="sort-direction" className="w-full">
                      <SelectValue placeholder="Direction..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Filters Tab */}
          <TabsContent value="filters" className="space-y-4 pt-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Status Filter</h4>
              <RadioGroup
                value={settings.statusFilter}
                onValueChange={(value: "all" | "reported" | "missing") =>
                  setSettings({ ...settings, statusFilter: value })
                }
                className="flex flex-col space-y-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="status-all" />
                  <Label htmlFor="status-all">All Branches</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="reported" id="status-reported" />
                  <Label htmlFor="status-reported">Reported Only</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="missing" id="status-missing" />
                  <Label htmlFor="status-missing">Missing Reports Only</Label>
                </div>
              </RadioGroup>
            </div>

            {consolidatedData && consolidatedData.branchData.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Branch Selection</h4>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setSettings({...settings, branchFilter: []})}
                    className="h-7 text-xs"
                    disabled={settings.branchFilter.length === 0}
                  >
                    Clear Selection
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {settings.branchFilter.length === 0
                    ? "All branches will be included"
                    : `${settings.branchFilter.length} branch(es) selected`}
                </p>
                <Select
                  value={settings.branchFilter.length ? settings.branchFilter[settings.branchFilter.length - 1] : ""}
                  onValueChange={(value) => {
                    setSettings((prev) => {
                      // If value is empty, keep the current selection
                      if (!value) return prev;
                      
                      const newFilter = [...prev.branchFilter];
                      
                      // If already selected, remove it (deselect)
                      if (newFilter.includes(value)) {
                        return {
                          ...prev,
                          branchFilter: newFilter.filter(id => id !== value)
                        };
                      }
                      
                      // If not selected, add it
                      return {
                        ...prev,
                        branchFilter: [...newFilter, value]
                      };
                    });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select branch(es)..." />
                  </SelectTrigger>
                  <SelectContent>
                    {consolidatedData.branchData.map((branch) => (
                      <SelectItem 
                        key={branch.branchId} 
                        value={branch.branchId}
                        className="flex items-center"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{branch.branchCode} - {branch.branchName}</span>
                          {settings.branchFilter.includes(branch.branchId) && (
                            <span className="ml-2 text-primary">✓</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </TabsContent>

          {/* Format Tab */}
          <TabsContent value="format" className="space-y-4 pt-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Include Sections</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-metrics"
                    checked={settings.includeMetrics}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        includeMetrics: checked === true,
                      })
                    }
                  />
                  <Label htmlFor="include-metrics" className="text-sm">
                    Include Metrics Summary
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-summary"
                    checked={settings.includeSummary}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        includeSummary: checked === true,
                      })
                    }
                  />
                  <Label htmlFor="include-summary" className="text-sm">
                    Include Totals Row
                  </Label>
                </div>
              </div>
            </div>

            {exportType === "pdf" && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">PDF Options</h4>
                <div className="space-y-2">
                  <Label htmlFor="orientation" className="text-sm">
                    Page Orientation
                  </Label>
                  <Select
                    value={settings.orientation}
                    onValueChange={(value: "portrait" | "landscape") =>
                      setSettings({ ...settings, orientation: value })
                    }
                  >
                    <SelectTrigger id="orientation" className="w-full">
                      <SelectValue placeholder="Select orientation..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleExport}>
            Export {exportType.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 