"use client";

import { SessionProvider } from "next-auth/react";
import { UserDataProvider, useUserData } from "@/contexts/UserDataContext";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { NextAuthProvider } from "@/components/providers/NextAuthProvider";
import { ServerErrorBoundary } from "@/components/ui/ServerErrorBoundary";
import { useEffect } from "react";
import { warmCacheAction } from "@/app/_actions/cache-actions";
import { Toaster as SonnerToaster } from "sonner";
import { PushNotificationButton } from "@/components/PushNotificationButton";

// Separate component to use the useUserData hook
function AppContent({ children }: { children: React.ReactNode }) {
  const { serverError, refreshUserData, persistentError, handleClearAuth } = useUserData();
  
  // Warm up the cache on mount
  useEffect(() => {
    warmCacheAction().catch(console.error);
  }, []);
  
  return (
    <>
      <div className="relative flex min-h-screen flex-col">
        <div className="flex-1">{children}</div>
      </div>
      <div className="fixed bottom-4 right-4 z-50">
        <PushNotificationButton />
      </div>
      <ServerErrorBoundary 
        error={serverError} 
        onRetry={refreshUserData}
        persistentError={persistentError}
        onClearSession={handleClearAuth}
      />
      <SonnerToaster richColors closeButton position="top-right" />
    </>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <UserDataProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextAuthProvider>
            <AppContent>{children}</AppContent>
          </NextAuthProvider>
        </ThemeProvider>
      </UserDataProvider>
    </SessionProvider>
  );
} 