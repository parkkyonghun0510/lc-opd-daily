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
}

export function BranchSelector({
  userId,
  value,
  onChange,
  placeholder = "Select branch",
  className = "",
  disabled = false,
  id,
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
        branch.code.toLowerCase().includes(query)
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
        <span className="text-sm text-muted-foreground">Loading branches...</span>
      </div>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled || loading || branches.length === 0}
    >
      <SelectTrigger className={className} id={id}>
        <Building2 className="h-4 w-4 mr-2" />
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <div className="flex items-center px-2 pb-2">
          <Search className="h-4 w-4 mr-2 text-muted-foreground" />
          <Input
            placeholder="Search branches..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
          />
        </div>
        {filteredBranches.length > 0 ? (
          filteredBranches.map((branch) => (
            <SelectItem key={branch.id} id={branch.id} value={branch.id}>
              {branch.name} ({branch.code})
            </SelectItem>
          ))
        ) : (
          <SelectItem value="no-results" disabled>
            {searchQuery ? "No matching branches found" : "No branches available"}
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
} 