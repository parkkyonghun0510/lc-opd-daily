"use client";

import { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserSettings } from "@/components/admin/user-settings";
import { BranchSettings } from "@/components/admin/branch-settings";
import { SystemSettings } from "@/components/admin/system-settings";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { Permission } from "@/lib/auth/roles";
import { ZustandDashboardProvider } from '@/components/dashboard/ZustandDashboardProvider';
import { useEffect, useState } from "react";
import { fetchAdminStats } from "@/lib/api";
// Removed direct SSE import to reduce connections
import { toast } from "@/components/ui/use-toast";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";
import DashboardStatusIndicator from "@/components/dashboard/DashboardStatusIndicator";
import { exposeDebugUtils } from "@/auth/utils/debug";
import { PermissionDebugger } from "@/auth/components/PermissionDebugger";
import { MinimalLoadingIndicator } from "@/auth/components/GlobalLoadingIndicator";
import { AdminLoadingGuard } from "@/auth/components/RoleBasedLoadingGuard";

// Metadata can't be exported from a Client Component
// We'll need to move this to a separate layout.tsx file if needed
const metadata = {
  title: "Admin Dashboard",
  description: "Manage users, roles, branches, and system settings",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial stats on mount
  useEffect(() => {
    const getStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiStats = await fetchAdminStats();
        setStats(apiStats);
      } catch (err: any) {
        setError(err.message || "Failed to load admin stats");
      } finally {
        setLoading(false);
      }
    };
    getStats();

    // Expose debug utilities in development mode
    if (process.env.NODE_ENV === 'development') {
      exposeDebugUtils();
    }
  }, []);

  // Auto-refresh stats every 2 minutes
  useEffect(() => {
    const refreshInterval = setInterval(async () => {
      try {
        const apiStats = await fetchAdminStats();
        setStats(apiStats);
      } catch (err) {
        console.error("Error refreshing admin stats:", err);
      }
    }, 2 * 60 * 1000); // 2 minutes

    return () => clearInterval(refreshInterval);
  }, []);

  // Dummy stats for initial render/loading/error fallback
  const dummyStats = {
    totalUsers: 0,
    activeUsers: 0,
    adminUsers: 0,
    totalBranches: 0,
    pendingReports: 0,
    systemStatus: "Unknown",
    recentActivity: [],
    storageUsage: { used: 0, total: 1 },
  };

  return (
    <ZustandDashboardProvider
      debug={process.env.NODE_ENV === 'development'}
      autoRefreshInterval={2 * 60 * 1000} // 2 minutes
    >
      {/* Loading indicator is included in the ZustandDashboardProvider */}

      <div className="container mx-auto py-6 space-y-6 relative">
        {/* Status indicator with absolute positioning */}
        <div className="absolute top-4 right-4 z-10">
          <DashboardStatusIndicator />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Manage users, roles, branches, and system settings
            </p>
          </div>
        </div>

        {/* Permission debugger - only visible in development mode */}
        {process.env.NODE_ENV === 'development' && <PermissionDebugger />}

        {/* Wrap content in AuthLoadingGuard to show loading state while determining permissions */}
        <AdminLoadingGuard>
          <PermissionGate
            permissions={[Permission.ACCESS_ADMIN]}
            fallback={
              <div className="p-6 text-red-500 border border-red-200 rounded-md bg-red-50 dark:bg-red-900/20 dark:border-red-800">
                <h3 className="font-medium text-lg">Access Denied</h3>
                <p>You don&apos;t have permission to access the admin dashboard</p>
              </div>
            }
          >
            {error ? (
              <div className="p-6 text-red-500">{error}</div>
            ) : (
              <Tabs defaultValue="overview" className="space-y-4">

                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="users">Users</TabsTrigger>
                  <TabsTrigger value="branches">Branches</TabsTrigger>
                  <TabsTrigger value="system">System</TabsTrigger>
                </TabsList>

                {/* Quick Actions Section */}
                <div className="mt-8">
                  <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/dashboard/consolidated" passHref>
                      <Button variant="outline">
                        <TrendingUp className="mr-2 h-4 w-4" /> Consolidated View
                      </Button>
                    </Link>
                  </div>
                </div>


                <TabsContent value="overview">
                  <AdminOverview stats={{ ...(stats || dummyStats) }} />
                </TabsContent>

                <TabsContent value="users">
                  <UserSettings />
                </TabsContent>

                <TabsContent value="branches">
                  <BranchSettings />
                </TabsContent>

                <TabsContent value="system">
                  <SystemSettings />
                </TabsContent>
              </Tabs>
            )}
          </PermissionGate>
        </AdminLoadingGuard>
      </div>
    </ZustandDashboardProvider>
  );
}
