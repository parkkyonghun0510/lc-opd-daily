"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserData } from "@/contexts/UserDataContext";
import RoleBasedDashboard from "@/components/dashboard/RoleBasedDashboard";
import { DashboardDataProvider } from "@/contexts/DashboardDataContext";
import { UserRole } from "@/lib/auth/roles";

export default function UserDashboardPage() {
  const router = useRouter();
  const { userData } = useUserData();

  useEffect(() => {
    if (userData?.computedFields?.accessLevel !== UserRole.USER) {
      router.push('/dashboard');
    }
  }, [userData, router]);

  return (
    <DashboardDataProvider>
      <RoleBasedDashboard />
    </DashboardDataProvider>
  );
}