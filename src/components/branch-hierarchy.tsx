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
import { Loader2, ChevronRight, ChevronDown, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

type Branch = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  parentId: string | null;
  children?: Branch[];
  // Enhanced properties
  level?: number;
  path?: string[];
  expanded?: boolean;
};

interface BranchHierarchyProps {
  className?: string;
}

export default function BranchHierarchy({ className }: BranchHierarchyProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(false);

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

  // Toggle expand/collapse state for a branch
  const toggleBranchExpanded = (branchId: string) => {
    setBranches((prevBranches) => {
      const updatedBranches = [...prevBranches];
      const branch = updatedBranches.find((b) => b.id === branchId);
      if (branch) {
        branch.expanded = !branch.expanded;
      }
      return updatedBranches;
    });
  };

  // Toggle expand/collapse all branches
  const toggleExpandAll = () => {
    const newExpandState = !expandAll;
    setExpandAll(newExpandState);

    setBranches((prevBranches) => {
      return prevBranches.map((branch) => ({
        ...branch,
        expanded: newExpandState,
      }));
    });
  };

  // Build branch hierarchy tree with proper level and path calculation
  const buildBranchTree = (branches: Branch[]) => {
    // Create a map of branches by ID for quick lookup
    const branchMap = new Map<string, Branch>();
    branches.forEach((branch) => {
      branchMap.set(branch.id, {
        ...branch,
        children: [],
        level: 0,
        path: [branch.id],
        expanded: expandAll,
      });
    });

    // Process all branches to calculate levels and paths
    const calculateLevelsAndPaths = () => {
      // First, identify root branches and set their properties
      const rootBranches: Branch[] = [];
      const processed = new Set<string>();

      branchMap.forEach((branch) => {
        if (!branch.parentId) {
          branch.level = 0;
          branch.path = [branch.id];
          rootBranches.push(branch);
          processed.add(branch.id);
        }
      });

      // Process remaining branches in waves until all are processed
      let newlyProcessed = true;
      while (newlyProcessed) {
        newlyProcessed = false;

        branchMap.forEach((branch) => {
          if (processed.has(branch.id)) return;

          if (branch.parentId && processed.has(branch.parentId)) {
            const parent = branchMap.get(branch.parentId);
            if (parent) {
              branch.level = (parent.level || 0) + 1;
              branch.path = [...(parent.path || []), branch.id];
              processed.add(branch.id);
              newlyProcessed = true;
            }
          }
        });

        // Break if we can't process any more branches
        if (!newlyProcessed && processed.size < branchMap.size) {
          console.warn(
            "Some branches could not be processed - possible cycle detected"
          );

          // Handle remaining branches as disconnected
          branchMap.forEach((branch) => {
            if (!processed.has(branch.id)) {
              branch.level = 0;
              branch.path = [branch.id];
              rootBranches.push(branch);
              processed.add(branch.id);
            }
          });
        }
      }
    };

    calculateLevelsAndPaths();

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
          rootBranches.push(branch);
        }
      } else {
        rootBranches.push(branch);
      }
    });

    return rootBranches;
  };

  // Render a branch node and its children
  const renderBranchNode = (branch: Branch) => {
    const children = branch.children || [];
    const hasChildren = children.length > 0;
    const level = branch.level || 0;
    const pathString = (branch.path || [])
      .map((id) => {
        const b = branches.find((branch) => branch.id === id);
        return b ? b.code : id;
      })
      .join(" → ");

    return (
      <div key={branch.id} className="mb-1">
        <div
          className={`flex items-center p-2 rounded-md ${
            branch.isActive ? "bg-gray-100" : "bg-gray-50 opacity-70"
          }`}
        >
          <div
            className="flex items-center flex-1 cursor-pointer"
            onClick={() => hasChildren && toggleBranchExpanded(branch.id)}
          >
            {/* Indentation based on level */}
            <div style={{ width: `${level * 24}px` }} />

            {/* Expand/collapse icon */}
            {hasChildren ? (
              <div className="mr-2 text-gray-500">
                {branch.expanded ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
              </div>
            ) : (
              <div className="mr-2 w-4" />
            )}

            <div className="flex-1">
              <div className="font-medium flex items-center">
                {branch.code} - {branch.name}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-1 p-0 h-6 w-6"
                      >
                        <Info size={14} className="text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1">
                        <div>
                          <strong>ID:</strong> {branch.id}
                        </div>
                        <div>
                          <strong>Level:</strong> {level}
                        </div>
                        <div>
                          <strong>Path:</strong> {pathString}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="text-sm text-muted-foreground">
                {hasChildren
                  ? `${children.length} sub-branches`
                  : "No sub-branches"}
              </div>
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

        {/* Render children if expanded */}
        {hasChildren && branch.expanded && (
          <div className="ml-6 pl-4 border-l border-gray-200">
            {children.map((child) => renderBranchNode(child))}
          </div>
        )}
      </div>
    );
  };

  const branchTree = buildBranchTree(branches);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle>Branch Hierarchy</CardTitle>
          <CardDescription>
            Visual representation of branch organizational structure
          </CardDescription>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={toggleExpandAll}
          disabled={loading || branches.length === 0}
        >
          {expandAll ? "Collapse All" : "Expand All"}
        </Button>
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
// upstash/redis
