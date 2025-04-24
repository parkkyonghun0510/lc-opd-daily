import { useEffect, useState } from "react";
import { Branch } from "@/types/reports";

/**
 * Custom hook to fetch all branches accessible to the current user.
 * Returns a loading state, error, and the list of branches.
 */
export const useAccessibleBranches = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch("/api/branches?accessible=1")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch accessible branches");
        const data = await res.json();
        if (mounted) setBranches(data);
      })
      .catch((err) => {
        if (mounted) setError(err.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  return { branches, loading, error };
};
