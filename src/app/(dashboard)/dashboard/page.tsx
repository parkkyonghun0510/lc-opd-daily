"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserData } from "@/contexts/UserDataContext";
import RoleBasedDashboard from "@/components/dashboard/RoleBasedDashboard";
import { ZustandDashboardProvider } from "@/components/dashboard/ZustandDashboardProvider";
import { RoleBasedLoadingGuard } from "@/auth/components/RoleBasedLoadingGuard";
import { ReportViewHandler } from "@/components/dashboard/ReportViewHandler";

export default function DashboardPage() {
  return (
    <ZustandDashboardProvider debug={process.env.NODE_ENV === 'development'}>
      <RoleBasedLoadingGuard>
        <RoleBasedDashboard />
        {/* Handle report view from push notifications */}
        <ReportViewHandler />
      </RoleBasedLoadingGuard>
    </ZustandDashboardProvider>
  );
}
