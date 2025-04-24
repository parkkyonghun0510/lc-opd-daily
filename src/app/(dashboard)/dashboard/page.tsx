"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserData } from "@/contexts/UserDataContext";
import RoleBasedDashboard from "@/components/dashboard/RoleBasedDashboard";
import { DashboardDataProvider } from "@/contexts/DashboardDataContext";

export default function DashboardPage() {
  return (
    <DashboardDataProvider>
      <RoleBasedDashboard />
    </DashboardDataProvider>
  );
}
