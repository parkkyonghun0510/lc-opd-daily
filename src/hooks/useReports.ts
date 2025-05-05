import { useState, useEffect } from "react";
import { format } from "date-fns";
import { toast } from "@/components/ui/use-toast";
import type {
  Report,
  Branch,
  ReportType,
  PaginationInfo,
  CreateReportData,
} from "@/types/reports";

interface UseReportsProps {
  initialStartDate?: Date;
  initialEndDate?: Date;
  initialReportType?: ReportType;
  initialBranchId?: string;
  initialSubmittedBy?: string;
  pageSize?: number;
}

export function useReports({
  initialStartDate,
  initialEndDate,
  initialReportType = "actual",
  initialBranchId,
  initialSubmittedBy,
  pageSize = 10,
}: UseReportsProps = {}) {
  const [startDate, setStartDate] = useState<Date | undefined>(initialStartDate);
  const [endDate, setEndDate] = useState<Date | undefined>(initialEndDate);
  const [reportType, setReportType] = useState<ReportType>(initialReportType);
  const [selectedBranchId, setSelectedBranchId] = useState<string | undefined>(
    initialBranchId
  );
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(
    initialSubmittedBy
  );
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    limit: pageSize,
    totalPages: 0,
  });
  const [userBranches, setUserBranches] = useState<Branch[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch reports
  const fetchReports = async () => {
    setIsLoading(true);
    // Clear existing reports before fetching new ones to avoid displaying incorrect data
    setReports([]);
    try {
      let url = `/api/reports?page=${pagination.page}&limit=${pagination.limit}`;

      // Add date range parameters if set
      if (startDate) {
        url += `&startDate=${format(startDate, "yyyy-MM-dd")}`;
      }

      if (endDate) {
        url += `&endDate=${format(endDate, "yyyy-MM-dd")}`;
      }

      // For backward compatibility, if only startDate is set, also set it as "date" parameter
      if (startDate && !endDate) {
        url += `&date=${format(startDate, "yyyy-MM-dd")}`;
      }

      if (selectedBranchId) {
        url += `&branchId=${selectedBranchId}`;
      }

      if (selectedUserId) {
        url += `&submittedBy=${selectedUserId}`;
      }

      // Add report type to the query params
      url += `&reportType=${reportType}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch reports");
      }

      const data = await response.json();
      setReports(data.data ?? []);
      setPagination(
        data.pagination ?? {
          total: 0,
          page: 1,
          limit: pageSize,
          totalPages: 0,
        }
      );
    } catch (error) {
      toast({
        title: "Error Loading Reports",
        description:
          error instanceof Error
            ? error.message
            : "Failed to load reports. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate total amounts from reports
  const calculateTotals = () => {
    return reports.reduce(
      (acc, report) => {
        acc.totalWriteOffs += report.writeOffs || 0;
        acc.totalNinetyPlus += report.ninetyPlus || 0;
        return acc;
      },
      { totalWriteOffs: 0, totalNinetyPlus: 0 }
    );
  };

  // Export reports to CSV
  const exportReportsToCSV = async () => {
    try {
      setIsExporting(true);
      let url = `/api/reports/export?format=csv&limit=1000`;

      // Add date range parameters
      if (startDate) {
        url += `&startDate=${format(startDate, "yyyy-MM-dd")}`;
      }

      if (endDate) {
        url += `&endDate=${format(endDate, "yyyy-MM-dd")}`;
      }

      // For backward compatibility
      if (startDate && !endDate) {
        url += `&date=${format(startDate, "yyyy-MM-dd")}`;
      }

      if (selectedBranchId) {
        url += `&branchId=${selectedBranchId}`;
      }

      if (selectedUserId) {
        url += `&submittedBy=${selectedUserId}`;
      }

      url += `&reportType=${reportType}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to export reports");
      }

      // Handle the CSV download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `reports-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: "Reports exported to CSV successfully",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export reports",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Export reports to PDF
  const exportReportsToPDF = async () => {
    try {
      setIsExporting(true);
      let url = `/api/reports/export?format=pdf&limit=1000`;

      // Add date range parameters
      if (startDate) {
        url += `&startDate=${format(startDate, "yyyy-MM-dd")}`;
      }

      if (endDate) {
        url += `&endDate=${format(endDate, "yyyy-MM-dd")}`;
      }

      // For backward compatibility
      if (startDate && !endDate) {
        url += `&date=${format(startDate, "yyyy-MM-dd")}`;
      }

      if (selectedBranchId) {
        url += `&branchId=${selectedBranchId}`;
      }

      if (selectedUserId) {
        url += `&submittedBy=${selectedUserId}`;
      }

      url += `&reportType=${reportType}`;

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to export reports");
      }

      // Handle the PDF download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `reports-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: "Reports exported to PDF successfully",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export reports",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Fetch user branches
  const fetchUserBranches = async () => {
    try {
      // Always use the user-filtered branch list for reports
      const response = await fetch("/api/branches?filterByAccess=true");

      if (!response.ok) {
        throw new Error("Failed to fetch branches");
      }

      const data = await response.json();
      const branches = Array.isArray(data) ? data : data.branches || [];

      // Only include active branches
      const activeBranches = branches.filter((branch: any) => branch.isActive);

      // Sort branches by code for consistency
      activeBranches.sort((a: any, b: any) => a.code.localeCompare(b.code));

      setUserBranches(activeBranches);

      // If we have branches but no selected branch, select the first one
      if (activeBranches.length > 0 && !selectedBranchId) {
        setSelectedBranchId(activeBranches[0].id);
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
      toast({
        title: "Error Loading Branches",
        description: "Failed to load branches. Please try again later.",
        variant: "destructive",
      });
    }
  };

  // Create a new report
  const createReport = async (data: CreateReportData) => {
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create report");
      }

      toast({
        title: "Success",
        description: "Report created successfully",
      });

      // Refresh the reports list
      await fetchReports();
      return true;
    } catch (error) {
      console.error("Error creating report:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create report",
        variant: "destructive",
      });
      return false;
    }
  };

  // Update an existing report
  const updateReport = async (id: string, data: Partial<CreateReportData>) => {
    try {
      const response = await fetch("/api/reports", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, ...data }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update report");
      }

      toast({
        title: "Success",
        description: "Report updated successfully",
      });

      // Refresh the reports list
      await fetchReports();
      return true;
    } catch (error) {
      console.error("Error updating report:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update report",
        variant: "destructive",
      });
      return false;
    }
  };

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  // Jump to a specific page
  const goToPage = (page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page }));
    }
  };

  // Change page size
  const setPageSize = (size: number) => {
    setPagination((prev) => ({
      ...prev,
      limit: size,
      page: 1 // Reset to first page when changing page size
    }));
  };

  // Handle filters
  const handleFilter = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchReports();
  };

  // Clear all filters
  const clearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedBranchId(undefined);
    setSelectedUserId(undefined);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Effects
  useEffect(() => {
    fetchUserBranches();
  }, []);

  // Initialize selectedBranchId with first branch if not already set
  useEffect(() => {
    if (userBranches.length > 0 && !selectedBranchId) {
      setSelectedBranchId(userBranches[0].id);
    }
  }, [userBranches, selectedBranchId]);

  useEffect(() => {
    fetchReports();
  }, [pagination.page, pagination.limit, startDate, endDate, reportType, selectedBranchId, selectedUserId]);

  return {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    reportType,
    setReportType,
    selectedBranchId,
    setSelectedBranchId,
    selectedUserId,
    setSelectedUserId,
    reports,
    isLoading,
    pagination,
    userBranches,
    handlePageChange,
    goToPage,
    setPageSize,
    handleFilter,
    clearFilters,
    createReport,
    updateReport,
    fetchReports,
    exportReportsToCSV,
    exportReportsToPDF,
    isExporting,
    calculateTotals,
  };
}
