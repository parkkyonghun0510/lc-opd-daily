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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b dark:border-gray-700">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Analytics Dashboard</h2>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
            View and analyze report data across all branches
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-auto">
            <DatePickerWithRange
              date={{
                from: new Date(dateRange.from),
                to: new Date(dateRange.to)
              }}
              setDate={(newDate) => {
                if (newDate?.from && newDate.to) {
                  setDateRange({
                    from: newDate.from,
                    to: newDate.to,
                  });
                }
              }}
              className="w-full"
            />
          </div>
          
          <Button 
            variant="outline" 
            onClick={handleDownloadCSV}
            disabled={loading}
            className="w-full sm:w-auto h-10 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="sm:hidden">Export</span>
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error}
            <Button onClick={handleRetry} variant="link" className="p-0 h-auto font-normal">
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between py-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="py-2">
            <div className="text-xl sm:text-2xl font-bold">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : getTotalPatients().toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">+{getAveragePatients().toFixed(2)} avg per report</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between py-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Reports</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="py-2">
            <div className="text-xl sm:text-2xl font-bold">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : getTotalReports().toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">From {getBranchCount()} branches</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between py-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Approval Rate</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="py-2">
            <div className="text-xl sm:text-2xl font-bold">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : `${getApprovalRate().toFixed(1)}%`}
            </div>
            <p className="text-xs text-muted-foreground">From total submitted reports</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between py-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Date Range</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="py-2">
            <div className="text-sm sm:text-md font-bold">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  {format(new Date(dateRange.from), "MMM dd")} - {format(new Date(dateRange.to), "MMM dd, yyyy")}
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Custom date range</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex flex-col space-y-4">
              <TabsList className="w-full grid grid-cols-2 md:grid-cols-4 gap-1">
                <TabsTrigger value="trends" className="px-2 py-1.5 text-sm">Trends</TabsTrigger>
                <TabsTrigger value="branches" className="px-2 py-1.5 text-sm">Branches</TabsTrigger>
                <TabsTrigger value="categories" className="px-2 py-1.5 text-sm">Categories</TabsTrigger>
                <TabsTrigger value="reports" className="px-2 py-1.5 text-sm">Reports</TabsTrigger>
              </TabsList>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full" style={{ marginTop: "20px" }}>
                <Select 
                  value={timeRange} 
                  onValueChange={setTimeRange}
                >
                  <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue placeholder="Select Time Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="quarter">Quarter</SelectItem>
                    <SelectItem value="year">Year</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select 
                  value={selectedBranch} 
                  onValueChange={setSelectedBranch}
                >
                  <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue placeholder="Select Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {analyticsData.branchPerformance?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
        
            {loading ? (
              <div className="h-96 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <TabsContent value="trends" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Patient Trends Over Time</CardTitle>
                      <CardDescription>
                        Daily patient count and report submissions
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px] sm:h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={analyticsData.dailyTrends}
                            margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="date" 
                              tickFormatter={(date) => format(new Date(date), "MMM d")}
                              tick={{ fontSize: 12 }}
                              angle={-45}
                              textAnchor="end"
                              height={60}
                            />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip
                              formatter={(value) => [`${value}`, ""]}
                              labelFormatter={(date) => format(new Date(date), "MMMM d, yyyy")}
                            />
                            <Legend 
                              verticalAlign="top" 
                              height={36} 
                              wrapperStyle={{ 
                                paddingTop: "10px", 
                                fontSize: "12px" 
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="patients"
                              stroke="#3498db"
                              name="Patients"
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              activeDot={{ r: 5 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="reports"
                              stroke="#2ecc71"
                              name="Reports"
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              activeDot={{ r: 5 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="branches" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Branch Performance</CardTitle>
                      <CardDescription>
                        Patient count and report submissions by branch
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px] sm:h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={analyticsData.branchPerformance}
                            margin={{ top: 5, right: 10, left: 10, bottom: 50 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="name" 
                              tick={{ fontSize: 11 }}
                              angle={-45}
                              textAnchor="end"
                              height={70}
                              interval={0}
                            />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip
                              formatter={(value) => [`${value}`, ""]}
                            />
                            <Legend 
                              verticalAlign="top" 
                              height={36} 
                              wrapperStyle={{ 
                                paddingTop: "10px", 
                                fontSize: "12px" 
                              }}
                            />
                            <Bar
                              dataKey="patients"
                              fill="#3498db"
                              name="Patients"
                              radius={[4, 4, 0, 0]}
                            />
                            <Bar
                              dataKey="reports"
                              fill="#2ecc71"
                              name="Reports"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="categories" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Patient Categories</CardTitle>
                      <CardDescription>
                        Distribution of patients by category
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px] sm:h-[400px] flex flex-col md:flex-row">
                        <div className="w-full md:w-2/3 h-[250px] sm:h-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={analyticsData.patientCategories}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                nameKey="name"
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              >
                                {analyticsData.patientCategories.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value) => [`${value}`, ""]}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="w-full md:w-1/3 flex flex-wrap justify-center items-center mt-4 md:mt-0">
                          {analyticsData.patientCategories.map((category, index) => (
                            <div key={index} className="flex items-center mr-4 mb-2">
                              <div
                                className="w-3 h-3 mr-1 rounded-sm"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="text-xs sm:text-sm font-medium dark:text-gray-300">
                                {category.name}: {category.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="reports" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Reports</CardTitle>
                      <CardDescription>
                        Latest submitted reports across branches
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto -mx-6 px-6">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[100px]">Date</TableHead>
                              <TableHead className="w-[140px]">Branch</TableHead>
                              <TableHead className="w-[80px] text-right">Patients</TableHead>
                              <TableHead className="w-[100px]">Status</TableHead>
                              <TableHead className="hidden sm:table-cell">Submitted By</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {analyticsData.recentReports.map((report) => (
                              <TableRow key={report.id}>
                                <TableCell className="font-medium">
                                  {format(new Date(report.date), "MMM d, yyyy")}
                                </TableCell>
                                <TableCell>{report.branch}</TableCell>
                                <TableCell className="text-right">{report.patients}</TableCell>
                                <TableCell>
                                  <Badge variant={
                                    report.status === "Approved" ? "success" :
                                    report.status === "Pending" ? "outline" : "destructive"
                                  }>
                                    {report.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">
                                  <UserDisplayName userId={report.submittedBy} />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
} 