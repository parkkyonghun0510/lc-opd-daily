"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import BranchHierarchy from "@/components/branch-hierarchy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Search,
  Edit,
  Trash,
  Plus,
  Check,
  X,
  Users,
  FileText,
} from "lucide-react";

type Branch = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  parentId: string | null;
  parent?: {
    id: string;
    code: string;
    name: string;
  } | null;
  children?: {
    id: string;
    code: string;
    name: string;
  }[];
  createdAt: string;
  updatedAt: string;
  _count: {
    users: number;
    reports: number;
    children: number;
  };
};

type Meta = {
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export default function BranchesPage() {
  // State for branch list and pagination
  const [branches, setBranches] = useState<Branch[]>([]);
  const [meta, setMeta] = useState<Meta>({
    total: 0,
    page: 1,
    limit: 10,
    pages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for filters
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  // State for dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  // State for form inputs
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    isActive: true,
    parentId: null as string | null,
  });

  // State for operation status
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch branches based on filters and pagination
  const fetchBranches = async (page = 1) => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      queryParams.append("page", page.toString());
      queryParams.append("limit", meta.limit.toString());

      if (search) queryParams.append("search", search);
      if (activeFilter !== "all")
        queryParams.append(
          "active",
          activeFilter === "active" ? "true" : "false"
        );

      const response = await fetch(`/api/branches?${queryParams.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch branches");
      }

      const data = await response.json();
      setBranches(data.branches || data);

      if (data.meta) {
        setMeta(data.meta);
      }
    } catch (err) {
      console.error("Error fetching branches:", err);
      setError("Failed to load branches. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    fetchBranches();
  }, []);

  // Handle filter changes
  useEffect(() => {
    fetchBranches(1); // Reset to first page on filter change
  }, [search, activeFilter]);

  // Handle page change
  const handlePageChange = (page: number) => {
    fetchBranches(page);
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Handle checkbox changes
  const handleCheckboxChange = (name: string, checked: boolean) => {
    setFormData({ ...formData, [name]: checked });
  };

  // Reset form data
  const resetFormData = () => {
    setFormData({
      code: "",
      name: "",
      isActive: true,
      parentId: null,
    });
  };

  // Open create dialog
  const openCreateDialog = () => {
    resetFormData();
    setFormError(null);
    setCreateDialogOpen(true);
  };

  // Open edit dialog
  const openEditDialog = (branch: Branch) => {
    setSelectedBranch(branch);
    setFormData({
      code: branch.code,
      name: branch.name,
      isActive: branch.isActive,
      parentId: branch.parentId || null,
    });
    setFormError(null);
    setEditDialogOpen(true);
  };

  // Open delete dialog
  const openDeleteDialog = (branch: Branch) => {
    setSelectedBranch(branch);
    setDeleteDialogOpen(true);
  };

  // Create branch
  const createBranch = async () => {
    setFormSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch("/api/branches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            (data.details
              ? data.details[0]?.message
              : "Failed to create branch")
        );
      }

      // Refresh branch list
      fetchBranches();
      setCreateDialogOpen(false);
      resetFormData();
    } catch (err) {
      console.error("Error creating branch:", err);
      setFormError(
        err instanceof Error ? err.message : "Failed to create branch"
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  // Update branch
  const updateBranch = async () => {
    if (!selectedBranch) return;

    setFormSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch("/api/branches", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selectedBranch.id,
          ...formData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            (data.details
              ? data.details[0]?.message
              : "Failed to update branch")
        );
      }

      // Refresh branch list
      fetchBranches();
      setEditDialogOpen(false);
      resetFormData();
    } catch (err) {
      console.error("Error updating branch:", err);
      setFormError(
        err instanceof Error ? err.message : "Failed to update branch"
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete branch
  const deleteBranch = async () => {
    if (!selectedBranch) return;

    try {
      const response = await fetch(`/api/branches?id=${selectedBranch.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete branch");
      }

      // Refresh branch list
      fetchBranches();
      setDeleteDialogOpen(false);
    } catch (err) {
      console.error("Error deleting branch:", err);
      alert(err instanceof Error ? err.message : "Failed to delete branch");
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Branch Management</h1>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" /> Add New Branch
        </Button>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Branches</CardTitle>
          <CardDescription>
            Manage branch locations and their operational status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-grow">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search branches by code or name..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Select
              value={activeFilter}
              onValueChange={(value) => setActiveFilter(value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md mb-4">
              {error}
            </div>
          )}

          {/* Loading indicator */}
          {loading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Branch table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Parent Branch</TableHead>
                      <TableHead>Hierarchy</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Reports</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branches.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          No branches found
                        </TableCell>
                      </TableRow>
                    ) : (
                      branches.map((branch) => (
                        <TableRow key={branch.id}>
                          <TableCell className="font-medium">
                            {branch.code}
                          </TableCell>
                          <TableCell>{branch.name}</TableCell>
                          <TableCell>
                            {branch.parent ? (
                              <span className="text-sm">
                                {branch.parent.code} - {branch.parent.name}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">None</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {branch._count.children > 0 ? (
                                <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
                                  {branch._count.children} Sub-branches
                                </Badge>
                              ) : branch.parentId ? (
                                <Badge variant="outline" className="bg-gray-50 text-gray-800 border-gray-200">
                                  Sub-branch
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-200">
                                  Main Branch
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {branch.isActive ? (
                              <Badge
                                variant="secondary"
                                className="bg-green-100 text-green-800 border-green-200"
                              >
                                <Check className="mr-1 h-3 w-3" /> Active
                              </Badge>
                            ) : (
                              <Badge
                                variant="destructive"
                                className="bg-red-100 text-red-800 border-red-200"
                              >
                                <X className="mr-1 h-3 w-3" /> Inactive
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="flex items-center"
                            >
                              <Users className="mr-1 h-3 w-3" />{" "}
                              {branch._count.users}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="flex items-center"
                            >
                              <FileText className="mr-1 h-3 w-3" />{" "}
                              {branch._count.reports}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(branch)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openDeleteDialog(branch)}
                                disabled={
                                  branch._count.users > 0 ||
                                  branch._count.reports > 0 ||
                                  branch._count.children > 0
                                }
                                title={
                                  branch._count.users > 0 ||
                                  branch._count.reports > 0 ||
                                  branch._count.children > 0
                                    ? "Cannot delete branch with associated users, reports, or sub-branches"
                                    : "Delete branch"
                                }
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {meta.pages > 1 && (
                <div className="flex justify-center mt-4">
                  <Pagination
                    currentPage={meta.page}
                    totalPages={meta.pages}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Branch Hierarchy Visualization */}
      <div className="mb-8">
        <BranchHierarchy />
      </div>

      {/* Create Branch Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Branch</DialogTitle>
            <DialogDescription>
              Add a new branch office location to the system. Branch code must
              be unique.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-md text-sm">
              {formError}
            </div>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="code" className="text-right">
                Branch Code
              </Label>
              <Input
                id="code"
                name="code"
                placeholder="BR01"
                className="col-span-3"
                value={formData.code}
                onChange={handleInputChange}
                disabled={formSubmitting}
                autoCapitalize="characters"
              />
              <div className="col-span-3 col-start-2 text-xs text-muted-foreground">
                Code must contain only uppercase letters and numbers
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Branch Name
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="Main Branch"
                className="col-span-3"
                value={formData.name}
                onChange={handleInputChange}
                disabled={formSubmitting}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="parentId" className="text-right">
                Parent Branch
              </Label>
              <div className="col-span-3">
                <Select
                  value={formData.parentId || "none"}
                  onValueChange={(value) => {
                    setFormData({
                      ...formData,
                      parentId: value === "none" ? null : value,
                    });
                  }}
                  disabled={formSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a parent branch (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {branches
                      .filter((b) => b.id !== selectedBranch?.id) // Prevent selecting self as parent
                      .map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.code} - {branch.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="isActive" className="text-right">
                Active
              </Label>
              <div className="flex items-center space-x-2 col-span-3">
                <Checkbox
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange("isActive", checked === true)
                  }
                  disabled={formSubmitting}
                />
                <label
                  htmlFor="isActive"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Branch is active
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={createBranch} disabled={formSubmitting}>
              {formSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                </>
              ) : (
                "Create Branch"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Branch Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Branch</DialogTitle>
            <DialogDescription>
              Update branch information. Branch code must be unique.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-md text-sm">
              {formError}
            </div>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="code" className="text-right">
                Branch Code
              </Label>
              <Input
                id="code"
                name="code"
                placeholder="BR01"
                className="col-span-3"
                value={formData.code}
                onChange={handleInputChange}
                disabled={formSubmitting}
                autoCapitalize="characters"
              />
              <div className="col-span-3 col-start-2 text-xs text-muted-foreground">
                Code must contain only uppercase letters and numbers
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Branch Name
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="Main Branch"
                className="col-span-3"
                value={formData.name}
                onChange={handleInputChange}
                disabled={formSubmitting}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="parentId" className="text-right">
                Parent Branch
              </Label>
              <div className="col-span-3">
                <Select
                  value={formData.parentId || "none"}
                  onValueChange={(value) => {
                    setFormData({
                      ...formData,
                      parentId: value === "none" ? null : value,
                    });
                  }}
                  disabled={formSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a parent branch (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {branches
                      .filter((b) => b.id !== selectedBranch?.id) // Prevent selecting self as parent
                      .map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.code} - {branch.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="isActive" className="text-right">
                Active
              </Label>
              <div className="flex items-center space-x-2 col-span-3">
                <Checkbox
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange("isActive", checked === true)
                  }
                  disabled={formSubmitting}
                />
                <label
                  htmlFor="isActive"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Branch is active
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={updateBranch} disabled={formSubmitting}>
              {formSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...
                </>
              ) : (
                "Update Branch"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Branch Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the branch &quot;
              {selectedBranch?.code} - {selectedBranch?.name}&quot;? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteBranch}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
