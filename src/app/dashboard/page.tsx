"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  FileTextIcon,
  BarChart3Icon,
  PlusCircleIcon,
  LayoutDashboard,
  UserIcon,
  Settings,
} from "lucide-react";
import { useRouter } from "next/navigation";

// Define type for user data
type User = {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  branchId?: string;
};

// Dashboard page component
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user data
  useEffect(() => {
    async function fetchUserData() {
      try {
        const response = await fetch("/api/auth/me");
        if (!response.ok) {
          throw new Error("Failed to fetch user data");
        }

        const data = await response.json();
        setUser(data.user);
      } catch (err) {
        console.error("Error fetching user data:", err);
        setError("Failed to load user data. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen p-4">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md max-w-md mb-4">
          <p>{error}</p>
        </div>
        <Button onClick={() => router.refresh()}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Welcome, {user?.name || "User"}
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          {user?.role === "admin"
            ? "Administrator Dashboard"
            : "Daily Reports Dashboard"}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Create Report</CardTitle>
            <CardDescription>
              Submit a new daily report for your branch
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/reports/create">
              <Button className="w-full">
                <PlusCircleIcon className="mr-2 h-4 w-4" />
                Create New Report
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>View Reports</CardTitle>
            <CardDescription>
              Browse and filter all submitted reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/reports">
              <Button className="w-full" variant="outline">
                <FileTextIcon className="mr-2 h-4 w-4" />
                View All Reports
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Consolidated View</CardTitle>
            <CardDescription>
              See consolidated data across all branches
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/consolidated">
              <Button className="w-full" variant="outline">
                <BarChart3Icon className="mr-2 h-4 w-4" />
                View Consolidated Data
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <h2 className="text-xl font-semibold mb-4">Quick Links</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        <Link href="/dashboard">
          <Button variant="ghost" className="w-full justify-start">
            <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
          </Button>
        </Link>
        <Link href="/profile">
          <Button variant="ghost" className="w-full justify-start">
            <UserIcon className="mr-2 h-4 w-4" /> Profile
          </Button>
        </Link>
        {user?.role === "admin" && (
          <Link href="/settings">
            <Button variant="ghost" className="w-full justify-start">
              <Settings className="mr-2 h-4 w-4" /> Settings
            </Button>
          </Link>
        )}
      </div>

      {/* User Information */}
      <h2 className="text-xl font-semibold mb-4">Your Information</h2>
      <Card>
        <CardContent className="pt-6">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Username
              </dt>
              <dd className="mt-1 text-base">{user?.username}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Full Name
              </dt>
              <dd className="mt-1 text-base">{user?.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Email
              </dt>
              <dd className="mt-1 text-base">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Role
              </dt>
              <dd className="mt-1 text-base capitalize">{user?.role}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
