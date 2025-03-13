"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  userBranches,
  isAdmin,
  defaultBranchId,
}: CreateReportModalProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [branchId, setBranchId] = useState(defaultBranchId || "");
  const [writeOffs, setWriteOffs] = useState("");
  const [ninetyPlus, setNinetyPlus] = useState("");
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!date || !branchId || !writeOffs || !ninetyPlus) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
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
      setBranchId(defaultBranchId || "");
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
          <DialogTitle>
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
            <Label htmlFor="date" className="col-span-4">
              Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full col-span-4 justify-start text-left font-normal",
                    !date && "text-muted-foreground"
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

          {isAdmin && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="branch" className="col-span-4">
                Branch
              </Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="col-span-4">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {userBranches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.code} - {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="writeOffs" className="col-span-4">
              {reportType === "plan" ? "Write-offs Plan" : "Write-offs Actual"}{" "}
              (Amount in KHR)
            </Label>
            <Input
              id="writeOffs"
              type="number"
              step="0.01"
              min="0"
              value={writeOffs}
              onChange={(e) => setWriteOffs(e.target.value)}
              className="col-span-4"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="ninetyPlus" className="col-span-4">
              {reportType === "plan" ? "90+ Days Plan" : "90+ Days Actual"}{" "}
              (Amount in KHR)
            </Label>
            <Input
              id="ninetyPlus"
              type="number"
              step="0.01"
              min="0"
              value={ninetyPlus}
              onChange={(e) => setNinetyPlus(e.target.value)}
              className="col-span-4"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="comments" className="col-span-4">
              Comments
            </Label>
            <Textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="col-span-4"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
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
