"use client";

import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Building2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";

interface BranchInfo {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  isActive: boolean;
  hasReportToday?: boolean;
  todayReportStatus?: string | null;
  parent?: {
    id: string;
    code: string;
    name: string;
  };
  _count?: {
    users: number;
    reports: number;
    children: number;
  };
}

export interface DefaultBranchListProps {
  className?: string;
  onBranchSelect?: (branchId: string) => void;
  showActions?: boolean;
}

export function DefaultBranchList({ 
  className,
  onBranchSelect,
  showActions = true 
}: DefaultBranchListProps) {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBranches = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/branches');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch branches: ${response.statusText}`);
      }
      
      const data = await response.json();
      setBranches(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load branches';
      setError(errorMessage);
      console.error('Error fetching branches:', err);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleRefresh = () => {
    fetchBranches();
  };

  const handleBranchClick = (branchId: string) => {
    if (onBranchSelect) {
      onBranchSelect(branchId);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("rounded-lg border shadow-sm overflow-hidden", className)}>
        <div className="bg-muted/50 p-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Branch Status Overview
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Loading available branches...
          </p>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading branches...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-lg border shadow-sm overflow-hidden", className)}>
        <div className="bg-muted/50 p-4">
          <h3 className="text-lg font-medium flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            Error Loading Branches
          </h3>
          <p className="text-sm text-red-500 mt-1">
            {error}
          </p>
        </div>
        <div className="p-4">
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-sm text-muted-foreground text-center">
              Unable to load branch information. Please try again.
            </p>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <div className={cn("rounded-lg border shadow-sm overflow-hidden", className)}>
        <div className="bg-muted/50 p-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Branch Status Overview
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            No branches available
          </p>
        </div>
        <div className="p-4">
          <div className="flex flex-col items-center gap-4 py-8">
            <Building2 className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">No branches found</p>
              <p className="text-xs text-muted-foreground">
                Contact your administrator to set up branches.
              </p>
            </div>
            {showActions && (
              <Button onClick={handleRefresh} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Separate active and inactive branches
  const activeBranches = branches.filter(branch => branch.isActive);
  const inactiveBranches = branches.filter(branch => !branch.isActive);

  // Function to organize branches hierarchically
  const organizeBranchesHierarchically = (branchList: BranchInfo[]) => {
    const branchMap = new Map<string, BranchInfo>();
    const rootBranches: BranchInfo[] = [];
    const childrenMap = new Map<string, BranchInfo[]>();

    // First pass: create maps
    branchList.forEach(branch => {
      branchMap.set(branch.id, branch);
      if (!branch.parentId) {
        rootBranches.push(branch);
      } else {
        if (!childrenMap.has(branch.parentId)) {
          childrenMap.set(branch.parentId, []);
        }
        childrenMap.get(branch.parentId)!.push(branch);
      }
    });

    // Sort root branches by code
    rootBranches.sort((a, b) => a.code.localeCompare(b.code));

    // Sort children for each parent
    childrenMap.forEach((children) => {
      children.sort((a, b) => a.code.localeCompare(b.code));
    });

    // Function to recursively get all children of a branch
    const getHierarchicalList = (parentBranches: BranchInfo[], level = 0): (BranchInfo & { level: number })[] => {
      const result: (BranchInfo & { level: number })[] = [];
      
      parentBranches.forEach(branch => {
        // Add the current branch with its level
        result.push({ ...branch, level });
        
        // Add its children recursively
        const children = childrenMap.get(branch.id) || [];
        if (children.length > 0) {
          result.push(...getHierarchicalList(children, level + 1));
        }
      });
      
      return result;
    };

    return getHierarchicalList(rootBranches);
  };

  // Organize both active and inactive branches hierarchically
  const organizedActiveBranches = organizeBranchesHierarchically(activeBranches);
  const organizedInactiveBranches = organizeBranchesHierarchically(inactiveBranches);

  return (
    <div className={cn("rounded-lg border shadow-sm overflow-hidden", className)}>
      <div className="bg-muted/50 p-4 flex flex-row items-center justify-between">
        <div>
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Branch Status Overview
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Showing {branches.length} branch{branches.length !== 1 ? 'es' : ''} 
            ({activeBranches.length} active, {inactiveBranches.length} inactive) - organized hierarchically
            <br />
            <span className="text-xs text-red-600 font-medium">
              • Branches with red highlighting are missing today's daily reports
            </span>
          </p>
        </div>
        {showActions && (
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        )}
      </div>
      <div className="p-4">
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Branch Code</TableHead>
                <TableHead className="whitespace-nowrap">Branch Name</TableHead>
                <TableHead className="whitespace-nowrap">Parent Branch</TableHead>
                <TableHead className="whitespace-nowrap text-center">Users</TableHead>
                <TableHead className="whitespace-nowrap text-center">Reports</TableHead>
                <TableHead className="whitespace-nowrap text-center">Sub-Branches</TableHead>
                <TableHead className="whitespace-nowrap text-center">Today's Report</TableHead>
                <TableHead className="whitespace-nowrap text-center">Status</TableHead>
                {showActions && (
                  <TableHead className="whitespace-nowrap text-center">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizedActiveBranches.map((branch) => (
                <TableRow 
                  key={branch.id}
                  className={cn(
                    "cursor-pointer hover:bg-muted/50 transition-colors",
                    onBranchSelect && "hover:bg-accent",
                    branch.level > 0 && "bg-muted/20", // Slightly different background for child branches
                    // Highlighting for branches without reports
                    !branch.hasReportToday && "bg-red-50 dark:bg-red-950/20 border-l-4 border-l-red-400"
                  )}
                  onClick={() => handleBranchClick(branch.id)}
                >
                  <TableCell className="whitespace-nowrap font-medium">
                    <div className="flex items-center">
                      {/* Indentation for hierarchy */}
                      {branch.level > 0 && (
                        <div 
                          className="border-l-2 border-muted-foreground/30 mr-2" 
                          style={{ marginLeft: `${branch.level * 16}px`, height: '20px', width: '12px' }}
                        />
                      )}
                      {branch.level > 0 && (
                        <span className="text-muted-foreground mr-1">└─</span>
                      )}
                      <span className={cn(
                        branch.level === 0 ? "font-semibold" : "font-normal"
                      )}>
                        {branch.code}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className={cn(
                      branch.level === 0 ? "font-semibold" : "font-normal"
                    )}>
                      {branch.name}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {branch.parent ? (
                      <span className="text-sm text-muted-foreground">
                        {branch.parent.code} - {branch.parent.name}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground italic font-medium">
                        Root Branch
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-center">
                    <Badge variant="secondary" className="text-xs">
                      {branch._count?.users || 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-center">
                    <Badge variant="outline" className="text-xs">
                      {branch._count?.reports || 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-center">
                    <Badge variant="outline" className="text-xs">
                      {branch._count?.children || 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-center">
                    {branch.hasReportToday ? (
                      <Badge 
                        className={cn(
                          "text-xs",
                          branch.todayReportStatus === "approved" 
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : branch.todayReportStatus === "pending"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                        )}
                      >
                        {branch.todayReportStatus === "approved" ? "✓ Submitted" :
                         branch.todayReportStatus === "pending" ? "⏳ Pending" : "📝 Draft"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs border-red-300 text-red-600 dark:border-red-700 dark:text-red-400">
                        ❌ Missing
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-center">
                    <Badge 
                      className={cn(
                        "text-xs",
                        branch.isActive 
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                      )}
                    >
                      {branch.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  {showActions && (
                    <TableCell className="whitespace-nowrap text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBranchClick(branch.id);
                        }}
                        className="text-xs h-8 px-2"
                      >
                        View Details
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              
              {/* Inactive branches section */}
              {organizedInactiveBranches.length > 0 && (
                <>
                  <TableRow className="bg-muted/30">
                    <TableCell 
                      colSpan={showActions ? 9 : 8} 
                      className="text-center text-sm font-medium text-muted-foreground py-2"
                    >
                      Inactive Branches ({inactiveBranches.length})
                    </TableCell>
                  </TableRow>
                  {organizedInactiveBranches.map((branch) => (
                    <TableRow 
                      key={branch.id}
                      className={cn(
                        "opacity-60 cursor-pointer hover:bg-muted/30 transition-colors",
                        onBranchSelect && "hover:bg-accent/50",
                        branch.level > 0 && "bg-muted/10" // Slightly different background for child branches
                      )}
                      onClick={() => handleBranchClick(branch.id)}
                    >
                      <TableCell className="whitespace-nowrap font-medium">
                        <div className="flex items-center">
                          {/* Indentation for hierarchy */}
                          {branch.level > 0 && (
                            <div 
                              className="border-l-2 border-muted-foreground/20 mr-2" 
                              style={{ marginLeft: `${branch.level * 16}px`, height: '20px', width: '12px' }}
                            />
                          )}
                          {branch.level > 0 && (
                            <span className="text-muted-foreground mr-1">└─</span>
                          )}
                          <span className={cn(
                            branch.level === 0 ? "font-semibold" : "font-normal"
                          )}>
                            {branch.code}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className={cn(
                          branch.level === 0 ? "font-semibold" : "font-normal"
                        )}>
                          {branch.name}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {branch.parent ? (
                          <span className="text-sm text-muted-foreground">
                            {branch.parent.code} - {branch.parent.name}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground italic font-medium">
                            Root Branch
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center">
                        <Badge variant="secondary" className="text-xs">
                          {branch._count?.users || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center">
                        <Badge variant="outline" className="text-xs">
                          {branch._count?.reports || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center">
                        <Badge variant="outline" className="text-xs">
                          {branch._count?.children || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center">
                        {branch.hasReportToday ? (
                          <Badge 
                            className={cn(
                              "text-xs opacity-60",
                              branch.todayReportStatus === "approved" 
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : branch.todayReportStatus === "pending"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                            )}
                          >
                            {branch.todayReportStatus === "approved" ? "✓ Submitted" :
                             branch.todayReportStatus === "pending" ? "⏳ Pending" : "📝 Draft"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs border-red-300 text-red-600 dark:border-red-700 dark:text-red-400 opacity-60">
                            ❌ Missing
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center">
                        <Badge 
                          className="text-xs bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                        >
                          Inactive
                        </Badge>
                      </TableCell>
                      {showActions && (
                        <TableCell className="whitespace-nowrap text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBranchClick(branch.id);
                            }}
                            className="text-xs h-8 px-2"
                          >
                            View Details
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}