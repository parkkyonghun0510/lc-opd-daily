"use client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoleManager } from "./RoleManager";
import Link from "next/link";
import BranchHierarchy from "@/components/branch-hierarchy";
import { useState } from "react";
import { invalidateBranchCaches } from "@/lib/cache/branch-cache";
import { toast } from "@/components/ui/use-toast";

export function BranchSettings() {
  const [refreshingCache, setRefreshingCache] = useState(false);

  const handleInvalidateCache = async () => {
    setRefreshingCache(true);
    try {
      await invalidateBranchCaches();
      toast({
        title: "Cache invalidated",
        description: "Branch hierarchy caches have been refreshed",
      });
    } catch (error) {
      console.error("Error invalidating cache:", error);
      toast({
        title: "Error",
        description: "Failed to invalidate cache",
        variant: "destructive",
      });
    } finally {
      setRefreshingCache(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Branch Management</h3>
        <p className="text-sm text-muted-foreground">
          Create and manage branch hierarchies and their settings.
        </p>
      </div>

      <Separator />

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Branch List</TabsTrigger>
          <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle>Branch List</CardTitle>
              <CardDescription>
                View and manage all branches in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Access the complete list of branches for detailed management
                </p>
                <Button variant="outline" asChild>
                  <Link href="/admin/branches">View All Branches</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hierarchy">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Branch Hierarchy</CardTitle>
                <CardDescription>
                  Visual representation of branch organizational structure
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={handleInvalidateCache}
                disabled={refreshingCache}
              >
                {refreshingCache ? "Refreshing..." : "Refresh Cache"}
              </Button>
            </CardHeader>
            <CardContent>
              <BranchHierarchy />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>Branch Permissions</CardTitle>
              <CardDescription>
                Manage role-based access control for branches
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RoleManager context="branch" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Branch Access Documentation</CardTitle>
          <CardDescription>Learn about the branch RBAC system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            <p>
              The branch role-based access control (RBAC) system determines
              which branches a user can access based on their role and explicit
              branch assignments.
            </p>
            <ul className="list-disc list-inside mt-2 ml-4 space-y-1">
              <li>
                <strong>Admins</strong> have access to all branches
              </li>
              <li>
                <strong>Branch Managers</strong> have access to their assigned
                branches and all sub-branches
              </li>
              <li>
                <strong>Supervisors</strong> have access only to explicitly
                assigned branches
              </li>
              <li>
                <strong>Users</strong> have access only to explicitly assigned
                branches
              </li>
            </ul>
          </div>
          <Button variant="outline" asChild>
            <Link href="/docs/branch-rbac.md" target="_blank">
              View Full Documentation
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
