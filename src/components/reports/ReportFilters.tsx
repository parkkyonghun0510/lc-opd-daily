import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
import {
  CalendarIcon,
  Download,
  FileIcon,
  FileSpreadsheetIcon,
  RefreshCw,
  X,
  Save,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Filter,
  Loader2,
  PencilIcon,
  Edit,
  Trash2,
  AlertTriangle
} from "lucide-react";
import { BranchSelector } from "@/components/ui/branch-selector";
import { UserSelector } from "@/components/ui/user-selector";
import { Badge } from "@/components/ui/badge";
import { useUserData } from "@/contexts/UserDataContext";
import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";

// Define the filter preset interface
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

interface ReportFiltersProps {
  startDate: Date | undefined;
  setStartDate: (date: Date | undefined) => void;
  endDate: Date | undefined;
  setEndDate: (date: Date | undefined) => void;
  selectedBranchId: string | undefined;
  setSelectedBranchId: (id: string | undefined) => void;
  selectedUserId: string | undefined;
  setSelectedUserId: (id: string | undefined) => void;
  reportType: string;
  setReportType: (type: any) => void;
  status: string | undefined;
  setStatus: (status: string | undefined) => void;
  handleFilter: () => void;
  clearFilters: () => void;
  exportToCSV: () => void;
  exportToPDF: () => void;
  isLoading: boolean;
  isExporting: boolean;
}

export function ReportFilters({
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
}: ReportFiltersProps) {
  const { userData } = useUserData();
  const [isStartDateOpen, setIsStartDateOpen] = useState(false);
  const [isEndDateOpen, setIsEndDateOpen] = useState(false);
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([]);
  const [isSavePresetOpen, setIsSavePresetOpen] = useState(false);
  const [isLoadPresetOpen, setIsLoadPresetOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<string | null>(null);
  // New state for filter visibility
  const [showFilters, setShowFilters] = useState(false);

  // State to track if filters are applied
  const [filtersApplied, setFiltersApplied] = useState(false);

  const statusOptions = [
    { label: "Any Status", value: "any" },
    { label: "Pending", value: "pending" },
    { label: "Pending Approval", value: "pending_approval" },
    { label: "Approved", value: "approved" },
    { label: "Rejected", value: "rejected" },
  ];

  const reportTypeOptions = [
    { label: "Actual Reports", value: "actual" },
    { label: "Plan Reports", value: "plan" },
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

  // Load saved presets from localStorage on component mount
  useEffect(() => {
    const storedPresets = localStorage.getItem("reportFilterPresets");
    if (storedPresets) {
      try {
        const parsedPresets = JSON.parse(storedPresets);

        // Add timestamps to existing presets if they don't have them (backward compatibility)
        const now = new Date().toISOString();
        const updatedPresets = parsedPresets.map((preset: any) => ({
          ...preset,
          createdAt: preset.createdAt || now,
          updatedAt: preset.updatedAt || now
        }));

        setSavedPresets(updatedPresets);

        // Save the updated presets back to localStorage if we added timestamps
        if (JSON.stringify(parsedPresets) !== JSON.stringify(updatedPresets)) {
          localStorage.setItem("reportFilterPresets", JSON.stringify(updatedPresets));
        }
      } catch (error) {
        console.error("Error parsing saved presets:", error);
      }
    }
  }, []);

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name for your preset",
        variant: "destructive",
      });
      return;
    }

    const now = new Date().toISOString();
    let updatedPresets: FilterPreset[];

    if (editingPresetId) {
      // Update existing preset
      updatedPresets = savedPresets.map(preset => {
        if (preset.id === editingPresetId) {
          return {
            ...preset,
            name: presetName,
            startDate: startDate ? startDate.toISOString() : undefined,
            endDate: endDate ? endDate.toISOString() : undefined,
            branchId: selectedBranchId,
            userId: selectedUserId,
            reportType,
            status,
            updatedAt: now
          };
        }
        return preset;
      });

      toast({
        title: "Success",
        description: `Filter preset "${presetName}" updated successfully`,
      });
    } else {
      // Create new preset
      const newPreset: FilterPreset = {
        id: Date.now().toString(),
        name: presetName,
        startDate: startDate ? startDate.toISOString() : undefined,
        endDate: endDate ? endDate.toISOString() : undefined,
        branchId: selectedBranchId,
        userId: selectedUserId,
        reportType,
        status,
        createdAt: now,
        updatedAt: now
      };

      updatedPresets = [...savedPresets, newPreset];

      toast({
        title: "Success",
        description: `Filter preset "${newPreset.name}" saved successfully`,
      });
    }

    // Save to state and localStorage
    setSavedPresets(updatedPresets);
    localStorage.setItem("reportFilterPresets", JSON.stringify(updatedPresets));

    // Reset form
    setPresetName("");
    setEditingPresetId(null);
    setIsSavePresetOpen(false);
  };

  const confirmDeletePreset = (id: string) => {
    setPresetToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeletePreset = () => {
    if (!presetToDelete) return;

    const updatedPresets = savedPresets.filter(preset => preset.id !== presetToDelete);
    setSavedPresets(updatedPresets);
    localStorage.setItem("reportFilterPresets", JSON.stringify(updatedPresets));

    toast({
      description: "Preset deleted",
    });

    setPresetToDelete(null);
    setIsDeleteConfirmOpen(false);
  };

  const editPreset = (preset: FilterPreset) => {
    setEditingPresetId(preset.id);
    setPresetName(preset.name);

    // Open the save dialog with preset data loaded
    setIsSavePresetOpen(true);

    // Close the load dialog
    setIsLoadPresetOpen(false);
  };

  const applyPreset = (preset: FilterPreset) => {
    // Apply the dates
    if (preset.startDate) {
      const parsedStartDate = new Date(preset.startDate);
      setStartDate(isValid(parsedStartDate) ? parsedStartDate : undefined);
    } else {
      setStartDate(undefined);
    }

    if (preset.endDate) {
      const parsedEndDate = new Date(preset.endDate);
      setEndDate(isValid(parsedEndDate) ? parsedEndDate : undefined);
    } else {
      setEndDate(undefined);
    }

    // Apply other filters
    setSelectedBranchId(preset.branchId);
    setSelectedUserId(preset.userId);
    setReportType(preset.reportType);
    setStatus(preset.status);

    // Close the preset dialog
    setIsLoadPresetOpen(false);

    // Show filters when applying a preset
    setShowFilters(true);

    // Apply the filters
    setTimeout(handleFilter, 0);

    toast({
      description: `Preset "${preset.name}" applied`,
    });
  };

  // Function to toggle filter visibility
  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
      <div className="space-y-4">
        <div className="flex justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFilters}
              className={cn(
                "flex items-center gap-1",
                filtersApplied && "border-blue-500 dark:border-blue-400"
              )}
            >
              <Filter className="h-4 w-4 mr-1" />
              <span>Filters</span>
              {showFilters ? (
                <ChevronUp className="h-4 w-4 ml-1" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-1" />
              )}
            </Button>
            {filtersApplied && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                Filters Applied
              </Badge>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSavePresetOpen(true)}
              className="flex items-center gap-1"
            >
              <Save className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Save Preset</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLoadPresetOpen(true)}
              className="flex items-center gap-1"
            >
              <Bookmark className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Load Preset</span>
            </Button>
          </div>
        </div>

        {/* Filter Form - Only shown when showFilters is true */}
        {showFilters && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* Start Date Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Date
                </label>
                <Popover open={isStartDateOpen} onOpenChange={setIsStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* End Date Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Date
                </label>
                <Popover open={isEndDateOpen} onOpenChange={setIsEndDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Branch Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Branch
                </label>
                <BranchSelector
                  userId={userData?.id || ""}
                  value={selectedBranchId}
                  onChange={(id) => setSelectedBranchId(id)}
                  placeholder="All My Branches"
                  showAllOption={true}
                />
              </div>

              {/* User Filter (Admin only) */}
              {userData?.role === "ADMIN" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Submitted By
                  </label>
                  <UserSelector
                    value={selectedUserId}
                    onChange={(id) => setSelectedUserId(id)}
                    placeholder="All users"
                  />
                </div>
              )}

              {/* Report Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Report Type
                </label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose report type" />
                  </SelectTrigger>
                  <SelectContent>
                    {reportTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <Select
                  value={status || "any"}
                  onValueChange={(val) => setStatus(val === "any" ? undefined : val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex flex-wrap gap-2 justify-end mt-4">
              {/* Clear Filters Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearFilters();
                  setShowFilters(false);
                }}
                className="flex items-center"
              >
                <X className="mr-1 h-4 w-4" />
                Clear Filters
              </Button>

              {/* Apply Filters Button */}
              <Button
                size="sm"
                onClick={handleFilter}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-1 h-4 w-4" />
                    Apply Filters
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {/* Export Actions - Always visible */}
        <div className="flex flex-wrap gap-2 justify-end mt-4 border-t pt-4 dark:border-gray-700">
          {/* Export to CSV Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCSV}
            disabled={isExporting}
            className="flex items-center"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <FileSpreadsheetIcon className="mr-1 h-4 w-4" />
                Export CSV
              </>
            )}
          </Button>

          {/* Export to PDF Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={exportToPDF}
            disabled={isExporting}
            className="flex items-center"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <FileIcon className="mr-1 h-4 w-4" />
                Export PDF
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Save Preset Dialog */}
      <Dialog open={isSavePresetOpen} onOpenChange={(open) => {
        if (!open) {
          // Reset form when closing
          setEditingPresetId(null);
          setPresetName("");
        }
        setIsSavePresetOpen(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPresetId ? "Edit Filter Preset" : "Save Filter Preset"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="preset-name" className="text-right">
                Preset Name
              </Label>
              <Input
                id="preset-name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                className="col-span-3"
                placeholder="My Favorite Filters"
              />
            </div>

            <div className="col-span-4 text-sm text-gray-500 dark:text-gray-400">
              <p>This preset will save the following filters:</p>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                <li>Date Range: {startDate ? format(startDate, "dd/MMM/yyyy") : "Any"} - {endDate ? format(endDate, "dd/MMM/yyyy") : "Any"}</li>
                <li>Report Type: {reportType === "actual" ? "Actual Reports" : "Plan Reports"}</li>
                {selectedBranchId && <li>Branch Filter</li>}
                {selectedUserId && <li>User Filter</li>}
                {status && <li>Status: {status}</li>}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingPresetId(null);
                setPresetName("");
                setIsSavePresetOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSavePreset}>
              {editingPresetId ? "Update Preset" : "Save Preset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Preset Dialog */}
      <Dialog open={isLoadPresetOpen} onOpenChange={setIsLoadPresetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Filter Presets</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {savedPresets.length === 0 ? (
              <div className="text-center space-y-4">
                <p className="text-gray-500 dark:text-gray-400">
                  No saved presets found. Create a preset first.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsLoadPresetOpen(false);
                    setIsSavePresetOpen(true);
                  }}
                  className="mx-auto"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Create New Preset
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Sort presets by updatedAt, newest first */}
                {savedPresets
                  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                  .map((preset) => (
                    <div
                      key={preset.id}
                      className="flex flex-col p-3 border rounded-md dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium text-base">{preset.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Last updated: {format(new Date(preset.updatedAt), "dd/MMM/yyyy HH:mm")}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => applyPreset(preset)}
                          className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <BookmarkCheck className="h-4 w-4 mr-1" />
                          Apply
                        </Button>
                      </div>

                      <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 mr-2 mb-1">
                          {preset.reportType === "actual" ? "Actual Reports" : "Plan Reports"}
                        </span>
                        {preset.status && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 mr-2 mb-1">
                            Status: {preset.status}
                          </span>
                        )}
                        {preset.startDate && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 mr-2 mb-1">
                            From: {format(new Date(preset.startDate), "dd/MMM/yyyy")}
                          </span>
                        )}
                        {preset.endDate && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 mr-2 mb-1">
                            To: {format(new Date(preset.endDate), "dd/MMM/yyyy")}
                          </span>
                        )}
                      </div>

                      <div className="flex justify-end gap-2 mt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => editPreset(preset)}
                          className="h-8 px-3"
                        >
                          <PencilIcon className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => confirmDeletePreset(preset.id)}
                          className="h-8 px-3 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setIsLoadPresetOpen(false);
                setIsSavePresetOpen(true);
              }}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Current Filters
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsLoadPresetOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-700 dark:text-gray-300">
              Are you sure you want to delete this preset? This action cannot be undone.
            </p>
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPresetToDelete(null);
                setIsDeleteConfirmOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletePreset}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}