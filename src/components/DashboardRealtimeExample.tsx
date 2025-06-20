"use client";

import { useState, useEffect } from "react";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

export default function DashboardRealtimeExample() {
  // State for dashboard data
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Use the dashboard realtime hook
  const {
    isConnected,
    activeMethod,
    hasNewUpdates,
    clearNewUpdates,
    reconnect,
    error,
  } = useDashboardRealtime({
    onUpdate: (data) => {
      console.log("Dashboard update received:", data);
      // In a real implementation, you might want to refresh the data here
    },
  });

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);

      // In a real implementation, this would be an API call
      // const response = await fetch('/api/dashboard/data');
      // const data = await response.json();

      // For demo purposes, we'll use mock data
      const mockData = {
        totalReports: Math.floor(Math.random() * 100) + 50,
        pendingReports: Math.floor(Math.random() * 20),
        approvedReports: Math.floor(Math.random() * 80) + 20,
        rejectedReports: Math.floor(Math.random() * 10),
        timestamp: new Date().toISOString(),
      };

      setDashboardData(mockData);
      clearNewUpdates(); // Clear the new updates flag
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Send a test dashboard update
  const sendTestUpdate = async () => {
    try {
      const response = await fetch("/api/realtime/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "dashboardUpdate",
          data: {
            type: "stats",
            totalReports: Math.floor(Math.random() * 100) + 50,
            pendingReports: Math.floor(Math.random() * 20),
            timestamp: Date.now(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Test dashboard update sent:", data);
    } catch (err) {
      console.error("Error sending test update:", err);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Dashboard Example</CardTitle>
              <CardDescription>
                Demonstrates real-time dashboard updates
              </CardDescription>
            </div>
            {hasNewUpdates && (
              <Badge
                variant="outline"
                className="bg-yellow-100 text-yellow-800"
              >
                New Updates Available
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <div>
              Connection:
              {isConnected ? (
                <Badge
                  variant="outline"
                  className="ml-2 bg-green-100 text-green-800"
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="ml-2 bg-red-100 text-red-800"
                >
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Disconnected
                </Badge>
              )}
            </div>
            <div>
              Method:
              <Badge variant="outline" className="ml-2">
                {activeMethod || "None"}
              </Badge>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
          ) : dashboardData ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-md p-4">
                <div className="text-sm font-medium text-muted-foreground">
                  Total Reports
                </div>
                <div className="text-2xl font-bold">
                  {dashboardData.totalReports}
                </div>
              </div>
              <div className="border rounded-md p-4">
                <div className="text-sm font-medium text-muted-foreground">
                  Pending Reports
                </div>
                <div className="text-2xl font-bold">
                  {dashboardData.pendingReports}
                </div>
              </div>
              <div className="border rounded-md p-4">
                <div className="text-sm font-medium text-muted-foreground">
                  Approved Reports
                </div>
                <div className="text-2xl font-bold">
                  {dashboardData.approvedReports}
                </div>
              </div>
              <div className="border rounded-md p-4">
                <div className="text-sm font-medium text-muted-foreground">
                  Rejected Reports
                </div>
                <div className="text-2xl font-bold">
                  {dashboardData.rejectedReports}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">No dashboard data available</div>
          )}

          {hasNewUpdates && (
            <div className="mt-4">
              <Button onClick={fetchDashboardData} className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Dashboard Data
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={reconnect}>
            Reconnect
          </Button>
          <Button variant="outline" onClick={fetchDashboardData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={sendTestUpdate}>Send Test Update</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
