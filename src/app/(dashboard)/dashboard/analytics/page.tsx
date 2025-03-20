"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Loader2, FileText, Calendar, Users, ArrowUpDown, AlertCircle, Download } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { toast } from "@/components/ui/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UserDisplayName } from "@/components/user/UserDisplayName";

// Initial empty state
const INITIAL_DATA = {
  dailyTrends: [],
  branchPerformance: [],
  patientCategories: [],
  recentReports: [],
  stats: {
    totalPatients: 0,
    totalReports: 0,
    averagePatients: 0,
    approvalRate: 0,
  },
  dateRange: {
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  },
};

// Define interface for data from API
interface BranchPerformance {
  id: string;
  name: string;
  patients: number;
  reports: number;
}

interface PatientCategory {
  name: string;
  value: number;
}

interface RecentReport {
  id: string;
  date: string;
  branch: string;
  patients: number;
  status: string;
  submittedBy: string;
}

interface DailyTrend {
  date: string;
  patients: number;
  reports: number;
}

interface AnalyticsData {
  dailyTrends: DailyTrend[];
  branchPerformance: BranchPerformance[];
  patientCategories: PatientCategory[];
  recentReports: RecentReport[];
  stats: {
    totalPatients: number;
    totalReports: number;
    averagePatients: number;
    approvalRate: number;
  };
  dateRange: {
    from: string;
    to: string;
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("month");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    ...INITIAL_DATA,
    dateRange: {
      from: startOfMonth(new Date()).toISOString(),
      to: endOfMonth(new Date()).toISOString(),
    },
  });
  const [activeTab, setActiveTab] = useState("trends");

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange, selectedBranch, dateRange]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Format dates for API call
      const fromParam = dateRange.from ? dateRange.from.toISOString() : '';
      const toParam = dateRange.to ? dateRange.to.toISOString() : '';
      
      // Make API call to fetch analytics data
      const response = await fetch(
        `/api/analytics?timeRange=${timeRange}&branch=${selectedBranch}&from=${fromParam}&to=${toParam}`
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch analytics data');
      }
      
      const data = await response.json();
      setAnalyticsData(data);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to load analytics data',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    fetchAnalyticsData();
  };

  // Function to prepare CSV data
  const prepareCSVData = async () => {
    if (!analyticsData || !analyticsData.recentReports) return "";
    
    // Header row
    let csvContent = "Date,Branch,Patients,Status,Submitted By\n";
    
    // Create a map to store user data
    const userMap = new Map();
    
    // Fetch user data for all unique submittedBy IDs
    const uniqueUserIds = [...new Set(analyticsData.recentReports.map(item => item.submittedBy))];
    
    for (const userId of uniqueUserIds) {
      try {
        const response = await fetch(`/api/users/${userId}`);
        if (response.ok) {
          const userData = await response.json();
          userMap.set(userId, userData.name || userData.username || userId);
        } else {
          userMap.set(userId, userId);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        userMap.set(userId, userId);
      }
    }
    
    // Data rows
    for (const item of analyticsData.recentReports) {
      const userName = userMap.get(item.submittedBy) || item.submittedBy;
      csvContent += `${format(new Date(item.date), 'yyyy-MM-dd')},"${item.branch}",${item.patients},"${item.status}","${userName}"\n`;
    }
    
    return csvContent;
  };
  
  // Handle download click
  const handleDownloadCSV = async () => {
    setLoading(true);
    try {
      const csvContent = await prepareCSVData();
      if (!csvContent) {
        toast({
          title: "Export failed",
          description: "No data available to export.",
          variant: "destructive",
        });
        return;
      }
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      // Use the filter date range if available
      const filename = `analytics_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Export successful",
        description: "Your analytics data has been exported to CSV.",
        variant: "default",
      });
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast({
        title: "Export failed",
        description: "There was a problem exporting your data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Safe access to data with fallbacks
  const getTotalReports = () => analyticsData.stats?.totalReports || 0;
  const getTotalPatients = () => analyticsData.stats?.totalPatients || 0;
  const getAveragePatients = () => analyticsData.stats?.averagePatients || 0;
  const getApprovalRate = () => analyticsData.stats?.approvalRate || 0;
  const getBranchCount = () => analyticsData.branchPerformance?.length || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h2>
          <p className="text-muted-foreground">
            View and analyze report data across all branches
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <DatePickerWithRange
            date={{
              from: new Date(dateRange.from),
              to: new Date(dateRange.to)
            }}
            setDate={(newDate) => {
              if (newDate?.from && newDate.to) {
                setDateRange({
                  from: newDate.from,
                  to: newDate.to
                });
              }
            }}
            className="max-w-[300px]"
          />
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {analyticsData.branchPerformance?.map(branch => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">Last Month</SelectItem>
              <SelectItem value="quarter">Last Quarter</SelectItem>
              <SelectItem value="year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleRetry} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Refresh
          </Button>
        </div>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error}
            <Button variant="outline" size="sm" className="ml-2" onClick={handleRetry}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {loading ? (
        <div className="h-96 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{getTotalPatients()}</div>
                <p className="text-xs text-muted-foreground">
                  Across {getTotalReports()} reports
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Daily Patients</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{getAveragePatients()}</div>
                <p className="text-xs text-muted-foreground">
                  Per report during selected period
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{getTotalReports()}</div>
                <p className="text-xs text-muted-foreground">
                  From {getBranchCount()} branches
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{getApprovalRate()}%</div>
                <p className="text-xs text-muted-foreground">
                  Report approval rate for selected period
                </p>
              </CardContent>
            </Card>
          </div>
          
          <Tabs defaultValue="trends" className="space-y-4" onValueChange={setActiveTab}>
            <div className="flex justify-between items-center">
              <TabsList>
                <TabsTrigger value="trends">Patient Trends</TabsTrigger>
                <TabsTrigger value="branches">Branch Analytics</TabsTrigger>
                <TabsTrigger value="categories">Patient Categories</TabsTrigger>
                <TabsTrigger value="reports">Recent Reports</TabsTrigger>
              </TabsList>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownloadCSV}
                disabled={
                  (activeTab === "trends" && !analyticsData.dailyTrends?.length) ||
                  (activeTab === "branches" && !analyticsData.branchPerformance?.length) ||
                  (activeTab === "categories" && !analyticsData.patientCategories?.length) ||
                  (activeTab === "reports" && !analyticsData.recentReports?.length)
                }
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
            
            <TabsContent value="trends" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Daily Patient Trend</CardTitle>
                  <CardDescription>
                    Patient visits and reports over the selected time period
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="h-[400px]">
                    {analyticsData.dailyTrends?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={analyticsData.dailyTrends}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                          <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                          <Tooltip />
                          <Legend />
                          <Line yAxisId="left" type="monotone" dataKey="patients" stroke="#8884d8" activeDot={{ r: 8 }} name="Patients" />
                          <Line yAxisId="right" type="monotone" dataKey="reports" stroke="#82ca9d" name="Reports" />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        No data available for selected time period
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="branches" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Branch Performance Comparison</CardTitle>
                  <CardDescription>
                    Total patients and reports by branch
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="h-[400px]">
                    {analyticsData.branchPerformance?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analyticsData.branchPerformance}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="patients" name="Total Patients" fill="#8884d8" />
                          <Bar dataKey="reports" name="Reports Submitted" fill="#82ca9d" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        No branch data available for selected time period
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="categories" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Patient Category Distribution</CardTitle>
                  <CardDescription>
                    Breakdown of patients by medical category
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="h-[400px] flex items-center justify-center">
                    {analyticsData.patientCategories?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analyticsData.patientCategories}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            outerRadius={150}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {analyticsData.patientCategories.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [`${value} patients`, 'Count']} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-muted-foreground">
                        No category data available for selected time period
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="reports" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Reports</CardTitle>
                  <CardDescription>
                    Last 5 reports submitted in the system
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {analyticsData.recentReports?.length > 0 ? (
                    <div className="rounded-md border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50 font-medium">
                            <th className="p-3 text-left">Date</th>
                            <th className="p-3 text-left">Branch</th>
                            <th className="p-3 text-left">Patients</th>
                            <th className="p-3 text-left">Status</th>
                            <th className="p-3 text-left">Submitted By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analyticsData.recentReports.map((report) => (
                            <tr key={report.id} className="border-b">
                              <td className="p-3">{format(new Date(report.date), 'MMM dd, yyyy')}</td>
                              <td className="p-3">{report.branch}</td>
                              <td className="p-3">{report.patients}</td>
                              <td className="p-3">
                                <Badge 
                                  variant={
                                    report.status === "Approved" ? "success" : 
                                    report.status === "Pending" ? "outline" : 
                                    "destructive"
                                  }
                                >
                                  {report.status}
                                </Badge>
                              </td>
                              <td className="p-3">
                                <UserDisplayName userId={report.submittedBy} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="h-24 flex items-center justify-center text-muted-foreground">
                      No reports available for selected time period
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
} 