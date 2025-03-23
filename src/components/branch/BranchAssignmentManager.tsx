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
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Search, PlusCircle, Check, X, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Branch {
  id: string;
  name: string;
  code: string;
}

interface BranchAssignmentManagerProps {
  userId: string;
}

export function BranchAssignmentManager({ userId }: BranchAssignmentManagerProps) {
  const { toast } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [assignedBranches, setAssignedBranches] = useState<Branch[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
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
        const initialSelectedIds = assignmentsData.map((branch: Branch) => branch.id);
        setSelectedBranchIds(initialSelectedIds);
        
        // Filter out already assigned branches from available branches
        const assignedIds = new Set(initialSelectedIds);
        setAvailableBranches(branchesData.filter((branch: Branch) => !assignedIds.has(branch.id)));
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
  }, [userId, toast]);

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
      
      // Update available branches
      const assignedIds = new Set(updatedAssignments.map((branch: Branch) => branch.id));
      setAvailableBranches(branches.filter((branch: Branch) => !assignedIds.has(branch.id)));

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

  const handleAssignBranch = async () => {
    if (!selectedBranch) return;
    
    try {
      setIsSaving(true);
      
      // Add the selected branch to the selectedBranchIds
      const updatedBranchIds = [...selectedBranchIds, selectedBranch];
      
      const response = await fetch(`/api/users/${userId}/branch-assignments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ branchIds: updatedBranchIds }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to assign branch");
      }

      const updatedAssignments = await response.json();
      setAssignedBranches(updatedAssignments);
      setSelectedBranchIds(updatedAssignments.map((branch: Branch) => branch.id));
      
      // Update available branches
      const assignedIds = new Set(updatedAssignments.map((branch: Branch) => branch.id));
      setAvailableBranches(branches.filter((branch: Branch) => !assignedIds.has(branch.id)));
      
      // Clear selection
      setSelectedBranch("");

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
      setIsSaving(false);
    }
  };

  const handleRemoveBranch = async (branchId: string) => {
    try {
      setIsSaving(true);
      
      // Remove the branch from selectedBranchIds
      const updatedBranchIds = selectedBranchIds.filter(id => id !== branchId);
      
      const response = await fetch(`/api/users/${userId}/branch-assignments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ branchIds: updatedBranchIds }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove branch assignment");
      }

      const updatedAssignments = await response.json();
      setAssignedBranches(updatedAssignments);
      setSelectedBranchIds(updatedAssignments.map((branch: Branch) => branch.id));
      
      // Update available branches
      const assignedIds = new Set(updatedAssignments.map((branch: Branch) => branch.id));
      setAvailableBranches(branches.filter((branch: Branch) => !assignedIds.has(branch.id)));

      toast({
        title: "Success",
        description: "Branch removed successfully",
      });
    } catch (error) {
      console.error("Error removing branch:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove branch",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredAvailableBranches = availableBranches.filter((branch) =>
    branch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    branch.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Assigned Branches</CardTitle>
          <CardDescription>
            Branches this user has access to
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignedBranches.length === 0 ? (
            <div className="text-center py-6 border rounded-md border-dashed border-gray-300 dark:border-gray-600">
              <p className="text-muted-foreground">No branches assigned yet</p>
              <p className="text-sm text-muted-foreground mt-1">Assign branches below</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {assignedBranches.map((branch) => (
                <div 
                  key={branch.id} 
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <div>
                    <p className="font-medium">{branch.name}</p>
                    <Badge variant="outline">{branch.code}</Badge>
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => handleRemoveBranch(branch.id)}
                    disabled={isSaving}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assign New Branch</CardTitle>
          <CardDescription>
            Add branch access for this user
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Select
                  value={selectedBranch}
                  onValueChange={setSelectedBranch}
                  disabled={availableBranches.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a branch to assign" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBranches.length === 0 ? (
                      <div className="p-2 text-center text-sm text-muted-foreground">
                        No more branches available
                      </div>
                    ) : (
                      filteredAvailableBranches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.code} - {branch.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleAssignBranch}
                disabled={!selectedBranch || isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <PlusCircle className="h-4 w-4 mr-2" />
                )}
                Assign Branch
              </Button>
            </div>
            
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search available branches..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center mt-2 text-sm text-muted-foreground">
                    <Info className="h-4 w-4 mr-1" />
                    <span>Branch access explanation</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Users can only access branch data for branches they are assigned to.</p>
                  <p className="mt-1">Admins automatically have access to all branches.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
