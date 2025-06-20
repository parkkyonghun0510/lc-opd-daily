"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import { format } from "date-fns";
import { toast } from "@/components/ui/use-toast";
import {
  Loader2,
  RefreshCw,
  BarChart2,
  Bell,
  CheckCircle2,
  XCircle,
  Send,
  Eye,
  Clock,
  Building,
} from "lucide-react";

// Notification stats dashboard component
export function NotificationStatsDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [timeRange, setTimeRange] = useState("7d");

  // For branch filter
  const [branches, setBranches] = useState<
    Array<{ id: string; name: string; code: string }>
  >([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [loadingBranches, setLoadingBranches] = useState(true);

  // Color palette for charts
  const colorPalette = [
    "#0284c7",
    "#0369a1",
    "#0ea5e9",
    "#38bdf8",
    "#bae6fd",
    "#14b8a6",
    "#0891b2",
    "#0e7490",
    "#06b6d4",
    "#a5f3fc",
  ];

  // Status colors for delivery status
  const statusColors = {
    SENT: "#f59e0b",
    DELIVERED: "#10b981",
    CLICKED: "#3b82f6",
    FAILED: "#ef4444",
    CLOSED: "#6b7280",
    QUEUED: "#a3a3a3",
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy");
    } catch (e) {
      return dateString;
    }
  };

  // Format percentage for display
  const formatPercentage = (value: number) => {
    return `${Math.round(value * 100)}%`;
  };

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await fetch("/api/branches");
        if (response.ok) {
          const data = await response.json();
          setBranches(data.branches || []);
        }
      } catch (error) {
        console.error("Error fetching branches:", error);
      } finally {
        setLoadingBranches(false);
      }
    };

    fetchBranches();
  }, []);

  // Fetch statistics
  const fetchStats = async () => {
    setLoading(true);
    try {
      // Construct URL with query parameters
      let url = `/api/notifications/statistics?range=${timeRange}`;
      if (selectedBranch) {
        url += `&branchId=${selectedBranch}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch notification statistics");
      }

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching notification statistics:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to fetch statistics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats on component mount and when filters change
  useEffect(() => {
    fetchStats();
  }, [timeRange, selectedBranch]);

  // Prepare data for daily volume chart
  const dailyVolumeData =
    stats?.dailyVolume?.map((item: any) => ({
      date: formatDate(item.date),
      count: Number(item.count),
    })) || [];

  // Prepare data for notification type pie chart
  const typeDistributionData = stats?.typeDistribution || [];

  // Prepare data for delivery status bar chart
  const deliveryStatusData = stats?.deliveryStatus
    ? [
        {
          name: "Sent",
          value: stats.deliveryStatus.sent,
          color: statusColors.SENT,
        },
        {
          name: "Delivered",
          value: stats.deliveryStatus.delivered,
          color: statusColors.DELIVERED,
        },
        {
          name: "Clicked",
          value: stats.deliveryStatus.clicked,
          color: statusColors.CLICKED,
        },
        {
          name: "Failed",
          value: stats.deliveryStatus.failed,
          color: statusColors.FAILED,
        },
        {
          name: "Closed",
          value: stats.deliveryStatus.closed,
          color: statusColors.CLOSED,
        },
      ]
    : [];

  // Prepare data for branch distribution chart
  const branchDistributionData = (stats?.branchDistribution || []).slice(0, 5);

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 shadow-md rounded-md border dark:border-gray-700">
          <p className="font-semibold">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">Notification Statistics</h2>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {/* Branch Filter */}
          <Select
            value={selectedBranch}
            onValueChange={setSelectedBranch}
            disabled={loadingBranches}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Branches</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Time Range Filter */}
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={fetchStats}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {loading && !stats ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="ml-2">Loading notification statistics...</p>
        </div>
      ) : stats ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl flex items-center">
                  <Bell className="mr-2 h-5 w-5 text-blue-500" />
                  Total Notifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.summary.total}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  {timeRange === "24h"
                    ? "Last 24 hours"
                    : timeRange === "7d"
                      ? "Last 7 days"
                      : timeRange === "30d"
                        ? "Last 30 days"
                        : "Last 90 days"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl flex items-center">
                  <Eye className="mr-2 h-5 w-5 text-green-500" />
                  Read Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {formatPercentage(stats.summary.readRate)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {stats.summary.read} of {stats.summary.total} notifications
                  read
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl flex items-center">
                  <Send className="mr-2 h-5 w-5 text-orange-500" />
                  Delivery Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {formatPercentage(
                    stats.deliveryStatus.sent > 0
                      ? stats.deliveryStatus.delivered /
                          stats.deliveryStatus.sent
                      : 0,
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {stats.deliveryStatus.delivered} of{" "}
                  {stats.deliveryStatus.sent} notifications delivered
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xl flex items-center">
                  <CheckCircle2 className="mr-2 h-5 w-5 text-blue-500" />
                  Engagement Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {formatPercentage(stats.deliveryStatus.engagementRate)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {stats.deliveryStatus.clicked} clicked of{" "}
                  {stats.deliveryStatus.delivered} delivered
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Volume Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart2 className="mr-2 h-5 w-5" />
                  Daily Notification Volume
                </CardTitle>
                <CardDescription>
                  Number of notifications sent each day
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={dailyVolumeData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 30 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="count"
                        name="Notifications"
                        stroke="#0284c7"
                        activeDot={{ r: 8 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Notification Type Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="mr-2 h-5 w-5" />
                  Notification Type Distribution
                </CardTitle>
                <CardDescription>
                  Breakdown of notifications by type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={typeDistributionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                        nameKey="type"
                        label={({ type, percent }) =>
                          `${type
                            .split("_")
                            .map(
                              (word: string) =>
                                word.charAt(0).toUpperCase() +
                                word.slice(1).toLowerCase(),
                            )
                            .join(" ")} (${(percent * 100).toFixed(0)}%)`
                        }
                      >
                        {typeDistributionData.map(
                          (entry: any, index: number) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={colorPalette[index % colorPalette.length]}
                            />
                          ),
                        )}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Delivery Status Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Send className="mr-2 h-5 w-5" />
                  Delivery Status
                </CardTitle>
                <CardDescription>
                  Notification delivery performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={deliveryStatusData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="value" name="Count">
                        {deliveryStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Top Branches/Users */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building className="mr-2 h-5 w-5" />
                  Top Notification Recipients
                </CardTitle>
                <CardDescription>
                  Branches with the most notifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={branchDistributionData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 50, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis
                        dataKey="branchName"
                        type="category"
                        tick={{ fontSize: 12 }}
                        width={150}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar
                        dataKey="count"
                        name="Notifications"
                        fill="#0284c7"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <div className="p-6 border rounded-md bg-gray-50 dark:bg-gray-800 text-center">
          <p>No notification statistics available</p>
          <Button onClick={fetchStats} className="mt-4" variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      )}
    </div>
  );
}
