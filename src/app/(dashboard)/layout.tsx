"use client";

import { DashboardLayout } from "@/components/dashboard/layout/DashboardLayout";
import { ZustandDashboardProvider } from "@/components/dashboard/ZustandDashboardProvider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ZustandDashboardProvider debug={process.env.NODE_ENV === "development"}>
      <DashboardLayout>{children}</DashboardLayout>
    </ZustandDashboardProvider>
  );
}
