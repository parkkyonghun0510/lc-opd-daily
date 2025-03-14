"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RoleManager } from "./RoleManager";
import Link from "next/link";

export function BranchSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Branch Management</h3>
        <p className="text-sm text-muted-foreground">
          Create and manage branch hierarchies and their settings.
        </p>
      </div>

      <Separator />
      <Card>
        <CardHeader>
          <CardTitle>Branch List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              View and manage all branches
            </p>
            <Button variant="outline" asChild>
              <Link href="/admin/branches">View All Branches</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branch Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <RoleManager context="branch" />
        </CardContent>
      </Card>
    </div>
  );
}
