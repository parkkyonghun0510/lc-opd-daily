"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Building2, Loader2, Search } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

interface Branch {
  id: string;
  name: string;
  code: string;
}

interface BranchSelectorProps {
  userId: string;
  value?: string;
  onChange?: (branchId: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  showAllOption?: boolean;
}

export function BranchSelector({
  userId,
  value,
  onChange,
  placeholder = "Select branch",
  className = "",
  disabled = false,
  id,
  showAllOption = false,
}: BranchSelectorProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter branches based on search query
  const filteredBranches = useMemo(() => {
    if (!searchQuery) return branches;

    const query = searchQuery.toLowerCase();
    return branches.filter(
      (branch) =>
        branch.name.toLowerCase().includes(query) ||
        branch.code.toLowerCase().includes(query),
    );
  }, [branches, searchQuery]);

  useEffect(() => {
    const fetchUserBranches = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/users/${userId}/branches`);
        if (!response.ok) throw new Error("Failed to fetch user branches");
        const data = await response.json();
        setBranches(data.branches || []);
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
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">
          Loading branches...
        </span>
      </div>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled || loading || branches.length === 0}
    >
      <SelectTrigger className={`w-full ${className}`} id={id}>
        <Building2 className="h-4 w-4 mr-2" />
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        className="z-[100] min-w-[200px] w-[var(--radix-select-trigger-width)] max-w-[min(calc(100vw-2rem),400px)]"
        position="popper"
        sideOffset={4}
      >
        <div className="sticky top-0 bg-popover border-b">
          <div className="flex items-center px-3 py-3">
            <Search className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
            <Input
              placeholder="Search branches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 px-3"
            />
          </div>
        </div>
        {showAllOption && (
          <SelectItem key="all-branches" value="">
            All My Branches
          </SelectItem>
        )}
        {filteredBranches.length > 0 ? (
          filteredBranches.map((branch) => (
            <SelectItem
              key={branch.id}
              id={branch.id}
              value={branch.id}
              className="py-3 px-3"
            >
              <span className="block truncate">
                {branch.name} ({branch.code})
              </span>
            </SelectItem>
          ))
        ) : (
          <SelectItem value="no-results" disabled>
            {searchQuery
              ? "No matching branches found"
              : "No branches available"}
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
