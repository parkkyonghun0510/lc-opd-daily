"use client";

import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import {
  BarChart,
  FileText,
  Users,
  Building2,
  Clock,
  AlertCircle,
  ChevronLeft,
  Loader2,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { UserRole } from "@/lib/auth/roles";
import { useEffect, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { formatKHRCurrency } from "@/lib/utils";

interface DashboardData {
  totalUsers: number;
  totalReports: number;
  totalAmount: number;
  growthRate: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  onClick?: () => void;
  isLoading?: boolean;
}

function StatCard({ 
  title, 
  value, 
  icon, 
  description, 
  onClick,
  isLoading = false
}: StatCardProps) {
  return (
    <Card
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm ${
        onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""
      }`}
      onClick={onClick}
    >
      <div className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="text-gray-500 dark:text-gray-400">{icon}</div>
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {title}
          </h3>
        </div>
        <div className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">
          {isLoading ? (
            <div className="flex items-center">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              <span className="text-gray-400">Loading...</span>
            </div>
          ) : (
            value
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      </div>
    </Card>
  );
}

export function RoleBasedDashboard() {
  const { data: session } = useSession();
  const router = useRouter();
  const userRole = session?.user?.role || UserRole.USER;
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [pendingReports, setPendingReports] = useState<number | null>(null);
  const [userStats, setUserStats] = useState<{total: number, active: number, admin: number} | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const response = await fetch("/api/dashboard/data");
        if (!response.ok) {
          throw new Error("Failed to fetch dashboard data");
        }
        const result = await response.json();
        setDashboardData(result.data);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        toast({
          title: "Error",
          description: "Failed to load dashboard data",
          variant: "destructive"
        });
      }
    }
    
    async function fetchPendingReports() {
      try {
        const response = await fetch("/api/reports/pending");
        if (!response.ok) {
          throw new Error("Failed to fetch pending reports");
        }
        const result = await response.json();
        setPendingReports(result.reports.length);
      } catch (error) {
        console.error("Error fetching pending reports:", error);
      }
    }
    
    async function fetchUserStats() {
      if (userRole === UserRole.ADMIN) {
        try {
          const response = await fetch("/api/users/stats");
          if (!response.ok) {
            throw new Error("Failed to fetch user statistics");
          }
          const result = await response.json();
          setUserStats(result);
        } catch (error) {
          console.error("Error fetching user statistics:", error);
        }
      }
    }
    
    const fetchAllData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchDashboardData(),
        fetchPendingReports(),
        fetchUserStats()
      ]);
      setIsLoading(false);
    };
    
    fetchAllData();
  }, [userRole]);

  const AdminDashboard = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>
        <Button onClick={() => router.push("/dashboard/reports/consolidated")}>
          View Consolidated Reports
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Total Users"
          value={userStats?.total || 0}
          icon={<Users size={20} />}
          description="Active users in the system"
          onClick={() => router.push("/dashboard/users")}
          isLoading={isLoading}
        />
        <StatCard
          title="Total Reports"
          value={dashboardData?.totalReports || 0}
          icon={<FileText size={20} />}
          description="Reports across all branches"
          onClick={() => router.push("/dashboard/reports")}
          isLoading={isLoading}
        />
        <StatCard
          title="Pending Reports"
          value={pendingReports || 0}
          icon={<Clock size={20} />}
          description="Reports awaiting approval"
          onClick={() => router.push("/dashboard/reports/pending")}
          isLoading={isLoading}
        />
        <StatCard
          title="Total Amount"
          value={formatKHRCurrency(dashboardData?.totalAmount || 0)}
          icon={<Building2 size={20} />}
          description="Total write-offs and 90+ days"
          onClick={() => router.push("/dashboard/analytics")}
          isLoading={isLoading}
        />
        <StatCard
          title="Admin Users"
          value={userStats?.admin || 0}
          icon={<Shield size={20} />}
          description="Users with admin access"
          onClick={() => router.push("/dashboard/admin/users")}
          isLoading={isLoading}
        />
        <StatCard
          title="Growth Rate"
          value={`${dashboardData?.growthRate || 0}%`}
          icon={<BarChart size={20} />}
          description="Month-over-month growth"
          onClick={() => router.push("/dashboard/analytics")}
          isLoading={isLoading}
        />
      </div>
    </div>
  );

  const ManagerDashboard = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Branch Manager Dashboard</h2>
        <Button onClick={() => router.push("/dashboard/reports/create")}>
          Create Report
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Branch Reports"
          value={dashboardData?.totalReports || 0}
          icon={<FileText size={20} />}
          description="Reports in your branches"
          onClick={() => router.push("/dashboard/reports")}
          isLoading={isLoading}
        />
        <StatCard
          title="Pending Reports"
          value={pendingReports || 0}
          icon={<Clock size={20} />}
          description="Reports awaiting your approval"
          onClick={() => router.push("/dashboard/reports/pending")}
          isLoading={isLoading}
        />
        <StatCard
          title="Total Amount"
          value={formatKHRCurrency(dashboardData?.totalAmount || 0)}
          icon={<Building2 size={20} />}
          description="Total write-offs and 90+ days"
          onClick={() => router.push("/dashboard/analytics")}
          isLoading={isLoading}
        />
        <StatCard
          title="Growth Rate"
          value={`${dashboardData?.growthRate || 0}%`}
          icon={<BarChart size={20} />}
          description="Month-over-month growth"
          onClick={() => router.push("/dashboard/reports")}
          isLoading={isLoading}
        />
      </div>
    </div>
  );

  const UserDashboard = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="lg:hidden">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              My Dashboard
            </h1>
          </div>
        </div>
        <Button
          onClick={() => router.push("/dashboard/reports/create")}
          className="bg-black text-white hover:bg-gray-800"
        >
          Create Report
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="My Reports"
          value={dashboardData?.totalReports || 0}
          icon={<FileText className="h-5 w-5" />}
          description="Your submitted reports"
          onClick={() => router.push("/dashboard/reports")}
          isLoading={isLoading}
        />
        <StatCard
          title="Total Amount"
          value={formatKHRCurrency(dashboardData?.totalAmount || 0)}
          icon={<Building2 className="h-5 w-5" />}
          description="Total write-offs and 90+ days"
          onClick={() => router.push("/dashboard/reports")}
          isLoading={isLoading}
        />
        <StatCard
          title="Growth Rate"
          value={`${dashboardData?.growthRate || 0}%`}
          icon={<BarChart className="h-5 w-5" />}
          description="Month-over-month growth"
          onClick={() => router.push("/dashboard/analytics")}
          isLoading={isLoading}
        />
      </div>
    </div>
  );

  const ReadOnlyDashboard = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Reports Overview</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Branch Reports"
          value={dashboardData?.totalReports || 0}
          icon={<FileText size={20} />}
          description="Available reports to view"
          onClick={() => router.push("/dashboard/reports")}
          isLoading={isLoading}
        />
        <StatCard
          title="Total Amount"
          value={formatKHRCurrency(dashboardData?.totalAmount || 0)}
          icon={<Building2 size={20} />}
          description="Total write-offs and 90+ days"
          onClick={() => router.push("/dashboard/analytics")}
          isLoading={isLoading}
        />
        <StatCard
          title="Growth Rate"
          value={`${dashboardData?.growthRate || 0}%`}
          icon={<BarChart size={20} />}
          description="Month-over-month growth"
          onClick={() => router.push("/dashboard/reports")}
          isLoading={isLoading}
        />
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {userRole === UserRole.ADMIN && <AdminDashboard />}
      {userRole === UserRole.BRANCH_MANAGER && <ManagerDashboard />}
      {userRole === UserRole.USER && <UserDashboard />}
      {userRole === UserRole.SUPERVISOR && <ReadOnlyDashboard />}
    </div>
  );
}
