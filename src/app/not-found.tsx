"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function NotFound() {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "loading") return;

    const callbackUrl = encodeURIComponent(pathname);
    const redirectUrl = status === "unauthenticated" 
      ? `/login?callbackUrl=${callbackUrl}`
      : "/dashboard";
    
    router.replace(redirectUrl);
  }, [status, router, pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      <p className="text-sm text-gray-500">Redirecting...</p>
    </div>
  );
}