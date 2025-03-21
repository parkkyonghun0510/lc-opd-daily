import { useState, useCallback } from "react";
import { toast } from "@/components/ui/use-toast";

interface BranchAccessResult {
  hasAccess: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useBranchAccess() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkBranchAccess = useCallback(async (branchId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/branch-access?branchId=${branchId}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to check branch access");
      }

      const data = await response.json();
      return data.hasAccess;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to check branch access";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    checkBranchAccess,
    isLoading,
    error,
  };
} 