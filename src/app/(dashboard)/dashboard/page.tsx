"use client";

import RoleBasedDashboard from "@/components/dashboard/RoleBasedDashboard";
import { RoleBasedLoadingGuard } from "@/auth/components/RoleBasedLoadingGuard";
import { ReportViewHandler } from "@/components/dashboard/ReportViewHandler";

export default function DashboardPage() {
  return (
    <RoleBasedLoadingGuard>
      <RoleBasedDashboard />
      {/* Handle report view from push notifications */}
      <ReportViewHandler />
    </RoleBasedLoadingGuard>
  );
}
