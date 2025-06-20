"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRouter } from "next/navigation";
import {
  FileText,
  ClipboardCheck,
  Users,
  Settings,
  Building2,
  BarChart2,
  Clock,
  Bell,
} from "lucide-react";
import { useUserData } from "@/contexts/UserDataContext";

export function QuickActions() {
  const router = useRouter();
  const { userData } = useUserData();

  // Determine if user is a branch manager
  const isBranchManager = userData?.role === "BRANCH_MANAGER";

  const commonActions = [
    // {
    //     title: "Submit Report",
    //     icon: FileText,
    //     description: "Create a new daily report",
    //     href: "/dashboard/reports",
    // },
    {
      title: "View Reports",
      icon: ClipboardCheck,
      description: "Browse all reports",
      href: "/dashboard/reports",
    },
  ];

  const branchManagerActions = [
    // {
    //     title: "Branch Overview",
    //     icon: Building2,
    //     description: "View branch performance",
    //     href: "/dashboard/branch",
    // },
    // {
    //     title: "Staff Management",
    //     icon: Users,
    //     description: "Manage branch staff",
    //     href: "/dashboard/users",
    // },
    // {
    //     title: "Analytics",
    //     icon: BarChart2,
    //     description: "View branch analytics",
    //     href: "/dashboard/analytics",
    // },
    // {
    // {
    //     title: "Approvals",
    //     icon: Clock,
    //     description: "Review pending approvals",
    //     href: "/dashboard/approvals",
    // },
    {
      title: "View Reports",
      icon: ClipboardCheck,
      description: "Browse all reports",
      href: "/dashboard/reports",
    },
  ];

  const regularUserActions = [
    {
      title: "My Reports",
      icon: FileText,
      description: "View your reports",
      href: "/dashboard/reports",
    },
    // {
    //     title: "Notifications",
    //     icon: Bell,
    //     description: "View notifications",
    //     href: "/dashboard/notifications",
    // },
  ];

  // const actions = [...commonActions, ...(isBranchManager ? branchManagerActions : regularUserActions)];
  const actions = [
    ...(isBranchManager ? branchManagerActions : regularUserActions),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common tasks and navigation</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => (
          <Button
            key={action.href}
            variant="outline"
            className="h-auto flex-col items-start gap-2 p-4 hover:bg-slate-50"
            onClick={() => router.push(action.href)}
          >
            <div className="flex w-full items-center gap-2">
              <action.icon className="h-4 w-4" />
              <span className="font-medium">{action.title}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {action.description}
            </span>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
