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
  initialDate?: Date;
  initialReportType?: ReportType;
  initialBranchId?: string;
  pageSize?: number;
}

export function useReports({
  initialDate,
  initialReportType = "actual",
  initialBranchId,
  pageSize = 10,
}: UseReportsProps = {}) {
  const [date, setDate] = useState<Date | undefined>(initialDate);
  const [reportType, setReportType] = useState<ReportType>(initialReportType);
  const [selectedBranchId, setSelectedBranchId] = useState<string | undefined>(
    initialBranchId
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

  // Fetch reports
  const fetchReports = async () => {
    setIsLoading(true);
    // Clear existing reports before fetching new ones to avoid displaying incorrect data
    setReports([]);
    try {
      let url = `/api/reports?page=${pagination.page}&limit=${pagination.limit}`;

      if (date) {
        url += `&date=${format(date, "yyyy-MM-dd")}`;
      }

      if (selectedBranchId) {
        url += `&branchId=${selectedBranchId}`;
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

  // Handle filters
  const handleFilter = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchReports();
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
  }, [pagination.page, date, reportType, selectedBranchId]);

  return {
    date,
    setDate,
    reportType,
    setReportType,
    selectedBranchId,
    setSelectedBranchId,
    reports,
    isLoading,
    pagination,
    userBranches,
    handlePageChange,
    handleFilter,
    createReport,
    updateReport,
    fetchReports,
  };
}
