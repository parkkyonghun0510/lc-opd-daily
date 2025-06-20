"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ArrowLeft, CheckCircle, XCircle, Pencil } from "lucide-react";
import { BranchAssignmentManager } from "@/components/branch/BranchAssignmentManager";
import Link from "next/link";
import UserSecurityForm from "@/components/forms/UserSecurityForm";
import { Badge } from "@/components/ui/badge";
import UserProfileForm from "@/components/forms/UserProfileForm";

interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  role: string;
  branchId: string | null;
  isActive: boolean;
}

export default function UserDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchUser() {
      setLoading(true);
      try {
        const response = await fetch(`/api/users/${id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch user");
        }
        const userData = await response.json();
        setUser(userData);
      } catch (error) {
        console.error("Error fetching user:", error);
        toast({
          title: "Error",
          description: "Failed to load user data.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchUser();
    }
  }, [id, toast]);

  const handleSecurityUpdate = async (data: any) => {
    try {
      const response = await fetch(`/api/users/${id}/security`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update security settings");
      }

      setUser((prev) => (prev ? { ...prev, isActive: result.isActive } : null));
      toast({
        title: "Success",
        description: "Security settings updated successfully",
      });
      return result;
    } catch (error) {
      console.error("Error updating security settings:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update security settings",
        variant: "destructive",
      });
      throw error;
    }
  };

  const toggleUserStatus = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/users/${id}/toggle-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update user status");
      }

      setUser((prev) => (prev ? { ...prev, isActive: result.isActive } : null));
      toast({
        title: "Success",
        description: `User ${result.isActive ? "activated" : "deactivated"} successfully`,
      });
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update user status",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 text-red-800 rounded-md">
        User not found or you don't have permission to view this user.
      </div>
    );
  }

  return (
    <div className="container py-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/users">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <Badge
            variant={user.isActive ? "default" : "destructive"}
            className={
              user.isActive
                ? "bg-green-100 text-green-800 hover:bg-green-200"
                : "bg-red-100 text-red-800 hover:bg-red-200"
            }
          >
            {user.isActive ? (
              <>
                <CheckCircle className="mr-1 h-3 w-3" /> Active
              </>
            ) : (
              <>
                <XCircle className="mr-1 h-3 w-3" /> Inactive
              </>
            )}
          </Badge>
        </div>
        <Button
          variant={user.isActive ? "destructive" : "default"}
          onClick={toggleUserStatus}
          disabled={loading}
        >
          {user.isActive ? "Deactivate User" : "Activate User"}
        </Button>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="branches">Branch Assignments</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>User Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {user && (
                <UserProfileForm
                  user={{
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    name: user.name,
                    branchId: user.branchId,
                  }}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branches">
          <BranchAssignmentManager userId={user.id} />
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <UserSecurityForm
                userId={user.id}
                isActive={user.isActive}
                onSubmit={handleSecurityUpdate}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
