"use client";

import { DashboardLayout } from "@/components/dashboard/layout/DashboardLayout";
import { ZustandHybridRealtimeProvider } from "@/components/dashboard/ZustandHybridRealtimeProvider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ZustandHybridRealtimeProvider debug={process.env.NODE_ENV === 'development'}>
      <DashboardLayout>{children}</DashboardLayout>
    </ZustandHybridRealtimeProvider>
  );
}
