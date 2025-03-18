"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import UserProfileForm from "@/components/forms/UserProfileForm";
import UserSecurityForm from "@/components/forms/UserSecurityForm";
import { BranchAssignmentManager } from "@/components/branch/BranchAssignmentManager";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  branchId: string | null;
  isActive: boolean;
}

export default function UserEditPage() {
  const { id } = useParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    async function fetchUser() {
      setLoading(true);
      try {
        const response = await fetch(`/api/users/${id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch user");
        }

        const userData = await response.json();
        setUser(userData);
      } catch (err) {
        console.error("Error fetching user:", err);
        setError("Failed to load user data. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md">
        {error || "User not found"}
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Edit User</h2>
        <p className="text-muted-foreground">
          Manage user details, branch assignments and security settings.
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle>{user.name}</CardTitle>
              <TabsList>
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="branches">Branches</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <TabsContent value="profile" className="mt-0">
              <UserProfileForm userId={user.id} userData={user} />
            </TabsContent>

            <TabsContent value="branches" className="mt-0">
              <BranchAssignmentManager
                userId={user.id}
                userName={user.name}
                userRole={user.role}
                currentBranchId={user.branchId}
              />
            </TabsContent>

            <TabsContent value="security" className="mt-0">
              <UserSecurityForm userId={user.id} />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
