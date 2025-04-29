"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { EnhancedReportApproval } from "@/components/reports/EnhancedReportApproval";
import { getReportDetailsAction } from "@/app/_actions/report-actions";
import { Report } from "@/types/reports";
import { format } from "date-fns";

// Helper function to safely format dates
const safeFormatDate = (dateValue: string | Date | null | undefined): string => {
  if (!dateValue) return "N/A";

  try {
    // If it's already a string, return it
    if (typeof dateValue === 'string') return dateValue;

    // If it's a Date object, format it
    if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
      return format(dateValue, "yyyy-MM-dd");
    }

    // Try to convert to Date and format
    const date = new Date(dateValue as any);
    if (!isNaN(date.getTime())) {
      return format(date, "yyyy-MM-dd");
    }

    return String(dateValue);
  } catch (error) {
    console.error("Error formatting date:", error);
    return String(dateValue);
  }
};

export default function TestApprovalPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reportId, setReportId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async (id: string) => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await getReportDetailsAction(id);

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch report");
      }

      // Cast to unknown first to avoid TypeScript errors
      setReport(result.report as unknown as Report);
    } catch (err) {
      console.error("Error fetching report:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    if (report?.id) {
      fetchReport(report.id);
    }
  };

  // Sample report IDs for testing - replace with actual IDs from your database
  const sampleReportIds = [
    { id: "clsqnvnxs0001ufwxgxvx9yjl", status: "pending" },
    { id: "clsqnvnxs0002ufwxgxvx9yjl", status: "approved" },
    { id: "clsqnvnxs0003ufwxgxvx9yjl", status: "rejected" }
  ];

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Enhanced Report Approval Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-2">Select a Report</h3>
            <div className="flex flex-wrap gap-2">
              {sampleReportIds.map((sample) => (
                <Button
                  key={sample.id}
                  variant="outline"
                  onClick={() => fetchReport(sample.id)}
                >
                  Test {sample.status} Report
                </Button>
              ))}

              <div className="flex items-center gap-2 mt-4 w-full">
                <input
                  type="text"
                  value={reportId}
                  onChange={(e) => setReportId(e.target.value)}
                  placeholder="Enter a report ID"
                  className="flex-1 p-2 border rounded"
                />
                <Button
                  onClick={() => fetchReport(reportId)}
                  disabled={!reportId.trim()}
                >
                  Fetch Report
                </Button>
              </div>
            </div>
          </div>

          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
              <h3 className="font-medium">Error</h3>
              <p>{error}</p>
            </div>
          )}

          {report && !isLoading && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Report Details</h3>
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                  Refresh
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
                  <h4 className="font-medium mb-2">Report Info</h4>
                  <p><strong>ID:</strong> {report.id}</p>
                  <p><strong>Date:</strong> {safeFormatDate(report.date)}</p>
                  <p><strong>Branch:</strong> {report.branch?.name}</p>
                  <p><strong>Status:</strong> {report.status}</p>
                  <p><strong>Type:</strong> {report.reportType}</p>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
                  <h4 className="font-medium mb-2">Financial Data</h4>
                  <p><strong>Write-offs:</strong> {report.writeOffs}</p>
                  <p><strong>90+ Days:</strong> {report.ninetyPlus}</p>
                  <p><strong>Submitted By:</strong> {report.user?.name || report.submittedBy}</p>
                  <p><strong>Submitted At:</strong> {safeFormatDate(report.submittedAt)}</p>
                </div>
              </div>

              <div className="mt-6 border-t pt-6">
                <h3 className="text-lg font-medium mb-4">Enhanced Report Approval Component</h3>
                <div className="p-4 border rounded-md">
                  <EnhancedReportApproval
                    report={report}
                    onApprovalComplete={handleRefresh}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
