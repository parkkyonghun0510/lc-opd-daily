"use client";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@radix-ui/react-icons";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PencilIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/use-toast";
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
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

type Report = {
  id: string;
  date: string;
  branch: {
    id: string;
    code: string;
    name: string;
  };
  writeOffs: number;
  ninetyPlus: number;
  status: string;
  submittedBy: string;
  submittedAt: string;
  comments?: string;
};

type PaginationInfo = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export default function ViewReports() {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [editWriteOffs, setEditWriteOffs] = useState("");
  const [editNinetyPlus, setEditNinetyPlus] = useState("");
  const [editComments, setEditComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch reports on component mount and when filters change
  useEffect(() => {
    fetchReports();
  }, [pagination.page, date]);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      let url = `/api/reports?page=${pagination.page}&limit=${pagination.limit}`;

      if (date) {
        url += `&date=${date.toISOString().split("T")[0]}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch reports");
      }

      const data = await response.json();
      console.log(data);
      setReports(data.reports || []);
      setPagination(data.pagination || pagination);
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast({
        title: "Error",
        description: "Failed to load reports. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilter = () => {
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page when applying filters
    fetchReports();
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // const formatCurrency = (amount: number) => {
  //   return new Intl.NumberFormat("km-KH", {
  //     style: "currency",
  //     currency: "KHR",
  //     currencyDisplay: "symbol",
  //     minimumFractionDigits: 3,
  //   }).format(amount);
  // };
  const formatCurrency = (amount: number) => {
    // First format with the standard formatter
    const formatted = new Intl.NumberFormat("km-KH", {
      style: "currency",
      currency: "KHR",
      minimumFractionDigits: 2,
    }).format(amount);

    // Replace "KHR" with the Riel symbol "៛"
    return formatted.replace("KHR", "៛");
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-500";
      case "pending":
        return "bg-yellow-500";
      case "rejected":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const handleEditClick = (report: Report) => {
    setEditingReport(report);
    setEditWriteOffs(report.writeOffs.toString());
    setEditNinetyPlus(report.ninetyPlus.toString());
    setEditComments(report.comments || "");
    setIsEditModalOpen(true);
  };

  const handleUpdateReport = async () => {
    if (!editingReport) return;

    setIsSubmitting(true);
    try {
      // Create route.ts or report/[id]/route.ts doesn't exist, we'll use POST with method: 'PUT'
      const response = await fetch(`/api/reports/${editingReport.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          writeOffs: parseFloat(editWriteOffs),
          ninetyPlus: parseFloat(editNinetyPlus),
          comments: editComments,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update report");
      }

      // Update the reports list
      const updatedReport = await response.json();
      setReports(
        reports.map((r) => (r.id === updatedReport.id ? updatedReport : r))
      );

      toast({
        title: "Success",
        description: "Report updated successfully",
      });

      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Error updating report:", error);
      toast({
        title: "Error",
        description: "Failed to update report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>View Reports</CardTitle>
        <CardDescription>Browse and filter daily reports</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Responsive filter controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 space-y-4 md:space-y-0">
          <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-2">
            <span className="text-sm font-medium">Filter By Date</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full md:w-auto justify-start text-left font-normal",
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
          <Button
            onClick={handleFilter}
            className="bg-green-600 hover:bg-green-700 w-full md:w-auto"
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Apply Filters"}
          </Button>
        </div>

        {/* Responsive table with horizontal scroll on small screens */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Branch</TableHead>
                <TableHead className="whitespace-nowrap">Date</TableHead>
                <TableHead className="whitespace-nowrap">Write-offs</TableHead>
                <TableHead className="whitespace-nowrap">90+ Days</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="whitespace-nowrap">
                  Submitted By
                </TableHead>
                <TableHead className="whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4">
                    Loading reports...
                  </TableCell>
                </TableRow>
              ) : reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4">
                    No reports found
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="whitespace-nowrap">
                      {report.branch.code}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(report.date)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatCurrency(report.writeOffs)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatCurrency(report.ninetyPlus)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge className={getStatusBadgeColor(report.status)}>
                        {report.status.charAt(0).toUpperCase() +
                          report.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {report.submittedBy}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditClick(report)}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination controls */}
        {pagination.totalPages > 0 && (
          <div className="flex items-center justify-center space-x-2 mt-4">
            <Button
              variant="outline"
              size="icon"
              disabled={pagination.page <= 1 || isLoading}
              onClick={() => handlePageChange(pagination.page - 1)}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={pagination.page >= pagination.totalPages || isLoading}
              onClick={() => handlePageChange(pagination.page + 1)}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        )}

        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Report</DialogTitle>
              <DialogDescription>
                Update the report details for {editingReport?.branch.name} (
                {editingReport?.branch.code})
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="writeOffs" className="col-span-4">
                  Write-offs (Amount in KHR)
                </Label>
                <Input
                  id="writeOffs"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editWriteOffs}
                  onChange={(e) => setEditWriteOffs(e.target.value)}
                  className="col-span-4"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="ninetyPlus" className="col-span-4">
                  90+ Days (Amount in KHR)
                </Label>
                <Input
                  id="ninetyPlus"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editNinetyPlus}
                  onChange={(e) => setEditNinetyPlus(e.target.value)}
                  className="col-span-4"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="comments" className="col-span-4">
                  Comments
                </Label>
                <Textarea
                  id="comments"
                  value={editComments}
                  onChange={(e) => setEditComments(e.target.value)}
                  className="col-span-4"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateReport} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
