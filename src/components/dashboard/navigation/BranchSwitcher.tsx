"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserData } from "@/contexts/UserDataContext";
import { toast } from "@/components/ui/use-toast";
import { BranchSelector } from "@/components/ui/branch-selector";

export function BranchSwitcher() {
  const router = useRouter();
  const { userData, refreshUserData } = useUserData();
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (userData?.branch?.id) {
      setSelectedBranch(userData.branch.id);
    }
  }, [userData?.branch?.id]);

  const handleBranchChange = async (branchId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/users/switch-branch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ branchId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to switch branch");
      }

      setSelectedBranch(branchId);
      await refreshUserData();
      router.refresh();
      toast({
        title: "Success",
        description: "Branch switched successfully",
      });
    } catch (error) {
      console.error("Error switching branch:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to switch branch",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!userData) {
    return null;
  }

  return (
    <div className="w-full">
      <BranchSelector
        userId={userData.id}
        value={selectedBranch}
        onChange={handleBranchChange}
        placeholder="Select branch"
        disabled={isLoading}
      />
    </div>
  );
}
