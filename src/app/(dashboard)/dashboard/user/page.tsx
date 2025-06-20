"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserData } from "@/contexts/UserDataContext";
import RoleBasedDashboard from "@/components/dashboard/RoleBasedDashboard";
import { ZustandDashboardProvider } from "@/components/dashboard/ZustandDashboardProvider";
import { UserRole } from "@/lib/auth/roles";
import { UserLoadingGuard } from "@/auth/components/RoleBasedLoadingGuard";
import { ReportViewHandler } from "@/components/dashboard/ReportViewHandler";

export default function UserDashboardPage() {
  const router = useRouter();
  const { userData } = useUserData();

  useEffect(() => {
    if (userData?.computedFields?.accessLevel !== UserRole.USER) {
      router.push("/dashboard");
    }
  }, [userData, router]);

  return (
    <ZustandDashboardProvider debug={process.env.NODE_ENV === "development"}>
      <UserLoadingGuard>
        <RoleBasedDashboard />
        <ReportViewHandler />
      </UserLoadingGuard>
    </ZustandDashboardProvider>
  );
}
