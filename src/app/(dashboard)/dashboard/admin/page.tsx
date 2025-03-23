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

// Metadata can't be exported from a Client Component
// We'll need to move this to a separate layout.tsx file if needed
const metadata = {
  title: "Admin Dashboard",
  description: "Manage users, roles, branches, and system settings",
};

export default function AdminDashboard() {
  // Dummy stats until API is fully implemented
  const dummyStats = {
    totalUsers: 25,
    activeUsers: 22,
    adminUsers: 3,
    totalBranches: 8,
    pendingReports: 12,
    systemStatus: "Active",
    recentActivity: [
      {
        type: "user",
        user: "admin",
        action: "Login",
        timestamp: new Date(),
      },
    ],
    storageUsage: {
      used: 2.5,
      total: 10,
    },
  };

  return (
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
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="branches">Branches</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <AdminOverview stats={dummyStats} />
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
      </PermissionGate>
    </div>
  );
}
