"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BranchSelector } from "@/components/ui/branch-selector";
import { Label } from "@/components/ui/label";

interface Branch {
  id: string;
  name: string;
  code: string;
}

interface BranchAssignmentManagerProps {
  userId: string;
}

export function BranchAssignmentManager({ userId }: BranchAssignmentManagerProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [assignedBranches, setAssignedBranches] = useState<Branch[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        // Fetch all branches
        const branchesResponse = await fetch("/api/branches/simple");
        if (!branchesResponse.ok) {
          throw new Error("Failed to fetch branches");
        }
        const branchesData = await branchesResponse.json();
        setBranches(branchesData);

        // Fetch user's assigned branches
        const assignmentsResponse = await fetch(`/api/users/${userId}/branch-assignments`);
        if (!assignmentsResponse.ok) {
          throw new Error("Failed to fetch branch assignments");
        }
        const assignmentsData = await assignmentsResponse.json();
        setAssignedBranches(assignmentsData);
        
        // Set initial selected branch IDs
        setSelectedBranchIds(assignmentsData.map((branch: Branch) => branch.id));
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "Error",
          description: "Failed to load branch data",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const response = await fetch(`/api/users/${userId}/branch-assignments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ branchIds: selectedBranchIds }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update branch assignments");
      }

      const updatedAssignments = await response.json();
      setAssignedBranches(updatedAssignments);

      toast({
        title: "Success",
        description: "Branch assignments updated successfully",
      });
    } catch (error) {
      console.error("Error updating branch assignments:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update branch assignments",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleBranch = (branchId: string) => {
    setSelectedBranchIds((prev) =>
      prev.includes(branchId)
        ? prev.filter((id) => id !== branchId)
        : [...prev, branchId]
    );
  };

  const filteredBranches = branches.filter((branch) =>
    branch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    branch.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAssignBranch = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/users/${userId}/branch-assignments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ branchIds: [selectedBranch] }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to assign branch");
      }

      const updatedAssignments = await response.json();
      setAssignedBranches(updatedAssignments);

      toast({
        title: "Success",
        description: "Branch assigned successfully",
      });
    } catch (error) {
      console.error("Error assigning branch:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to assign branch",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Label>Assign Branch</Label>
          <BranchSelector
            userId={userId}
            value={selectedBranch}
            onChange={setSelectedBranch}
            placeholder="Select branch to assign"
          />
        </div>
        <Button
          onClick={handleAssignBranch}
          disabled={!selectedBranch || isLoading}
          className="mt-6"
        >
          {isLoading ? "Assigning..." : "Assign Branch"}
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search branches..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Assignments
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Assign</TableHead>
              <TableHead>Branch Name</TableHead>
              <TableHead>Code</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBranches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                  {searchQuery ? "No branches match your search" : "No branches found"}
                </TableCell>
              </TableRow>
            ) : (
              filteredBranches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedBranchIds.includes(branch.id)}
                      onCheckedChange={() => toggleBranch(branch.id)}
                    />
                  </TableCell>
                  <TableCell>{branch.name}</TableCell>
                  <TableCell>{branch.code}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
