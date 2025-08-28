"use client";

import { useState, useEffect, useMemo } from "react";
import { Building2, Loader2, Search } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { MobileSelect } from "@/components/ui/mobile-select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Branch {
  id: string;
  name: string;
  code: string;
  parentId?: string | null;
}

interface MobileBranchSelectorProps {
  userId: string;
  value?: string;
  onChange?: (branchId: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  showAllOption?: boolean;
  hierarchical?: boolean;
}

export function MobileBranchSelector({
  userId,
  value,
  onChange,
  placeholder = "Select branch",
  className = "",
  disabled = false,
  id,
  showAllOption = false,
  hierarchical = false,
}: MobileBranchSelectorProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);

  // Filter and organize branches
  const { filteredBranches, options } = useMemo(() => {
    let filtered = branches;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = branches.filter(
        (branch) =>
          branch.name.toLowerCase().includes(query) ||
          branch.code.toLowerCase().includes(query)
      );
    }

    // Create options array
    let branchOptions = filtered.map((branch) => {
      let label = `${branch.name} (${branch.code})`;
      
      // Add hierarchical indentation if enabled
      if (hierarchical && branch.parentId) {
        const level = calculateBranchLevel(branch, branches);
        const indent = "  ".repeat(level);
        label = `${indent}└─ ${label}`;
      }
      
      return {
        value: branch.id,
        label,
        disabled: false,
      };
    });

    // Add "All Branches" option if requested
    if (showAllOption) {
      branchOptions.unshift({
        value: "",
        label: "All My Branches",
        disabled: false,
      });
    }

    return {
      filteredBranches: filtered,
      options: branchOptions,
    };
  }, [branches, searchQuery, showAllOption, hierarchical]);

  // Calculate branch hierarchy level
  const calculateBranchLevel = (branch: Branch, allBranches: Branch[]): number => {
    let level = 0;
    let currentBranch = branch;
    
    while (currentBranch.parentId) {
      const parent = allBranches.find(b => b.id === currentBranch.parentId);
      if (!parent) break;
      level++;
      currentBranch = parent;
    }
    
    return level;
  };

  // Fetch user branches
  useEffect(() => {
    const fetchUserBranches = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/users/${userId}/branches`);
        if (!response.ok) throw new Error("Failed to fetch user branches");
        
        const data = await response.json();
        let branchData = data.branches || [];
        
        // Sort branches hierarchically if enabled
        if (hierarchical) {
          branchData = sortBranchesHierarchically(branchData);
        } else {
          // Simple alphabetical sort
          branchData.sort((a: Branch, b: Branch) => a.name.localeCompare(b.name));
        }
        
        setBranches(branchData);
      } catch (error) {
        console.error("Error fetching user branches:", error);
        toast({
          title: "Error",
          description: "Failed to load branches",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchUserBranches();
    }
  }, [userId, hierarchical]);

  // Sort branches hierarchically
  const sortBranchesHierarchically = (branchList: Branch[]): Branch[] => {
    const result: Branch[] = [];
    const branchMap = new Map(branchList.map(b => [b.id, b]));
    
    // Find root branches (no parent)
    const rootBranches = branchList.filter(b => !b.parentId);
    rootBranches.sort((a, b) => a.name.localeCompare(b.name));
    
    // Recursively add branches and their children
    const addBranchAndChildren = (branch: Branch) => {
      result.push(branch);
      
      // Find and add children
      const children = branchList.filter(b => b.parentId === branch.id);
      children.sort((a, b) => a.name.localeCompare(b.name));
      children.forEach(addBranchAndChildren);
    };
    
    rootBranches.forEach(addBranchAndChildren);
    return result;
  };

  const handleValueChange = (selectedValue: string) => {
    onChange?.(selectedValue);
    setSearchQuery(""); // Clear search when selection is made
    setIsSearchMode(false);
  };

  if (loading) {
    return (
      <div className={cn(
        "flex items-center gap-2 min-h-[44px] md:min-h-[36px]",
        "px-3 py-2 border border-input rounded-md bg-background",
        className
      )}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading branches...</span>
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <div className={cn(
        "flex items-center gap-2 min-h-[44px] md:min-h-[36px]",
        "px-3 py-2 border border-input rounded-md bg-background",
        "text-sm text-muted-foreground",
        className
      )}>
        <Building2 className="h-4 w-4" />
        <span>No branches available</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Search Input (Optional) */}
      {isSearchMode && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search branches..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 min-h-[44px] md:min-h-[36px]"
            autoFocus
          />
        </div>
      )}

      {/* Branch Selector */}
      <div className="relative">
        <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
        
        <MobileSelect
          value={value}
          onValueChange={handleValueChange}
          options={options}
          placeholder={placeholder}
          disabled={disabled || loading}
          id={id}
          aria-label="Select branch"
          className="w-full"
          triggerClassName={cn(
            "pl-9", // Space for the building icon
            searchQuery && "pr-20" // Space for search button
          )}
          contentClassName="max-h-[60vh] md:max-h-[400px]"
        />

        {/* Search Toggle Button */}
        {!isSearchMode && branches.length > 5 && (
          <button
            type="button"
            onClick={() => setIsSearchMode(true)}
            className={cn(
              "absolute right-8 top-1/2 transform -translate-y-1/2",
              "p-1 rounded hover:bg-accent",
              "text-muted-foreground hover:text-foreground",
              "transition-colors"
            )}
            aria-label="Search branches"
          >
            <Search className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search Results Info */}
      {searchQuery && (
        <div className="text-xs text-muted-foreground">
          {filteredBranches.length} branch{filteredBranches.length !== 1 ? 'es' : ''} found
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setIsSearchMode(false);
              }}
              className="ml-2 text-primary hover:underline"
            >
              Clear search
            </button>
          )}
        </div>
      )}
    </div>
  );
}