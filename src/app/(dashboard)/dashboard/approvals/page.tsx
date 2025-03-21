"use client";

import { useEffect, useState } from "react";
import { useUserData } from "@/contexts/UserDataContext";
import { PendingReport } from "@/components/reports/PendingReport";
import { getBranchById } from "@/lib/api/branches";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  AlertCircle, 
  Filter, 
  Search, 
  SortAsc, 
  SortDesc, 
  RefreshCw 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Report, fetchPendingReports } from "@/lib/api/reports";

interface Branch {
  id: string;
  name: string;
}

export default function ApprovalsPage() {
  const { toast } = useToast();
  const { userData } = useUserData();
  const [pendingReports, setPendingReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [branches, setBranches] = useState<Record<string, Branch>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [reportTypeFilter, setReportTypeFilter] = useState("all");
  const [sortField, setSortField] = useState("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [activeTab, setActiveTab] = useState("pending");

  const loadPendingReports = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use the helper function to fetch pending reports
      const data = await fetchPendingReports(
        reportTypeFilter === "all" ? undefined : reportTypeFilter
      );
      setPendingReports(data);
      
      // Fetch branch data for each report
      const branchesRecord: Record<string, Branch> = {};
      for (const report of data) {
        if (!branchesRecord[report.branchId]) {
          try {
            const branchData = await getBranchById(report.branchId);
            branchesRecord[report.branchId] = branchData;
          } catch (error) {
            console.error(
              `Failed to fetch branch ${report.branchId}:`,
              error
            );
            branchesRecord[report.branchId] = {
              id: report.branchId,
              name: "Unknown Branch",
            };
          }
        }
      }
      setBranches(branchesRecord);
    } catch (error) {
      console.error("Error fetching pending reports:", error);
      setError(error instanceof Error ? error.message : "Unknown error occurred");
      toast({
        title: "Error",
        description: "Failed to load pending reports. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadPendingReports();
  };

  // Apply filters and sorting
  useEffect(() => {
    let results = [...pendingReports];
    
    // Filter by report type
    if (reportTypeFilter !== "all") {
      results = results.filter(
        (report) => report.reportType.toLowerCase() === reportTypeFilter
      );
    }
    
    // Filter by branch
    if (branchFilter !== "all") {
      results = results.filter((report) => report.branchId === branchFilter);
    }
    
    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      results = results.filter(
        (report) =>
          branches[report.branchId]?.name.toLowerCase().includes(search) ||
          report.user?.name?.toLowerCase().includes(search) ||
          report.user?.username?.toLowerCase().includes(search) ||
          new Date(report.date).toLocaleDateString().includes(search)
      );
    }
    
    // Apply sorting
    results.sort((a, b) => {
      let valueA, valueB;
      
      switch (sortField) {
        case "date":
          valueA = new Date(a.date).getTime();
          valueB = new Date(b.date).getTime();
          break;
        case "branch":
          valueA = branches[a.branchId]?.name || "";
          valueB = branches[b.branchId]?.name || "";
          break;
        case "created":
          valueA = new Date(a.createdAt).getTime();
          valueB = new Date(b.createdAt).getTime();
          break;
        case "writeOffs":
          valueA = a.writeOffs;
          valueB = b.writeOffs;
          break;
        case "ninetyPlus":
          valueA = a.ninetyPlus;
          valueB = b.ninetyPlus;
          break;
        default:
          valueA = a.date;
          valueB = b.date;
      }
      
      if (sortDirection === "asc") {
        return valueA > valueB ? 1 : -1;
      } else {
        return valueA < valueB ? 1 : -1;
      }
    });
    
    setFilteredReports(results);
  }, [
    pendingReports,
    searchTerm,
    branchFilter,
    reportTypeFilter,
    sortField,
    sortDirection,
    branches,
  ]);

  useEffect(() => {
    loadPendingReports();
  }, [reportTypeFilter]);

  const handleApprovalComplete = () => {
    loadPendingReports();
  };

  const toggleSortDirection = () => {
    setSortDirection(sortDirection === "asc" ? "desc" : "asc");
  };

  // Get unique branches for filter dropdown
  const uniqueBranches = Object.values(branches).sort((a, b) => 
    a.name.localeCompare(b.name)
  );

  return (
    <div>
      <DashboardHeader
        heading="Report Approvals"
        text="Review and approve pending reports submitted by branch staff."
      />

      <Tabs
        defaultValue="pending"
        value={activeTab}
        onValueChange={setActiveTab}
        className="mt-6"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <TabsList>
            <TabsTrigger value="pending">Pending Approvals</TabsTrigger>
            <TabsTrigger value="history">Approval History</TabsTrigger>
          </TabsList>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh} 
            disabled={refreshing}
            className="flex items-center gap-1"
          >
            <RefreshCw className={cn(
              "h-4 w-4", 
              refreshing && "animate-spin"
            )} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        <TabsContent value="pending" className="space-y-4">
          {/* Filters and Search */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-md flex items-center">
                <Filter className="h-4 w-4 mr-2" />
                Filter Reports
              </CardTitle>
              <CardDescription>
                Use these filters to find specific pending reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Search branch, user..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500">Branch</p>
                  <Select
                    value={branchFilter}
                    onValueChange={setBranchFilter}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Branches" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Branches</SelectItem>
                      {uniqueBranches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500">Report Type</p>
                  <Select
                    value={reportTypeFilter}
                    onValueChange={setReportTypeFilter}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="plan">Plan</SelectItem>
                      <SelectItem value="actual">Actual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-gray-500">
                  {filteredReports.length} reports found
                </div>
                
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium mr-2">Sort by:</p>
                  <Select value={sortField} onValueChange={setSortField}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Sort by Date" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Report Date</SelectItem>
                      <SelectItem value="created">Submission Date</SelectItem>
                      <SelectItem value="branch">Branch</SelectItem>
                      <SelectItem value="writeOffs">Write-offs</SelectItem>
                      <SelectItem value="ninetyPlus">90+ Days</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleSortDirection}
                  >
                    {sortDirection === "asc" ? (
                      <SortAsc className="h-4 w-4" />
                    ) : (
                      <SortDesc className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[250px]" />
                      <Skeleton className="h-4 w-[200px]" />
                      <div className="flex gap-2 mt-4">
                        <Skeleton className="h-8 w-[100px]" />
                        <Skeleton className="h-8 w-[100px]" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredReports.length === 0 ? (
            <Card>
              <CardContent className="pt-6 pb-6 text-center">
                <div className="py-8 text-gray-500">
                  <p className="text-lg font-medium mb-2">No Pending Reports</p>
                  <p className="text-sm">
                    There are no pending reports that match your filters.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredReports.map((report) => (
                <PendingReport
                  key={report.id}
                  report={report}
                  branchName={branches[report.branchId]?.name || "Unknown Branch"}
                  onApprovalComplete={handleApprovalComplete}
                />
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="history">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-500 py-8">
                Approval history feature coming soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
