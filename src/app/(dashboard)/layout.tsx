"use client";

import { DashboardLayout } from "@/components/dashboard/layout/DashboardLayout";
import { EnhancedDashboardProvider } from "@/auth/components/EnhancedDashboardProvider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <EnhancedDashboardProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </EnhancedDashboardProvider>
  );
}
