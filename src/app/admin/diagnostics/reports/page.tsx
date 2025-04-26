"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

interface Report {
  id: string;
  branchId: string;
  date: string;
  reportType: string;
  status: string;
  submittedBy: string;
  submittedAt: string;
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

export default function ReportDiagnosticsPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<{
    totalReports: number;
    totalBranches: number;
    reportsWithInvalidBranches: Report[];
    invalidBranchCount: number;
  } | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [targetBranchId, setTargetBranchId] = useState<string>("");
  const [fixAction, setFixAction] = useState<"reassign" | "delete">("reassign");

  // Check if user is admin
  const isAdmin = session?.user?.role === "ADMIN";

  // Fetch diagnostic data
  const fetchDiagnosticData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/diagnostics/reports");
      if (!response.ok) {
        throw new Error("Failed to fetch diagnostic data");
      }
      const data = await response.json();
      setDiagnosticData(data);
    } catch (error) {
      console.error("Error fetching diagnostic data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch diagnostic data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch branches
  const fetchBranches = async () => {
    try {
      // Use filterByAccess=false to get all branches as admin
      const response = await fetch("/api/branches?filterByAccess=false");
      if (!response.ok) {
        throw new Error("Failed to fetch branches");
      }
      const data = await response.json();
      // The API returns an array directly when filterByAccess=false
      setBranches(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching branches:", error);
      toast({
        title: "Error",
        description: "Failed to fetch branches",
        variant: "destructive",
      });
    }
  };

  // Fix reports
  const fixReports = async () => {
    if (selectedReports.length === 0) {
      toast({
        title: "Error",
        description: "No reports selected",
        variant: "destructive",
      });
      return;
    }

    if (fixAction === "reassign" && !targetBranchId) {
      toast({
        title: "Error",
        description: "Please select a target branch",
        variant: "destructive",
      });
      return;
    }

    setFixing(true);
    try {
      const response = await fetch("/api/admin/diagnostics/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: fixAction,
          targetBranchId: fixAction === "reassign" ? targetBranchId : undefined,
          reportIds: selectedReports,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fix reports");
      }

      const result = await response.json();
      toast({
        title: "Success",
        description: result.message,
      });

      // Refresh diagnostic data
      fetchDiagnosticData();
      // Clear selections
      setSelectedReports([]);
    } catch (error) {
      console.error("Error fixing reports:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fix reports",
        variant: "destructive",
      });
    } finally {
      setFixing(false);
    }
  };

  // Toggle report selection
  const toggleReportSelection = (reportId: string) => {
    setSelectedReports((prev) =>
      prev.includes(reportId)
        ? prev.filter((id) => id !== reportId)
        : [...prev, reportId]
    );
  };

  // Toggle all reports selection
  const toggleAllReports = () => {
    if (!diagnosticData) return;

    if (selectedReports.length === diagnosticData.reportsWithInvalidBranches.length) {
      setSelectedReports([]);
    } else {
      setSelectedReports(
        diagnosticData.reportsWithInvalidBranches.map((report) => report.id)
      );
    }
  };

  // Load data on component mount
  useEffect(() => {
    if (status === "authenticated" && isAdmin) {
      fetchDiagnosticData();
      fetchBranches();
    }
  }, [status, isAdmin]);

  // If not authenticated or not admin, show access denied
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You do not have permission to access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Report Diagnostics</CardTitle>
          <CardDescription>
            Identify and fix reports with data integrity issues
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : diagnosticData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md">
                  <h3 className="text-lg font-medium">Total Reports</h3>
                  <p className="text-3xl font-bold">{diagnosticData.totalReports}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md">
                  <h3 className="text-lg font-medium">Total Branches</h3>
                  <p className="text-3xl font-bold">{diagnosticData.totalBranches}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md">
                  <h3 className="text-lg font-medium">Invalid Branch References</h3>
                  <p className="text-3xl font-bold text-red-500">
                    {diagnosticData.invalidBranchCount}
                  </p>
                </div>
              </div>

              {diagnosticData.invalidBranchCount > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-medium">Reports with Invalid Branch References</h3>

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="selectAll"
                        checked={
                          selectedReports.length === diagnosticData.reportsWithInvalidBranches.length &&
                          diagnosticData.reportsWithInvalidBranches.length > 0
                        }
                        onCheckedChange={toggleAllReports}
                      />
                      <Label htmlFor="selectAll">Select All</Label>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="fixAction">Action:</Label>
                        <Select
                          value={fixAction}
                          onValueChange={(value) => setFixAction(value as "reassign" | "delete")}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select action" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="reassign">Reassign to Branch</SelectItem>
                            <SelectItem value="delete">Delete Reports</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {fixAction === "reassign" && (
                        <div className="flex items-center space-x-2">
                          <Label htmlFor="targetBranch">Target Branch:</Label>
                          <Select
                            value={targetBranchId}
                            onValueChange={setTargetBranchId}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Select branch" />
                            </SelectTrigger>
                            <SelectContent>
                              {branches.map((branch) => (
                                <SelectItem key={branch.id} value={branch.id}>
                                  {branch.name} ({branch.code})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <Button
                        onClick={fixReports}
                        disabled={
                          fixing ||
                          selectedReports.length === 0 ||
                          (fixAction === "reassign" && !targetBranchId)
                        }
                        variant={fixAction === "delete" ? "destructive" : "default"}
                      >
                        {fixing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Fixing...
                          </>
                        ) : fixAction === "reassign" ? (
                          "Reassign Selected"
                        ) : (
                          "Delete Selected"
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="border rounded-md overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Select
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Invalid Branch ID
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                        {diagnosticData.reportsWithInvalidBranches.map((report) => (
                          <tr key={report.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Checkbox
                                checked={selectedReports.includes(report.id)}
                                onCheckedChange={() => toggleReportSelection(report.id)}
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {report.id.substring(0, 8)}...
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {format(new Date(report.date), "PPP")}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 capitalize">
                              {report.reportType}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 capitalize">
                              {report.status.replace("_", " ")}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-red-500">
                              {report.branchId}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Failed to load diagnostic data
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={fetchDiagnosticData}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              "Refresh Data"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
