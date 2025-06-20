"use client";

import { TestHierarchyNotifications } from "@/components/admin/TestHierarchyNotifications";
import { NotificationStatsDashboard } from "@/components/admin/NotificationStatsDashboard";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { Permission } from "@/lib/auth/roles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

export default function NotificationsAdminPage() {
  const [activeTab, setActiveTab] = useState("stats");

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Notification Management</h1>
      </div>

      <PermissionGate permissions={[Permission.MANAGE_SETTINGS]}>
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
            <TabsTrigger value="test">Test Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="mt-6">
            <NotificationStatsDashboard />
          </TabsContent>

          <TabsContent value="test" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <TestHierarchyNotifications />
            </div>
          </TabsContent>
        </Tabs>
      </PermissionGate>
    </div>
  );
}
