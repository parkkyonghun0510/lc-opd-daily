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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { UserRole } from "@/lib/auth/roles";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  onClick?: () => void;
}

function StatCard({ title, value, icon, description, onClick }: StatCardProps) {
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
          {value}
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

  const AdminDashboard = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>
        <Button onClick={() => router.push("/dashboard/reports/create")}>
          Create Report
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Total Users"
          value={150}
          icon={<Users size={20} />}
          description="Active users in the system"
          onClick={() => router.push("/dashboard/users")}
        />
        <StatCard
          title="Total Branches"
          value={12}
          icon={<Building2 size={20} />}
          description="Active branches"
          onClick={() => router.push("/dashboard/branches")}
        />
        <StatCard
          title="Pending Reports"
          value={8}
          icon={<Clock size={20} />}
          description="Reports awaiting approval"
          onClick={() => router.push("/dashboard/reports/pending")}
        />
        <StatCard
          title="Total Reports"
          value={450}
          icon={<FileText size={20} />}
          description="All reports across branches"
          onClick={() => router.push("/dashboard/reports")}
        />
        <StatCard
          title="System Alerts"
          value={3}
          icon={<AlertCircle size={20} />}
          description="Active system notifications"
          onClick={() => router.push("/dashboard/alerts")}
        />
        <StatCard
          title="Monthly Activity"
          value="View"
          icon={<BarChart size={20} />}
          description="System activity overview"
          onClick={() => router.push("/dashboard/analytics")}
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
          title="Branch Users"
          value={25}
          icon={<Users size={20} />}
          description="Users in your branches"
          onClick={() => router.push("/dashboard/branch-users")}
        />
        <StatCard
          title="Pending Reports"
          value={5}
          icon={<Clock size={20} />}
          description="Reports awaiting your approval"
          onClick={() => router.push("/dashboard/reports/pending")}
        />
        <StatCard
          title="Branch Reports"
          value={120}
          icon={<FileText size={20} />}
          description="All reports in your branches"
          onClick={() => router.push("/dashboard/reports")}
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
          value={15}
          icon={<FileText className="h-5 w-5" />}
          description="Your submitted reports"
          onClick={() => router.push("/dashboard/my-reports")}
        />
        <StatCard
          title="Pending Reports"
          value={2}
          icon={<Clock className="h-5 w-5" />}
          description="Your reports awaiting approval"
          onClick={() => router.push("/dashboard/my-reports/pending")}
        />
        <StatCard
          title="Branch Activity"
          value="View"
          icon={<BarChart className="h-5 w-5" />}
          description="Your branch overview"
          onClick={() => router.push("/dashboard/branch-activity")}
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
          value={120}
          icon={<FileText size={20} />}
          description="Available reports to view"
          onClick={() => router.push("/dashboard/reports")}
        />
        <StatCard
          title="Branch Activity"
          value="View"
          icon={<BarChart size={20} />}
          description="Branch statistics"
          onClick={() => router.push("/dashboard/statistics")}
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
