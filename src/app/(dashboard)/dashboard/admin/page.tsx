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
import { DashboardDataProvider, useDashboardData } from '@/contexts/DashboardDataContext';
import { useEffect, useState } from "react";
import { fetchAdminStats } from "@/lib/api";
// Removed direct SSE import to reduce connections
import { toast } from "@/components/ui/use-toast";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";

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
    <DashboardDataProvider>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Manage users, roles, branches, and system settings
            </p>
          </div>
        </div>

        <PermissionGate
          permissions={[Permission.ACCESS_ADMIN]}
          fallback={
            <div className="p-6 text-red-500">
              You don&apos;t have permission to access the admin dashboard
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
      </div>
    </DashboardDataProvider>
  );
}
