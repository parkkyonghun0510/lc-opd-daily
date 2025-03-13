"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";
import { DashboardLayout } from "@/components/dashboard/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Users, DollarSign, ShoppingCart, TrendingUp } from "lucide-react";

interface DashboardData {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  growthRate: number;
}

export default function DashboardPage() {
  const { status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    async function fetchDashboardData() {
      try {
        const response = await fetch("/api/dashboard/data");
        if (!response.ok) {
          throw new Error("Failed to fetch dashboard data");
        }
        const result = await response.json();
        if (result.error) {
          throw new Error(result.error);
        }
        setData(result.data);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }

    if (status === "authenticated") {
      fetchDashboardData();
    }
  }, [status, router]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const dashboardContent = loading ? (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
      <Icons.spinner className="h-8 w-8 animate-spin" />
    </div>
  ) : !data ? (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
      <p className="text-destructive">Failed to load dashboard data</p>
    </div>
  ) : (
    <div className="container mx-auto p-6">
      <h1 className="mb-8 text-3xl font-bold">Dashboard Overview</h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Orders (30d)
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Revenue (30d)
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.totalRevenue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                data.growthRate >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {data.growthRate >= 0 ? "+" : ""}
              {data.growthRate}%
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="mt-8">
        <Button onClick={() => router.refresh()}>Refresh Data</Button>
      </div>
    </div>
  );

  return <DashboardLayout>{dashboardContent}</DashboardLayout>;
}
