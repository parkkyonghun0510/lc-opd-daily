"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ReportDetailModal } from "@/components/reports/ReportDetailModal";
import { Report } from "@/types/reports";

interface ReportWithUser extends Omit<Report, 'user'> {
  user: {
    id: string;
    name: string;
    username?: string;
  } | null;
  ReportComment?: any[];
}

export function ReportViewHandler() {
  const searchParams = useSearchParams();
  const reportId = searchParams?.get("viewReport") || null;
  const action = searchParams?.get("action") || null;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [report, setReport] = useState<ReportWithUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (reportId) {
      fetchReport(reportId);
    } else {
      setReport(null);
      setIsModalOpen(false);
    }
  }, [reportId]);

  const fetchReport = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/${id}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch report: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.report) {
        // Convert dates to strings if they're Date objects
        const reportWithStringDates = {
          ...data.report,
          createdAt: data.report.createdAt.toString(),
          updatedAt: data.report.updatedAt.toString(),
          // Convert ReportComment dates to strings if they exist
          ReportComment: data.report.ReportComment?.map((comment: any) => ({
            ...comment,
            createdAt: comment.createdAt.toString(),
            updatedAt: comment.updatedAt.toString()
          }))
        };

        setReport(reportWithStringDates);
        setIsModalOpen(true);
      } else {
        throw new Error("Report not found");
      }
    } catch (err) {
      console.error("Error fetching report:", err);
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Clear the URL parameters when closing the modal
    const url = new URL(window.location.href);
    url.searchParams.delete("viewReport");
    url.searchParams.delete("action");
    window.history.replaceState({}, "", url.toString());
  };

  const handleEditReport = (report: Report) => {
    // Implement edit functionality if needed
    console.log("Edit report:", report.id);
    // You could open an edit modal or navigate to an edit page
  };

  // Only render the modal if we have a report
  if (!reportId || !report) {
    return null;
  }

  return (
    <ReportDetailModal
      report={report}
      isOpen={isModalOpen}
      onClose={handleCloseModal}
      onEdit={handleEditReport}
      initialAction={action || undefined}
    />
  );
}
