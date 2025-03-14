import { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BranchSettings } from "@/components/admin/branch-settings";
import { UserSettings } from "@/components/admin/user-settings";
import { SystemSettings } from "@/components/admin/system-settings";

export const metadata: Metadata = {
  title: "Admin Settings",
  description: "Manage system settings and configurations",
};

export default function AdminPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Admin Settings</h2>
        <p className="text-muted-foreground">
          Manage system configurations, branch hierarchies, and user access.
        </p>
      </div>

      <Tabs defaultValue="system" className="space-y-4">
        <TabsList>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="system" className="space-y-4">
          <Card className="p-6">
            <SystemSettings />
          </Card>
        </TabsContent>

        <TabsContent value="branches" className="space-y-4">
          <Card className="p-6">
            <BranchSettings />
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card className="p-6">
            <UserSettings />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
