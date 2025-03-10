"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon } from "@radix-ui/react-icons";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";

type Branch = {
  id: string;
  code: string;
  name: string;
};

export default function CreateReport() {
  const router = useRouter();
  const [date, setDate] = useState<Date>();
  const [branchId, setBranchId] = useState("");
  const [writeOffs, setWriteOffs] = useState("");
  const [ninetyPlus, setNinetyPlus] = useState("");
  const [comments, setComments] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch branches on component mount
  useEffect(() => {
    const fetchBranches = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/branches");
        if (!response.ok) {
          throw new Error("Failed to fetch branches");
        }
        const branches = await response.json();
        setBranches(branches || []);
      } catch (error) {
        console.error("Error fetching branches:", error);
        toast({
          title: "Error",
          description: "Failed to load branches. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchBranches();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
          date: date.toISOString(),
          branchId,
          writeOffs: parseFloat(writeOffs),
          ninetyPlus: parseFloat(ninetyPlus),
          comments,
          // The API will get the submittedBy from the JWT token
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit report");
      }

      toast({
        title: "Success",
        description: "Report submitted successfully",
      });

      // Reset form
      setDate(undefined);
      setBranchId("");
      setWriteOffs("");
      setNinetyPlus("");
      setComments("");

      // Redirect to reports page
      router.push("/reports");
      router.refresh();
    } catch (error) {
      console.error("Error submitting report:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to submit report",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit Daily Report</CardTitle>
        <CardDescription>
          Enter the daily report data for your branch.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Select a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="branch">Branch *</Label>
            <Select
              value={branchId}
              onValueChange={setBranchId}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    isLoading ? "Loading branches..." : "Select branch"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.code} - {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="writeOffs">Write-offs (Amount in KHR) *</Label>
            <Input
              id="writeOffs"
              type="number"
              step="0.01"
              min="0"
              placeholder="Enter write-offs amount in KHR"
              value={writeOffs}
              onChange={(e) => setWriteOffs(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ninetyPlus">90+ Days (Amount in KHR) *</Label>
            <Input
              id="ninetyPlus"
              type="number"
              step="0.01"
              min="0"
              placeholder="Enter 90+ days amount in KHR"
              value={ninetyPlus}
              onChange={(e) => setNinetyPlus(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="comments">Comments</Label>
            <Textarea
              id="comments"
              placeholder="Add any additional comments or notes"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit Report"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
