import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Building2, Shield, Activity } from "lucide-react";
import Link from "next/link";

interface AdminOverviewProps {
  stats: {
    totalUsers: number;
    adminUsers: number;
    totalBranches: number;
    systemStatus: string;
  };
}

export function AdminOverview({ stats }: AdminOverviewProps) {
  const quickActions = [
    {
      title: "Add New User",
      description: "Create a new user account",
      icon: Users,
      href: "/dashboard/admin/users/new",
    },
    {
      title: "Manage Roles",
      description: "Assign and modify user roles",
      icon: Shield,
      href: "/dashboard/admin/users?tab=roles",
    },
    {
      title: "Branch Settings",
      description: "Configure branch hierarchy",
      icon: Building2,
      href: "/dashboard/admin/branches",
    },
    {
      title: "System Logs",
      description: "View system activity logs",
      icon: Activity,
      href: "/dashboard/admin/system/logs",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Users
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              Active users in the system
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Admin Users
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.adminUsers}</div>
            <p className="text-xs text-muted-foreground">
              Users with admin privileges
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Branches
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBranches}</div>
            <p className="text-xs text-muted-foreground">
              Active branches in the system
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              System Status
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              stats.systemStatus === "Active" ? "text-green-500" : "text-red-500"
            }`}>
              {stats.systemStatus}
            </div>
            <p className="text-xs text-muted-foreground">
              All systems operational
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => (
              <Button
                key={action.title}
                variant="outline"
                className="h-auto p-4 text-left flex flex-col items-start justify-start"
                asChild
              >
                <Link href={action.href}>
                  <div className="w-full">
                    <action.icon className="h-5 w-5 mb-2" />
                    <h3 className="font-semibold text-base">{action.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {action.description}
                    </p>
                  </div>
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 