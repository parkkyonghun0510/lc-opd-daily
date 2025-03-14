"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { KHCurrencyInput } from "@/components/ui/currency-input";

interface Branch {
  id: string;
  code: string;
  name: string;
}

interface CreateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: "plan" | "actual";
  onSuccess: () => void;
  userBranches: Branch[];
  isAdmin: boolean;
  defaultBranchId?: string;
}

export function CreateReportModal({
  isOpen,
  onClose,
  reportType,
  onSuccess,
  userBranches: initialBranches,
  isAdmin,
  defaultBranchId,
}: CreateReportModalProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [branchId, setBranchId] = useState(defaultBranchId || "");
  const [writeOffs, setWriteOffs] = useState("");
  const [ninetyPlus, setNinetyPlus] = useState("");
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [branches, setBranches] = useState<Branch[]>(initialBranches || []);
  const [isBranchesLoading, setIsBranchesLoading] = useState(false);
  const [branchError, setBranchError] = useState("");

  // Fetch branches when modal opens
  useEffect(() => {
    if (isOpen) {
      // Always fetch branches when the modal opens to ensure we have the latest data
      fetchUserBranches();
    }
  }, [isOpen]);

  // Handle branch selection change
  useEffect(() => {
    // If we have a default branch ID and it's in the available branches, use it
    if (defaultBranchId && branches.some((b) => b.id === defaultBranchId)) {
      setBranchId(defaultBranchId);
    }
    // If there's only one branch and no selection yet, select it automatically
    else if (branches.length === 1 && !branchId) {
      setBranchId(branches[0].id);
    }
    // If we have branches but current selection isn't in the list, clear it
    else if (
      branches.length > 0 &&
      branchId &&
      !branches.some((b) => b.id === branchId)
    ) {
      setBranchId("");
    }
  }, [branches, defaultBranchId]);

  // Fetch branches for the current user
  const fetchUserBranches = async () => {
    setIsBranchesLoading(true);
    setBranchError("");

    try {
      const response = await fetch("/api/branches");

      if (!response.ok) {
        throw new Error("Failed to fetch branches");
      }

      const data = await response.json();
      setBranches(Array.isArray(data) ? data : data.branches || []);
    } catch (error) {
      console.error("Error fetching branches:", error);
      setBranchError("Failed to load branches");
      setBranches([]);
    } finally {
      setIsBranchesLoading(false);
    }
  };

  // Reset the form when it closes
  useEffect(() => {
    if (!isOpen) {
      // Don't reset branch selection - we want to preserve it between openings
      setWriteOffs("");
      setNinetyPlus("");
      setComments("");
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!date) {
      toast({
        title: "Validation Error",
        description: "Please select a date",
        variant: "destructive",
      });
      return;
    }

    if (!branchId) {
      toast({
        title: "Validation Error",
        description: "Please select a branch",
        variant: "destructive",
      });
      return;
    }

    if (!writeOffs || !ninetyPlus) {
      toast({
        title: "Validation Error",
        description: "Please enter both Write-offs and 90+ Days amounts",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: format(date, "yyyy-MM-dd"),
          branchId,
          writeOffs: parseFloat(writeOffs),
          ninetyPlus: parseFloat(ninetyPlus),
          comments,
          reportType,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create report");
      }

      toast({
        title: "Success",
        description: "Report created successfully",
      });

      // Reset form
      setDate(new Date());
      // Don't reset branch if user has only one branch
      if (branches.length > 1) {
        setBranchId(defaultBranchId || "");
      }
      setWriteOffs("");
      setNinetyPlus("");
      setComments("");

      onSuccess();
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create report",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <span
              className={cn(
                "inline-block w-3 h-3 rounded-full mr-2",
                reportType === "plan" ? "bg-blue-600" : "bg-green-600"
              )}
            ></span>
            Create {reportType === "plan" ? "Morning Plan" : "Evening Actual"}{" "}
            Report
          </DialogTitle>
          <DialogDescription>
            Submit a new {reportType === "plan" ? "plan" : "actual"} report for
            write-offs and 90+ days collection
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label
              htmlFor="date"
              className="col-span-4 flex items-center text-base"
            >
              <span className="inline-block w-2 h-2 rounded-full mr-2 bg-gray-600"></span>
              Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full col-span-4 justify-start text-left font-normal",
                    !date && "text-muted-foreground",
                    reportType === "plan"
                      ? "border-blue-200 hover:border-blue-300 focus:border-blue-500"
                      : "border-green-200 hover:border-green-300 focus:border-green-500"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label
              htmlFor="branch"
              className="col-span-4 flex items-center text-base"
            >
              <span className="inline-block w-2 h-2 rounded-full mr-2 bg-gray-600"></span>
              Branch
            </Label>

            {/* Loading state */}
            {isBranchesLoading && (
              <div className="col-span-4 flex items-center justify-center py-3 px-4 border rounded-md bg-gray-50 dark:bg-gray-800">
                <Loader2 className="h-4 w-4 mr-2 animate-spin text-gray-400" />
                <span className="text-sm text-gray-500">
                  Loading branches...
                </span>
              </div>
            )}

            {/* Error state */}
            {branchError && !isBranchesLoading && (
              <div className="col-span-4 text-red-600 text-sm border border-red-200 rounded-md p-3 bg-red-50 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300">
                {branchError}
                <Button
                  variant="link"
                  className="p-0 h-auto text-xs text-red-600 dark:text-red-300 ml-2"
                  onClick={fetchUserBranches}
                >
                  Retry
                </Button>
              </div>
            )}

            {/* Branch selection - based on user role and available branches */}
            {!isBranchesLoading && !branchError && (
              <>
                {/* Admin users - show branch selector dropdown */}
                {isAdmin && (
                  <>
                    {branches.length > 0 ? (
                      <Select value={branchId} onValueChange={setBranchId}>
                        <SelectTrigger
                          className={cn(
                            "col-span-4",
                            reportType === "plan"
                              ? "border-blue-200 hover:border-blue-300 focus:border-blue-500"
                              : "border-green-200 hover:border-green-300 focus:border-green-500"
                          )}
                        >
                          <SelectValue placeholder="Select branch" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              <span className="font-medium">{branch.code}</span>{" "}
                              - {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="col-span-4 text-muted-foreground text-sm border rounded-md p-3 bg-gray-50 dark:bg-gray-800">
                        No branches available. Please create a branch first.
                      </div>
                    )}
                  </>
                )}

                {/* Non-admin users */}
                {!isAdmin && (
                  <>
                    {branches.length > 0 ? (
                      <>
                        {/* If only one branch is available, show it with a badge */}
                        {branches.length === 1 ? (
                          <div
                            className={cn(
                              "col-span-4 flex justify-between items-center border rounded-md px-3 py-2 text-sm",
                              reportType === "plan"
                                ? "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300"
                                : "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300"
                            )}
                          >
                            <div>
                              <span className="font-medium">
                                {branches[0].code}
                              </span>{" "}
                              - {branches[0].name}
                            </div>
                            <div>
                              <Badge variant="outline" className="text-xs">
                                Your Branch
                              </Badge>
                            </div>
                          </div>
                        ) : (
                          /* Multiple branches - show selector */
                          <Select value={branchId} onValueChange={setBranchId}>
                            <SelectTrigger
                              className={cn(
                                "col-span-4",
                                reportType === "plan"
                                  ? "border-blue-200 hover:border-blue-300 focus:border-blue-500"
                                  : "border-green-200 hover:border-green-300 focus:border-green-500"
                              )}
                            >
                              <SelectValue placeholder="Select your branch" />
                            </SelectTrigger>
                            <SelectContent>
                              {branches.map((branch) => (
                                <SelectItem key={branch.id} value={branch.id}>
                                  <div className="flex justify-between items-center w-full">
                                    <span>
                                      <span className="font-medium">
                                        {branch.code}
                                      </span>{" "}
                                      - {branch.name}
                                    </span>
                                    {branch.id === defaultBranchId && (
                                      <Badge
                                        variant="outline"
                                        className="ml-2 text-xs"
                                      >
                                        Default
                                      </Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </>
                    ) : (
                      <div className="col-span-4 text-amber-600 text-sm border border-amber-200 rounded-md p-3 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300">
                        You don&apos;t have a branch assigned. Please contact an
                        administrator.
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label
              htmlFor="writeOffs"
              className="col-span-4 flex items-center text-base"
            >
              <span
                className={cn(
                  "inline-block w-2 h-2 rounded-full mr-2",
                  reportType === "plan" ? "bg-blue-600" : "bg-green-600"
                )}
              ></span>
              {reportType === "plan" ? "Write-offs Plan" : "Write-offs Actual"}
            </Label>
            <div className="col-span-4 relative">
              <KHCurrencyInput
                value={writeOffs}
                onValueChange={(rawValue: string) => setWriteOffs(rawValue)}
                className={cn(
                  "font-mono",
                  reportType === "plan"
                    ? "border-blue-200 hover:border-blue-300 focus:border-blue-500"
                    : "border-green-200 hover:border-green-300 focus:border-green-500"
                )}
              />
              <div className="text-xs text-gray-500 mt-1">
                Amount in Cambodian Riel (KHR)
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label
              htmlFor="ninetyPlus"
              className="col-span-4 flex items-center text-base"
            >
              <span
                className={cn(
                  "inline-block w-2 h-2 rounded-full mr-2",
                  reportType === "plan" ? "bg-blue-600" : "bg-green-600"
                )}
              ></span>
              {reportType === "plan" ? "90+ Days Plan" : "90+ Days Actual"}
            </Label>
            <div className="col-span-4 relative">
              <KHCurrencyInput
                value={ninetyPlus}
                onValueChange={(rawValue: string) => setNinetyPlus(rawValue)}
                className={cn(
                  "font-mono",
                  reportType === "plan"
                    ? "border-blue-200 hover:border-blue-300 focus:border-blue-500"
                    : "border-green-200 hover:border-green-300 focus:border-green-500"
                )}
              />
              <div className="text-xs text-gray-500 mt-1">
                Amount in Cambodian Riel (KHR)
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label
              htmlFor="comments"
              className="col-span-4 flex items-center text-base"
            >
              <span className="inline-block w-2 h-2 rounded-full mr-2 bg-gray-400"></span>
              Comments
            </Label>
            <Textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className={cn(
                "col-span-4 min-h-[100px]",
                reportType === "plan"
                  ? "border-blue-200 hover:border-blue-300 focus:border-blue-500"
                  : "border-green-200 hover:border-green-300 focus:border-green-500"
              )}
              placeholder="Add any additional details or notes about this report..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={cn(
              reportType === "plan"
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-green-600 hover:bg-green-700"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Report"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
