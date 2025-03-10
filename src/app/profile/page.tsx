"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  branchId?: string;
  branch?: {
    name: string;
    code: string;
  };
  lastLogin?: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchUserProfile() {
      try {
        const response = await fetch("/api/auth/me");

        if (!response.ok) {
          if (response.status === 401) {
            // User is not authenticated, redirect to login
            router.push("/login");
            return;
          }
          throw new Error("Failed to fetch user profile");
        }

        const data = await response.json();
        setUser(data.user);
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError("Could not load your profile. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    fetchUserProfile();
  }, [router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-pulse text-lg">Loading profile...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="mt-4 flex justify-center">
          <Button onClick={() => router.push("/dashboard")}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>User profile could not be found.</AlertDescription>
        </Alert>
        <div className="mt-4 flex justify-center">
          <Button onClick={() => router.push("/login")}>Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">User Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Name
              </h3>
              <p className="mt-1 text-lg">{user.name}</p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Email
              </h3>
              <p className="mt-1 text-lg">{user.email}</p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Role
              </h3>
              <p className="mt-1 text-lg capitalize">{user.role}</p>
            </div>

            {user.branch && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Branch
                </h3>
                <p className="mt-1 text-lg">
                  {user.branch.name} ({user.branch.code})
                </p>
              </div>
            )}

            {user.lastLogin && (
              <div className="col-span-1 md:col-span-2">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Last Login
                </h3>
                <p className="mt-1">
                  {new Date(user.lastLogin).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-end space-x-2">
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/change-password")}
            >
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
