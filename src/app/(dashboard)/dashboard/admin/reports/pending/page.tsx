"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AdminPendingReportsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the approvals page
    router.push("/dashboard/approvals");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
      <h2 className="text-lg font-medium">Redirecting to Approvals Page</h2>
      <p className="text-sm text-muted-foreground">
        The report approvals are now managed in a central location.
      </p>
    </div>
  );
} 