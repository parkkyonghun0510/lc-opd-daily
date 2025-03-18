"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportApproval } from "@/components/reports/ReportApproval";
import { formatKHRCurrency } from "@/lib/utils";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { Permission } from "@/lib/auth/roles";
import { Breadcrumbs } from "@/components/dashboard/layout/Breadcrumbs";
import { Loader2, Shield } from "lucide-react";

// Define the report interface
interface Report {
  id: string;
  date: string;
  branchId: string;
  writeOffs: number;
  ninetyPlus: number;
  status: string;
  submittedBy: string;
  submittedAt: string;
  comments?: string;
  branch: {
    id: string;
    code: string;
    name: string;
  };
}

export default function ApprovalsPage() {
  const [pendingReports, setPendingReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reportType, setReportType] = useState<"plan" | "actual">("actual");

  useEffect(() => {
    fetchPendingReports();
  }, [reportType]);

  const fetchPendingReports = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/reports/pending?type=${reportType}`);
      if (response.ok) {
        const data = await response.json();
        setPendingReports(data.reports || []);
      }
    } catch (error) {
      console.error("Failed to fetch pending reports:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs />

      <PermissionGate
        permissions={[Permission.APPROVE_REPORTS]}
        fallback={
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <div className="rounded-full bg-yellow-100 p-3 text-yellow-600 mb-4">
                  <Shield className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-medium mb-2">
                  Permission Required
                </h3>
                <p className="text-sm text-gray-500 max-w-md">
                  You don&apos;t have permission to access the approval queue.
                  Please contact an administrator if you believe this is an
                  error.
                </p>
              </div>
            </CardContent>
          </Card>
        }
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-2xl font-bold">
              Report Approval Queue
            </CardTitle>
            <Tabs
              value={reportType}
              onValueChange={(value: string) => {
                if (value === "plan" || value === "actual") {
                  setReportType(value);
                }
              }}
            >
              <TabsList>
                <TabsTrigger value="plan">Morning Plan</TabsTrigger>
                <TabsTrigger value="actual">Evening Actual</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : pendingReports.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-md">
                <p className="text-gray-500">No pending reports to approve</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingReports.map((report) => (
                  <div
                    key={report.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <span className="font-medium text-lg">
                            {report.branch.name}
                          </span>
                          <span className="text-sm text-gray-500 ml-2">
                            ({report.branch.code})
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {new Date(report.date).toLocaleDateString()} •
                          Submitted by {report.submittedBy} •
                          {new Date(report.submittedAt).toLocaleTimeString()}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="min-w-[150px]">
                          <div className="text-sm text-gray-500">
                            Write-offs
                          </div>
                          <div className="font-mono font-medium">
                            {formatKHRCurrency(report.writeOffs)}
                          </div>
                        </div>
                        <div className="min-w-[150px]">
                          <div className="text-sm text-gray-500">90+ Days</div>
                          <div className="font-mono font-medium">
                            {formatKHRCurrency(report.ninetyPlus)}
                          </div>
                        </div>
                      </div>

                      <ReportApproval
                        report={report}
                        onApprovalComplete={fetchPendingReports}
                        branchName={report.branch.name}
                      />
                    </div>

                    {report.comments && (
                      <div className="mt-3 pt-3 border-t text-sm">
                        <div className="font-medium text-gray-600 mb-1">
                          Comments:
                        </div>
                        <div className="text-gray-600">{report.comments}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </PermissionGate>
    </div>
  );
}
