"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
  const { data: session, status } = useSession();
  const router = useRouter();

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

      const response = await fetch(`/api/branches?${queryParams.toString()}`, {
        credentials: "include",
      });

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
        credentials: "include",
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
        credentials: "include",
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
        credentials: "include",
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

  // Handle page change
  const handlePageChange = (page: number) => {
    fetchBranches(page);
  };

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && session?.user?.role !== "ADMIN") {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  // Initial data load - only if admin
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "ADMIN") {
      fetchBranches();
    }
  }, [status, session]);

  // Handle filter changes - only if admin
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "ADMIN") {
      fetchBranches(1); // Reset to first page on filter change
    }
  }, [search, activeFilter, status, session]);

  // Show loading state while checking auth
  if (status === "loading") {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Don't render if not admin
  if (status !== "authenticated" || session?.user?.role !== "ADMIN") {
    return null;
  }

  return (
    <div className="container px-2 sm:px-4 py-4 sm:py-8 mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Branch Management</h1>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" /> Add New Branch
        </Button>
      </div>

      <Card className="mb-8 overflow-hidden">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle>Branches</CardTitle>
          <CardDescription>
            Manage branch locations and their operational status
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3 mb-4 sm:mb-6">
            <div className="relative flex-grow">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search branches..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Select
              value={activeFilter}
              onValueChange={(value) => setActiveFilter(value)}
            >
              <SelectTrigger className="w-full md:w-[180px]">
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
            <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-md mb-4 text-sm">
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
              {/* Branch table - desktop view */}
              <div className="rounded-md border overflow-auto hidden md:block">
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
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branches.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          No branches found
                        <span className="text-muted-foreground">N/A</span>
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
                              {(branch._count?.children ?? 0) > 0 ? (
                                <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
                                  {branch._count?.children ?? 0} Sub-branches
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
                              {branch._count?.users ?? 0}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="flex items-center"
                            >
                              <FileText className="mr-1 h-3 w-3" />{" "}
                              {branch._count?.reports ?? 0}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
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
                                  (branch._count?.users ?? 0) > 0 ||
                                  (branch._count?.reports ?? 0) > 0 ||
                                  (branch._count?.children ?? 0) > 0
                                }
                                title={
                                  (branch._count?.users ?? 0) > 0 ||
                                  (branch._count?.reports ?? 0) > 0 ||
                                  (branch._count?.children ?? 0) > 0
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

              {/* Mobile card view for branches */}
              <div className="space-y-4 md:hidden">
                {branches.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No branches found
                  </div>
                ) : (
                  branches.map((branch) => (
                    <Card key={branch.id} className="overflow-hidden">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              <span>{branch.code}</span>
                              {branch.isActive ? (
                                <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-xs">
                                  Inactive
                                </Badge>
                              )}
                            </CardTitle>
                            <CardDescription className="text-sm mt-1">
                              {branch.name}
                            </CardDescription>
                          </div>
                          console.log('Branch debug:', branch);
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => openEditDialog(branch)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => openDeleteDialog(branch)}
                              disabled={
                                (branch._count?.users ?? 0) > 0 ||
                                (branch._count?.reports ?? 0) > 0 ||
                                (branch._count?.children ?? 0) > 0
                              }
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Parent</p>
                            <p>
                              {branch.parent 
                                ? `${branch.parent.code} - ${branch.parent.name}`
                                : "None"
                              }
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Type</p>
                            <p>
                              {(branch._count?.children ?? 0) > 0
                                ? `${branch._count?.children} Sub-branches`
                                : branch.parentId
                                ? "Sub-branch"
                                : "Main Branch"
                              }
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Users</p>
                            <p className="flex items-center">
                              <Users className="mr-1 h-3 w-3" />
                              {branch._count?.users ?? 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Reports</p>
                            <p className="flex items-center">
                              <FileText className="mr-1 h-3 w-3" />
                              {branch._count?.reports ?? 0}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
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
        <DialogContent className="sm:max-w-[500px] w-[calc(100%-32px)] p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
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
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="code" className="sm:text-right">
                Branch Code
              </Label>
              <div className="sm:col-span-3">
                <Input
                  id="code"
                  name="code"
                  placeholder="01-PRH"
                  value={formData.code}
                  onChange={handleInputChange}
                  disabled={formSubmitting}
                  autoCapitalize="characters"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Code must contain only uppercase letters and numbers
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="name" className="sm:text-right">
                Branch Name
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="Main Branch"
                className="sm:col-span-3"
                value={formData.name}
                onChange={handleInputChange}
                disabled={formSubmitting}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="parentId" className="sm:text-right">
                Parent Branch
              </Label>
              <div className="sm:col-span-3">
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

            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="isActive" className="sm:text-right">
                Active
              </Label>
              <div className="flex items-center space-x-2 sm:col-span-3">
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

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={formSubmitting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              onClick={createBranch} 
              disabled={formSubmitting}
              className="w-full sm:w-auto"
            >
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

      {/* Edit Branch Dialog - use the same mobile optimizations as for Create dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] w-[calc(100%-32px)] p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
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
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="code" className="sm:text-right">
                Branch Code
              </Label>
              <div className="sm:col-span-3">
                <Input
                  id="code"
                  name="code"
                  placeholder="BR01"
                  value={formData.code}
                  onChange={handleInputChange}
                  disabled={formSubmitting}
                  autoCapitalize="characters"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Code must contain only uppercase letters and numbers
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="name" className="sm:text-right">
                Branch Name
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="Main Branch"
                className="sm:col-span-3"
                value={formData.name}
                onChange={handleInputChange}
                disabled={formSubmitting}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="parentId" className="sm:text-right">
                Parent Branch
              </Label>
              <div className="sm:col-span-3">
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

            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="isActive" className="sm:text-right">
                Active
              </Label>
              <div className="flex items-center space-x-2 sm:col-span-3">
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

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={formSubmitting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              onClick={updateBranch} 
              disabled={formSubmitting}
              className="w-full sm:w-auto"
            >
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
        <AlertDialogContent className="w-[calc(100%-32px)] p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the branch &quot;
              {selectedBranch?.code} - {selectedBranch?.name}&quot;? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={deleteBranch}
              className="w-full sm:w-auto"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
