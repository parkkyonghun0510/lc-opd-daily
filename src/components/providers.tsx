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
import { NotificationProvider } from "@/contexts/NotificationContext";

// Import new auth components
import { StoreSynchronizer } from "@/auth/components/StoreSynchronizer";
import { SessionActivityTracker } from "@/auth/components/SessionActivityTracker";

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
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {/* Authentication state synchronization */}
        <StoreSynchronizer
          syncInterval={300} // 5 minutes
          syncOnFocus={true}
          syncOnReconnect={true}
        />

        {/* Session activity tracking */}
        <SessionActivityTracker
          warningTime={25}
          expiryTime={30}
          checkInterval={30}
        />

        <UserDataProvider>
          <NotificationProvider>
            <NextAuthProvider>
              <AppContent>{children}</AppContent>
            </NextAuthProvider>
          </NotificationProvider>
        </UserDataProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}