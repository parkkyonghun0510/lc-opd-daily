"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useBeforeUnload(
  shouldConfirm: boolean,
  message: string = "You have unsaved changes. Are you sure you want to leave?"
) {
  const router = useRouter();

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (shouldConfirm) {
        e.preventDefault();
        e.returnValue = message;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [shouldConfirm, message]);

  useEffect(() => {
    const handleRouteChange = () => {
      if (shouldConfirm) {
        if (!window.confirm(message)) {
          router.back();
        }
      }
    };

    window.addEventListener("popstate", handleRouteChange);
    return () => window.removeEventListener("popstate", handleRouteChange);
  }, [shouldConfirm, message, router]);
}
