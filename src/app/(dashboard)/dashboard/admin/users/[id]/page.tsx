"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import UserProfileForm from "@/components/forms/UserProfileForm";
import UserSecurityForm from "@/components/forms/UserSecurityForm";
import { BranchAssignmentManager } from "@/components/branch/BranchAssignmentManager";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Permission } from "@/lib/auth/roles";

interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  branchId: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function UserPage() {
  const params = useParams();
  const router = useRouter();
  const { can } = usePermissions();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        if (!params?.id) {
          throw new Error("User ID is missing");
        }
        const response = await fetch(`/api/users/${params.id}`);
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to fetch user");
        }
        const data = await response.json();
        setUser(data);
      } catch (error) {
        console.error("Error fetching user:", error);
        toast({
          title: "Error",
          description:
            error instanceof Error
              ? error.message
              : "Failed to fetch user data",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [params?.id]);

  const handleSecurityUpdate = async (data: any) => {
    try {
      if (!params?.id) {
        throw new Error("User ID is missing");
      }
      const response = await fetch(`/api/users/${params.id}/security`, {
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

      setUser(result);
      toast({
        title: "Success",
        description: "Security settings updated successfully",
      });
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

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg text-muted-foreground">User not found</p>
          <Button onClick={() => router.push("/dashboard/admin/users")}>
            Return to Users
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">User Management</h1>
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/admin/users")}
        >
          Back to Users
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent>
            <UserProfileForm user={user} />
          </CardContent>
        </Card>

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
      </div>

      {can(Permission.MANAGE_BRANCHES) && (
        <Card>
          <CardHeader>
            <CardTitle>Branch Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <BranchAssignmentManager userId={user.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
