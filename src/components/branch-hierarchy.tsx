"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

type Branch = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  parentId: string | null;
  children?: Branch[];
};

interface BranchHierarchyProps {
  className?: string;
}

export default function BranchHierarchy({ className }: BranchHierarchyProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all branches
  const fetchBranches = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/branches");

      if (!response.ok) {
        throw new Error("Failed to fetch branches");
      }

      const data = await response.json();
      setBranches(data);
    } catch (err) {
      console.error("Error fetching branches:", err);
      setError("Failed to load branch hierarchy. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  // Build branch hierarchy tree
  const buildBranchTree = (branches: Branch[]) => {
    // Create a map of branches by ID for quick lookup
    const branchMap = new Map<string, Branch>();
    branches.forEach((branch) => {
      branchMap.set(branch.id, { ...branch, children: [] });
    });

    // Build the tree structure
    const rootBranches: Branch[] = [];

    branchMap.forEach((branch) => {
      if (branch.parentId) {
        const parent = branchMap.get(branch.parentId);
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(branch);
        } else {
          // If parent doesn't exist, treat as root branch but log a warning
          console.warn(
            `Branch ${branch.code} has parentId ${branch.parentId} which doesn't exist`
          );
          rootBranches.push(branch);
        }
      } else {
        rootBranches.push(branch);
      }
    });

    return rootBranches;
  };

  // Render a branch node and its children
  const renderBranchNode = (branch: Branch, level = 0) => {
    return (
      <div key={branch.id} className="mb-1">
        <div
          className={`flex items-center p-2 rounded-md ${
            branch.isActive ? "bg-gray-100" : "bg-gray-50 opacity-70"
          }`}
          style={{ marginLeft: `${level * 20}px` }}
        >
          <div className="flex-1">
            <div className="font-medium">
              {branch.code} - {branch.name}
            </div>
            <div className="text-sm text-muted-foreground">
              {branch.children && branch.children.length > 0
                ? `${branch.children.length} sub-branches`
                : "No sub-branches"}
            </div>
          </div>
          <Badge
            variant={branch.isActive ? "secondary" : "outline"}
            className={
              branch.isActive
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }
          >
            {branch.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        {branch.children && branch.children.length > 0 && (
          <div className="ml-4 pl-4 border-l border-gray-200">
            {branch.children.map((child) => renderBranchNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const branchTree = buildBranchTree(branches);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Branch Hierarchy</CardTitle>
        <CardDescription>
          Visual representation of branch organizational structure
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md">
            {error}
          </div>
        ) : branchTree.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No branches found
          </div>
        ) : (
          <div className="space-y-2">
            {branchTree.map((branch) => renderBranchNode(branch))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
