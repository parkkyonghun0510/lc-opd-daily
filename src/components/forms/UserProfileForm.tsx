// src/components/forms/UserProfileForm.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { UserRole } from "@/lib/auth/roles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { BranchSelector } from "@/components/ui/branch-selector";
import { Label } from "@/components/ui/label";
import { useUserData } from "@/contexts/UserDataContext";

interface Branch {
  id: string;
  name: string;
  code: string;
}

const profileFormSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required"),
  branchId: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface UserProfileFormProps {
  user: {
    id: string;
    username: string;
    email: string;
    name: string;
    branchId?: string | null;
  };
}

export default function UserProfileForm({ user }: UserProfileFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const { can, role } = usePermissions();

  const isAdmin = role === UserRole.ADMIN;

  useEffect(() => {
    if (isAdmin) {
      const fetchBranches = async () => {
        try {
          setLoadingBranches(true);
          const response = await fetch("/api/branches/simple");
          if (!response.ok) {
            throw new Error("Failed to fetch branches");
          }
          const data = await response.json();
          setBranches(data);
        } catch (error) {
          console.error("Error fetching branches:", error);
          toast({
            title: "Error",
            description: "Failed to load branches",
            variant: "destructive",
          });
        } finally {
          setLoadingBranches(false);
        }
      };

      fetchBranches();
    }
  }, [isAdmin]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      username: user.username,
      email: user.email,
      name: user.name,
      branchId: user.branchId || undefined,
    },
  });

  const onSubmit = async (data: ProfileFormValues) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/users/${user.id}/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update profile");
      }

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });

      // Refresh the page to show updated data
      window.location.reload();
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isAdmin && (
          <FormField
            control={form.control}
            name="branchId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Primary Branch</FormLabel>
                <BranchSelector
                  userId={user.id}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select branch"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  The primary branch this user belongs to.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Updating..." : "Update Profile"}
        </Button>
      </form>
    </FormProvider>
  );
}
