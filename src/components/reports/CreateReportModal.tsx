"use client";

import { format } from "date-fns";
import { CalendarIcon, AlertCircle, Info } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
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
import React, { useState } from "react";
import { BranchSelector } from "@/components/ui/branch-selector";
import { useUserData } from "@/contexts/UserDataContext";

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
  } = useReportForm({
    reportType,
    userBranches,
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  const { userData } = useUserData();

  // For users with only one branch, automatically select it
  React.useEffect(() => {
    if (userBranches.length === 1 && !formData.branchId) {
      updateField("branchId", userBranches[0].id);
    }
  }, [userBranches, formData.branchId, updateField]);

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

  const handleTemplateSelect = (template: string) => {
    if (template === "custom") {
      updateField("comments", "");
    } else {
      updateField("comments", template);
    }
  };

  // Get today's date at noon for consistent comparison
  const today = new Date();
  today.setHours(12, 0, 0, 0);

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
                  
                  // Don't update if future date
                  if (selectedDate > today) return;
                  
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
                  // This should allow selecting today's date but disable future dates
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
