"use client";

import { format } from "date-fns";
import { CalendarIcon, AlertCircle, Info } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn, formatKHRCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { KHCurrencyInput } from "@/components/ui/currency-input";
import type { Branch, ReportType } from "@/types/reports";
import { useReportForm } from "@/hooks/useReportForm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { BranchSelector } from "@/components/ui/branch-selector";
import { useUserData } from "@/contexts/UserDataContext";
import { toast } from "@/components/ui/use-toast";

interface CreateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: ReportType;
  onSuccess: () => void;
  userBranches: Branch[];
}

const COMMENT_TEMPLATES = [
  {
    label: "No issues reported",
    value: "No issues reported for this period.",
  },
  {
    label: "System maintenance",
    value: "System maintenance completed successfully.",
  },
  {
    label: "Data reconciliation",
    value: "Data reconciliation completed with no discrepancies.",
  },
  {
    label: "Staff training",
    value: "Staff training completed on new procedures.",
  },
  {
    label: "Custom comment",
    value: "custom",
  },
];

export function CreateReportModal({
  isOpen,
  onClose,
  reportType,
  onSuccess,
  userBranches,
}: CreateReportModalProps) {
  const {
    formData,
    errors,
    isSubmitting,
    isCheckingDuplicate,
    updateField,
    handleSubmit,
    validationRules,
    setFormData,
  } = useReportForm({
    reportType,
    userBranches,
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  const { userData } = useUserData();
  
  // Initialize plan data state at the top level
  const [planData, setPlanData] = useState<{
    writeOffsPlan: number | null;
    ninetyPlusPlan: number | null;
    planReportId: string | null;
  }>({ writeOffsPlan: null, ninetyPlusPlan: null, planReportId: null });
  
  // Use a ref to track which combinations we've already fetched
  const fetchedCombinations = React.useRef<Set<string>>(new Set());
  
  // Use a ref to track if we've initialized the form for this dialog session
  const hasInitialized = React.useRef(false);

  // Add this state variable near the top of the CreateReportModal component
  // After the other state variables
  const [planDataLoading, setPlanDataLoading] = useState(false);

  // Get today's date at noon for consistent comparison
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    return date;
  }, []);

  // For users with only one branch, automatically select it
  useEffect(() => {
    if (userBranches.length === 1 && !formData.branchId) {
      updateField("branchId", userBranches[0].id);
    }
  }, [userBranches, formData.branchId, updateField]);

  // Load plan data when creating an actual report
  useEffect(() => {
    if (reportType === "actual" && formData.date && formData.branchId) {
      // Don't allow future dates
      const selectedDate = new Date(formData.date);
      const currentDate = new Date();
      selectedDate.setHours(0, 0, 0, 0);
      currentDate.setHours(0, 0, 0, 0);
      
      if (selectedDate > currentDate) {
        return; // Don't fetch for future dates
      }
      
      const formattedDate = format(formData.date, "yyyy-MM-dd");
      const fetchKey = `${formattedDate}-${formData.branchId}`;
      
      console.log("Attempting to fetch plan data for:", fetchKey);
      
      // Only fetch if we haven't already fetched this combination
      if (!fetchedCombinations.current.has(fetchKey)) {
        fetchedCombinations.current.add(fetchKey);
        
        // Set loading state to true before fetching
        setPlanDataLoading(true);
        
        const fetchPlanData = async () => {
          try {
            const url = `/api/reports?date=${encodeURIComponent(formattedDate)}&branchId=${encodeURIComponent(formData.branchId)}&reportType=plan`;
            
            const response = await fetch(url);
            
            if (!response.ok) {
              throw new Error(`Failed to fetch plan data: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.data && data.data.length > 0) {
              const planReport = data.data[0];
              setPlanData({
                writeOffsPlan: planReport.writeOffs,
                ninetyPlusPlan: planReport.ninetyPlus,
                planReportId: planReport.id
              });
              // Set the planReportId in the form data as well
              updateField("planReportId", planReport.id);
            } else {
              setPlanData({ writeOffsPlan: null, ninetyPlusPlan: null, planReportId: null });
              updateField("planReportId", null);
            }
          } catch (error) {
            console.error("Error loading plan data");
            setPlanData({ writeOffsPlan: null, ninetyPlusPlan: null, planReportId: null });
            updateField("planReportId", null);
          } finally {
            // Set loading state to false after fetching (regardless of success/failure)
            setPlanDataLoading(false);
          }
        };
        
        fetchPlanData();
      } else {
        // If we've already fetched this combination, make sure loading is false
        setPlanDataLoading(false);
      }
    }
  }, [reportType, formData.date, formData.branchId, updateField]);

  // Keep this separate effect to clean up when modal closes
  useEffect(() => {
    if (isOpen) {
      fetchedCombinations.current.clear();
      console.log("Modal opened, cleared fetched combinations");
    }
  }, [isOpen]);

  const handleTemplateSelect = useCallback((template: string) => {
    if (template === "custom") {
      updateField("comments", "");
    } else {
      updateField("comments", template);
    }
  }, [updateField]);

  // Debug date values
  useEffect(() => {
    if (formData.date) {
      console.log("Current formData.date:", formData.date);
      console.log("Formatted date:", format(formData.date, "yyyy-MM-dd"));
    }
  }, [formData.date]);

  // Form initialization effect - Reset when modal opens
  useEffect(() => {
    if (isOpen && !hasInitialized.current) {
      hasInitialized.current = true;
      
      // Use a batched update to minimize renders
      const newFormData = {
        title: `${reportType === "plan" ? "Plan" : "Actual"} Report - ${format(today, "yyyy-MM-dd")}`,
        date: today,
        branchId: userBranches.length === 1 ? userBranches[0].id : '',
        writeOffs: 0,
        ninetyPlus: 0,
        comments: '',
        reportType: reportType,
        planReportId: null,
      };
      
      // Set the entire form data at once
      setFormData(newFormData);
      
      // Clear fetched combinations to ensure fresh data
      fetchedCombinations.current.clear();
      
      // Clear plan data
      setPlanData({ writeOffsPlan: null, ninetyPlusPlan: null, planReportId: null });
    }
    
    // Reset the initialization flag when the modal closes
    if (!isOpen) {
      hasInitialized.current = false;
    }
  }, [isOpen, reportType, userBranches, today, setFormData]);

  // Prevent future dates from being used
  useEffect(() => {
    if (formData.date) {
      const selectedDate = new Date(formData.date);
      const currentDate = new Date();
      
      // Clear the time part for accurate date comparison
      selectedDate.setHours(0, 0, 0, 0);
      currentDate.setHours(0, 0, 0, 0);
      
      if (selectedDate > currentDate) {
        // Automatically adjust to today's date if a future date is detected
        console.warn("Future date detected, adjusting to today's date");
        const today = new Date();
        updateField("date", today);
        updateField(
          "title", 
          `${reportType === "plan" ? "Plan" : "Actual"} Report - ${format(today, "yyyy-MM-dd")}`
        );
      }
    }
  }, [formData.date, updateField, reportType]);

  // If user has no branches assigned, show error message
  if (!userBranches || userBranches.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Access Denied</DialogTitle>
            <DialogDescription>
              You are not assigned to any branches. Please contact your
              administrator to get access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Report</DialogTitle>
          <DialogDescription>
            Select a branch and fill in the report details.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {errors.general && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.general}</AlertDescription>
            </Alert>
          )}
          
          {/* Hidden title field */}
          <input 
            type="hidden" 
            id="title" 
            name="title" 
            value={formData.title || `${reportType === "plan" ? "Plan" : "Actual"} Report - ${format(new Date(), "yyyy-MM-dd")}`} 
          />
          {errors.title && (
            <p className="text-sm text-red-500">{errors.title}</p>
          )}

          <div className="grid gap-2">
            <Label htmlFor="date">Date</Label>
            <div className="flex items-center gap-2">
              {isCheckingDuplicate && (
                <span className="text-sm text-muted-foreground animate-pulse">
                  Checking for duplicates...
                </span>
              )}
              <Alert className="py-1 bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-700">
                  {reportType === "plan"
                    ? "Morning plan must be submitted before evening actual report"
                    : "Only today's entries are allowed"}
                </AlertDescription>
              </Alert>
            </div>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !formData.date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.date ? (
                  format(formData.date, "PPP")
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={formData.date}
                onSelect={(date) => {
                  if (!date) return;
                  
                  // Set the time to noon to avoid timezone issues
                  const selectedDate = new Date(date);
                  selectedDate.setHours(12, 0, 0, 0);
                  
                  // Get today's date at noon
                  const today = new Date();
                  today.setHours(12, 0, 0, 0);
                  
                  // Don't update if future date
                  if (selectedDate > today) {
                    toast({
                      title: "Invalid date",
                      description: "You cannot select a future date",
                      variant: "destructive"
                    });
                    return;
                  }
                  
                  updateField("date", selectedDate);
                  
                  // Update the title with the local date format
                  updateField(
                    "title", 
                    `${reportType === "plan" ? "Plan" : "Actual"} Report - ${format(selectedDate, "yyyy-MM-dd")}`
                  );
                }}
                disabled={(date) => {
                  // Set time to noon to match the "today" variable's time
                  const compareDate = new Date(date);
                  compareDate.setHours(12, 0, 0, 0);
                  
                  // Get today's date at noon
                  const today = new Date();
                  today.setHours(12, 0, 0, 0);
                  
                  // Disable future dates
                  return compareDate > today;
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {errors.date && (
            <p className="text-sm text-red-500">{errors.date}</p>
          )}

          <div className="grid gap-2">
            <Label htmlFor="branch">Branch</Label>
            <BranchSelector
              id="branch"
              userId={userData?.id || ""}
              value={formData.branchId}
              onChange={(branchId) => updateField("branchId", branchId)}
              placeholder="Select branch"
            />
            {errors.branchId && (
              <p className="text-sm text-red-500">{errors.branchId}</p>
            )}
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="writeOffs">Write-offs</Label>
            </div>
            <KHCurrencyInput
              id="writeOffs"
              value={formData.writeOffs}
              onValueChange={(value) => updateField("writeOffs", Number(value))}
            />
            {errors.writeOffs && (
              <p className="text-sm text-red-500">{errors.writeOffs}</p>
            )}
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ninetyPlus">90+ Days</Label>
            </div>
            <KHCurrencyInput
              id="ninetyPlus"
              value={formData.ninetyPlus}
              onValueChange={(value) => updateField("ninetyPlus", Number(value))}
            />
            {errors.ninetyPlus && (
              <p className="text-sm text-red-500">{errors.ninetyPlus}</p>
            )}
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="comments">Comments</Label>
              <Select onValueChange={handleTemplateSelect} defaultValue="">
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Use template" />
                </SelectTrigger>
                <SelectContent>
                  {COMMENT_TEMPLATES.map((template) => (
                    <SelectItem key={template.label} value={template.value}>
                      {template.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              id="comments"
              value={formData.comments}
              onChange={(e) => updateField("comments", e.target.value)}
              placeholder={`Add any comments about this report...${
                validationRules?.comments.required
                  ? ` (Minimum ${validationRules.comments.minLength} characters)`
                  : ""
              }`}
              className="min-h-[100px]"
            />
            {errors.comments && (
              <p className="text-sm text-red-500">{errors.comments}</p>
            )}
          </div>

          {/* Display plan data if available when creating an actual report */}
          {reportType === "actual" && (
            <div className="bg-muted p-4 rounded-lg mb-4">
              <h3 className="text-sm font-semibold mb-2">Morning Plan Data</h3>
              {planDataLoading ? (
                <div className="text-center py-2">
                  <div className="animate-spin h-5 w-5 mx-auto border-2 border-primary rounded-full border-t-transparent"></div>
                  <p className="text-sm mt-1">Loading plan data...</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="planWriteOffs" className="text-xs">Write-offs (Plan)</Label>
                    <p id="planWriteOffs" className="text-sm font-medium">
                      {planData.writeOffsPlan !== null 
                        ? formatKHRCurrency(planData.writeOffsPlan) 
                        : (
                          <span className="text-muted-foreground italic">
                            No plan data available
                          </span>
                        )}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="planNinetyPlus" className="text-xs">90+ Days (Plan)</Label>
                    <p id="planNinetyPlus" className="text-sm font-medium">
                      {planData.ninetyPlusPlan !== null 
                        ? formatKHRCurrency(planData.ninetyPlusPlan) 
                        : (
                          <span className="text-muted-foreground italic">
                            No plan data available
                          </span>
                        )}
                    </p>
                  </div>
                </div>
              )}
              {formData.date && !planDataLoading && planData.writeOffsPlan === null && (
                <Alert className="mt-3 bg-amber-50 border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-700 text-xs">
                    No morning plan found for this date and branch. Please ensure a plan report is submitted first.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}