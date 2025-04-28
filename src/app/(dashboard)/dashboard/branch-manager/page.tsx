"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserData } from "@/contexts/UserDataContext";
import RoleBasedDashboard from "@/components/dashboard/RoleBasedDashboard";
import { ZustandDashboardProvider } from "@/components/dashboard/ZustandDashboardProvider";
import { UserRole } from "@/lib/auth/roles";
import { BranchManagerLoadingGuard } from "@/auth/components/RoleBasedLoadingGuard";

export default function BranchManagerDashboardPage() {
  const router = useRouter();
  const { userData } = useUserData();

  useEffect(() => {
    if (userData?.computedFields?.accessLevel !== UserRole.BRANCH_MANAGER) {
      router.push('/dashboard');
    }
  }, [userData, router]);

  return (
    <ZustandDashboardProvider debug={process.env.NODE_ENV === 'development'}>
      <BranchManagerLoadingGuard>
        <RoleBasedDashboard />
      </BranchManagerLoadingGuard>
    </ZustandDashboardProvider>
  );
}