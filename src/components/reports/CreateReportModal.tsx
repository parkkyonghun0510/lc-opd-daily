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
import type { Branch, ReportType, CommentItem } from "@/types/reports";
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
import { Badge } from "@/components/ui/badge";
import { v4 as uuidv4 } from "uuid";

interface CreateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: ReportType;
  onSuccess: () => void;
  userBranches: Branch[];
  selectedDate?: Date;
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
  selectedDate,
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
    planReportStatus: string | null;
  }>({ writeOffsPlan: null, ninetyPlusPlan: null, planReportId: null, planReportStatus: null });

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

      //console.log("Attempting to fetch plan data for:", fetchKey);

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
                planReportId: planReport.id,
                planReportStatus: planReport.status
              });
              // Set the planReportId in the form data as well
              updateField("planReportId", planReport.id);
            } else {
              setPlanData({
                writeOffsPlan: null,
                ninetyPlusPlan: null,
                planReportId: null,
                planReportStatus: null
              });
              updateField("planReportId", null);
            }
          } catch (error) {
            console.error("Error loading plan data");
            setPlanData({
              writeOffsPlan: null,
              ninetyPlusPlan: null,
              planReportId: null,
              planReportStatus: null
            });
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
      //console.log("Modal opened, cleared fetched combinations");
    }
  }, [isOpen]);

  const handleTemplateSelect = useCallback((template: string) => {
    if (template === "custom") {
      // Clear the initial comment
      updateField("initialComment", "");
    } else {
      // Use the template text as the initial comment
      updateField("initialComment", template);
    }
  }, [updateField]);

  // Debug date values
  useEffect(() => {
    if (formData.date) {
      //console.log("Current formData.date:", formData.date);
      //console.log("Formatted date:", format(formData.date, "yyyy-MM-dd"));
    }
  }, [formData.date]);

  // Form initialization effect - Reset when modal opens
  useEffect(() => {
    if (isOpen && !hasInitialized.current) {
      hasInitialized.current = true;

      // Ensure we have a valid date
      let validDate: Date;

      if (selectedDate instanceof Date && !isNaN(selectedDate.getTime())) {
        validDate = selectedDate;
      } else if (today instanceof Date && !isNaN(today.getTime())) {
        validDate = today;
      } else {
        // Fallback to current date if both are invalid
        validDate = new Date();
        console.warn("Using current date as fallback for form initialization");
      }

      // Format the date for the title
      const formattedDate = format(validDate, "yyyy-MM-dd");

      // Use a batched update to minimize renders
      const newFormData = {
        title: `${reportType === "plan" ? "Plan" : "Actual"} Report - ${formattedDate}`,
        date: validDate, // Use the validated date
        branchId: userBranches.length === 1 ? userBranches[0].id : '',
        writeOffs: 0,
        ninetyPlus: 0,
        initialComment: "",
        reportType: reportType,
        planReportId: null,
      };

      // Log the date being used for debugging
      console.log("Initializing form with date:", validDate);

      // Set the entire form data at once
      setFormData(newFormData);

      // Clear fetched combinations to ensure fresh data
      fetchedCombinations.current.clear();

      // Clear plan data
      setPlanData({
        writeOffsPlan: null,
        ninetyPlusPlan: null,
        planReportId: null,
        planReportStatus: null
      });
    }

    // Reset the initialization flag when the modal closes
    if (!isOpen) {
      hasInitialized.current = false;
    }
  }, [isOpen, reportType, userBranches, today, setFormData, selectedDate]);

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
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto dark:bg-gray-800 dark:border-gray-700">
        <DialogHeader className="sticky top-0 bg-background dark:bg-gray-800 z-10 pb-2">
          <DialogTitle className="dark:text-gray-100 text-lg">Create New Report</DialogTitle>
          <DialogDescription className="dark:text-gray-400 text-sm">
            Select a branch and fill in the report details.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {errors.general && (
            <Alert variant="destructive" className="text-sm">
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
            <Label htmlFor="date" className="dark:text-gray-200 text-sm">Date</Label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              {isCheckingDuplicate && (
                <span className="text-sm text-muted-foreground animate-pulse dark:text-gray-400">
                  Checking for duplicates...
                </span>
              )}
              <Alert className="py-1 bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800 w-full">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
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
                  "w-full justify-start text-left font-normal dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 text-sm",
                  !formData.date && "text-muted-foreground dark:text-gray-400"
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
            <PopoverContent className="w-auto p-0 dark:bg-gray-800 dark:border-gray-700" align="start">
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
                className="dark:bg-gray-800 dark:text-gray-200"
              />
            </PopoverContent>
          </Popover>
          {errors.date && (
            <p className="text-sm text-red-500">{errors.date}</p>
          )}

          <div className="grid gap-2">
            <Label htmlFor="branch" className="dark:text-gray-200 text-sm">Branch</Label>
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
              <Label htmlFor="writeOffs" className="dark:text-gray-200 text-sm">Write-offs</Label>
              {validationRules?.writeOffs.requireApproval && (
                <Badge variant="secondary" className="text-xs dark:bg-gray-700 dark:text-gray-300">
                  Requires approval
                </Badge>
              )}
            </div>
            <KHCurrencyInput
              id="writeOffs"
              value={formData.writeOffs}
              onValueChange={(value) => updateField("writeOffs", Number(value))}
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 text-sm"
            />
            {errors.writeOffs && (
              <p className="text-sm text-red-500">{errors.writeOffs}</p>
            )}
            {validationRules?.writeOffs.requireApproval && formData.writeOffs > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Write-offs require approval and will be sent to the approval queue
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ninetyPlus" className="dark:text-gray-200 text-sm">90+ Days</Label>
              {validationRules?.ninetyPlus.requireApproval && (
                <Badge variant="secondary" className="text-xs dark:bg-gray-700 dark:text-gray-300">
                  Requires approval
                </Badge>
              )}
            </div>
            <KHCurrencyInput
              id="ninetyPlus"
              value={formData.ninetyPlus}
              onValueChange={(value) => updateField("ninetyPlus", Number(value))}
              className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 text-sm"
            />
            {errors.ninetyPlus && (
              <p className="text-sm text-red-500">{errors.ninetyPlus}</p>
            )}
            {validationRules?.ninetyPlus.requireApproval && formData.ninetyPlus > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                90+ days require approval and will be sent to the approval queue
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <Label htmlFor="comments" className="dark:text-gray-200 text-sm">
                Comments
                {validationRules?.comments.required && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </Label>
              <Select onValueChange={handleTemplateSelect} defaultValue="none">
                <SelectTrigger className="w-full sm:w-[200px] dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 text-sm">
                  <SelectValue placeholder="Use template" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                  <SelectItem value="none">Select template</SelectItem>
                  {COMMENT_TEMPLATES.map((template) => (
                    <SelectItem key={template.label} value={template.value} className="dark:text-gray-200 dark:focus:bg-gray-700 text-sm">
                      {template.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Enhanced comment input with avatar */}
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 transition-all duration-200 hover:shadow-md focus-within:shadow-md focus-within:border-blue-300 dark:focus-within:border-blue-700">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center font-medium shadow-sm transition-transform duration-200 hover:scale-110">
                  {userData?.name ? userData.name.charAt(0).toUpperCase() : 'U'}
                </div>
              </div>

              <div className="flex-1">
                <Textarea
                  id="comments"
                  value={formData.initialComment || ''}
                  onChange={(e) => {
                    const text = e.target.value;
                    updateField("initialComment", text);
                  }}
                  placeholder={`Add any comments about this report...${validationRules?.comments.required
                    ? ` (Minimum ${validationRules.comments.minLength} characters)`
                    : ""
                    }`}
                  className="min-h-[100px] border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 shadow-none resize-none dark:bg-transparent dark:text-gray-200 dark:placeholder:text-gray-400 text-sm transition-all duration-200 leading-relaxed"
                  autoFocus
                />

                {/* Character count and validation */}
                <div className="flex justify-between items-center mt-2">
                  {validationRules?.comments.required && (
                    <p className="text-xs text-muted-foreground dark:text-gray-400">
                      {formData.initialComment
                        ? formData.initialComment.length
                        : 0}/{validationRules.comments.minLength} characters minimum
                    </p>
                  )}

                  {/* Emoji buttons */}
                  <div className="flex space-x-1">
                    {['😊', '👍', '🎉', '❤️', '🔥'].map((emoji) => (
                      <Button
                        key={emoji}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 hover:scale-110 focus:scale-110 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 group"
                        onClick={() => {
                          const text = formData.initialComment
                            ? formData.initialComment + ' ' + emoji
                            : emoji;

                          updateField("initialComment", text);

                          toast({
                            title: "Emoji Added",
                            description: `Added ${emoji} to your comment`,
                          });
                        }}
                      >
                        <span role="img" aria-label="emoji" className="text-lg transform transition-transform duration-200 group-hover:scale-125">{emoji}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {errors.initialComment && (
              <p className="text-sm text-red-500">{errors.initialComment}</p>
            )}
          </div>

          {/* Display plan data if available when creating an actual report */}
          {reportType === "actual" && (
            <div className="bg-muted p-4 rounded-lg mb-4 dark:bg-gray-700">
              <h3 className="text-sm font-semibold mb-2 dark:text-gray-200">Morning Plan Data</h3>
              {planDataLoading ? (
                <div className="text-center py-2">
                  <div className="animate-spin h-5 w-5 mx-auto border-2 border-primary rounded-full border-t-transparent dark:border-gray-300 dark:border-t-transparent"></div>
                  <p className="text-sm mt-1 dark:text-gray-300">Loading plan data...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="planWriteOffs" className="text-xs dark:text-gray-300">Write-offs (Plan)</Label>
                    <p id="planWriteOffs" className="text-sm font-medium dark:text-gray-200">
                      {planData.writeOffsPlan !== null
                        ? formatKHRCurrency(planData.writeOffsPlan)
                        : (
                          <span className="text-muted-foreground italic dark:text-gray-400">
                            No plan data available
                          </span>
                        )}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="planNinetyPlus" className="text-xs dark:text-gray-300">90+ Days (Plan)</Label>
                    <p id="planNinetyPlus" className="text-sm font-medium dark:text-gray-200">
                      {planData.ninetyPlusPlan !== null
                        ? formatKHRCurrency(planData.ninetyPlusPlan)
                        : (
                          <span className="text-muted-foreground italic dark:text-gray-400">
                            No plan data available
                          </span>
                        )}
                    </p>
                  </div>
                </div>
              )}
              {formData.date && !planDataLoading && planData.writeOffsPlan === null && (
                <Alert className="mt-3 bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertDescription className="text-amber-700 text-xs dark:text-amber-300">
                    No morning plan found for this date and branch. Please ensure a plan report is submitted first.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>
        {/* Show warning if this is an actual report and plan report is not approved */}
        {reportType === "actual" && planData.planReportId && planData.planReportStatus !== "approved" && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              The plan report for this date must be approved before you can submit an actual report.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter className="sticky bottom-0 bg-background dark:bg-gray-800 z-10 pt-4 border-t dark:border-gray-700">
          <Button variant="outline" onClick={onClose} className="dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 text-sm">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || (reportType === "actual" && !!planData.planReportId && planData.planReportStatus !== "approved")}
            className="dark:bg-blue-700 dark:hover:bg-blue-600 text-sm"
          >
            {isSubmitting ? "Creating..." : "Create Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}