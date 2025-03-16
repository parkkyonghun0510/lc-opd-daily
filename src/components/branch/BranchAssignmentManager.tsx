"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Branch {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  path?: string;
  level?: number;
}

interface BranchAssignment {
  id: string;
  branchId: string;
  userId: string;
  isDefault: boolean;
  branch: {
    id: string;
    code: string;
    name: string;
  };
}

interface BranchAssignmentManagerProps {
  userId: string;
}

export function BranchAssignmentManager({
  userId,
}: BranchAssignmentManagerProps) {
  const [assignments, setAssignments] = useState<BranchAssignment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingBranch, setAddingBranch] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  // Fetch user branch assignments and available branches
  useEffect(() => {
    async function fetchAssignments() {
      try {
        const response = await fetch(
          `/api/user-branch-assignments?userId=${userId}`
        );
        if (!response.ok) throw new Error("Failed to fetch branch assignments");

        const data = await response.json();
        // Check if the API returns data directly or nested in a field
        const assignments = Array.isArray(data) ? data : data.data || [];
        setAssignments(assignments);
      } catch (error) {
        console.error("Error fetching branch assignments:", error);
        toast({
          title: "Error",
          description: "Failed to load branch assignments.",
          variant: "destructive",
        });
      }
    }

    async function fetchBranches() {
      try {
        const response = await fetch("/api/branches");
        if (!response.ok) throw new Error("Failed to fetch branches");
        const data = await response.json();
        setBranches(data);
      } catch (error) {
        console.error("Error fetching branches:", error);
        toast({
          title: "Error",
          description: "Failed to load branches.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    setLoading(true);
    Promise.all([fetchAssignments(), fetchBranches()]);
  }, [userId, toast]);

  // Filter branches that are not already assigned
  useEffect(() => {
    const assignedBranchIds = assignments.map((a) => a.branchId);
    const filteredBranches = branches.filter(
      (branch) => !assignedBranchIds.includes(branch.id)
    );
    setAvailableBranches(filteredBranches);
  }, [branches, assignments]);

  // Add a branch assignment
  const addBranchAssignment = async (makeDefault = false) => {
    if (!selectedBranchId) return;

    setAddingBranch(true);
    try {
      const response = await fetch("/api/user-branch-assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          branchId: selectedBranchId,
          isDefault: makeDefault,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to assign branch");
      }

      const data = await response.json();
      // Extract the new assignment from the response, which might be directly returned or nested
      const newAssignment = data.data || data;

      // If this is a default assignment, update our state to reflect this
      if (makeDefault) {
        setAssignments((prev) =>
          prev
            .map((a) => ({
              ...a,
              isDefault: a.id === newAssignment.id,
            }))
            .concat(
              !prev.some((a) => a.id === newAssignment.id)
                ? [newAssignment]
                : []
            )
        );
      } else {
        setAssignments((prev) => [...prev, newAssignment]);
      }

      toast({
        title: "Success",
        description: "Branch assigned successfully.",
      });

      setDialogOpen(false);
      setSelectedBranchId("");
    } catch (error) {
      console.error("Error assigning branch:", error);
      toast({
        title: "Error",
        description: "Failed to assign branch.",
        variant: "destructive",
      });
    } finally {
      setAddingBranch(false);
    }
  };

  // Set a branch assignment as default
  const setDefaultBranchAssignment = async (assignmentId: string) => {
    try {
      const response = await fetch(
        `/api/user-branch-assignments/${assignmentId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isDefault: true,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to set default branch");
      }

      // We don't need the result but we need to wait for the response
      await response.json();

      // Update assignments to reflect the new default
      setAssignments((prev) =>
        prev.map((a) => ({
          ...a,
          isDefault: a.id === assignmentId,
        }))
      );

      toast({
        title: "Success",
        description: "Default branch updated.",
      });
    } catch (error) {
      console.error("Error setting default branch:", error);
      toast({
        title: "Error",
        description: "Failed to update default branch.",
        variant: "destructive",
      });
    }
  };

  // Remove a branch assignment
  const removeBranchAssignment = async (
    assignmentId: string,
    isDefault: boolean
  ) => {
    // Don't allow removing the default assignment
    if (isDefault) {
      toast({
        title: "Error",
        description:
          "Cannot remove default branch assignment. Set another branch as default first.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(
        `/api/user-branch-assignments?id=${assignmentId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to remove branch assignment");
      }

      // Update assignments by removing the deleted one
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));

      toast({
        title: "Success",
        description: "Branch assignment removed.",
      });
    } catch (error) {
      console.error("Error removing branch assignment:", error);
      toast({
        title: "Error",
        description: "Failed to remove branch assignment.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Current Branch Assignments</h3>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Assign Branch
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign Branch</DialogTitle>
                  <DialogDescription>
                    Select a branch to assign to this user.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                      >
                        {selectedBranchId
                          ? branches.find(
                              (branch) => branch.id === selectedBranchId
                            )?.name || "Select branch"
                          : "Select branch"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0">
                      <div className="rounded-md border">
                        <CommandInput placeholder="Search branches..." />
                        <CommandList>
                          {availableBranches.length === 0 ? (
                            <CommandEmpty>No branches found.</CommandEmpty>
                          ) : (
                            <CommandGroup>
                              {availableBranches.map((branch) => (
                                <CommandItem
                                  key={branch.id}
                                  selected={selectedBranchId === branch.id}
                                  onClick={() => setSelectedBranchId(branch.id)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedBranchId === branch.id
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {branch.name} ({branch.code})
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => addBranchAssignment(false)}
                    disabled={!selectedBranchId || addingBranch}
                  >
                    {addingBranch ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Assigning...
                      </>
                    ) : (
                      "Assign Branch"
                    )}
                  </Button>
                  <Button
                    onClick={() => addBranchAssignment(true)}
                    disabled={!selectedBranchId || addingBranch}
                    variant="default"
                  >
                    {addingBranch ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Assigning...
                      </>
                    ) : (
                      <>
                        <Star className="mr-2 h-4 w-4" />
                        Assign as Default
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {assignments.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-md">
              <p className="text-muted-foreground">
                No branch assignments yet. Assign a branch to this user.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Branch Code</TableHead>
                    <TableHead>Branch Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">
                        {assignment.branch.code}
                      </TableCell>
                      <TableCell>{assignment.branch.name}</TableCell>
                      <TableCell>
                        {assignment.isDefault ? (
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                            Default
                          </Badge>
                        ) : (
                          <Badge variant="outline">Assigned</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!assignment.isDefault && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setDefaultBranchAssignment(assignment.id)
                            }
                            title="Set as default branch"
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            removeBranchAssignment(
                              assignment.id,
                              assignment.isDefault
                            )
                          }
                          title="Remove branch assignment"
                          disabled={assignment.isDefault}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
