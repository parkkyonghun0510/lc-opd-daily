"use client";

import { SessionProvider } from "next-auth/react";
import { UserDataProvider, useUserData } from "@/contexts/UserDataContext";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ServerErrorBoundary } from "@/components/ui/ServerErrorBoundary";
import { useEffect, lazy, Suspense } from "react";
import { warmCacheAction } from "@/app/_actions/cache-actions";
import { Toaster as SonnerToaster } from "sonner";
import { NotificationProvider } from "@/contexts/NotificationContext";

// Lazy load heavy components
const StoreSynchronizer = lazy(() => import("@/auth/components/StoreSynchronizer").then(m => ({ default: m.StoreSynchronizer })));
const SessionActivityTracker = lazy(() => import("@/auth/components/SessionActivityTracker").then(m => ({ default: m.SessionActivityTracker })));
const ZustandHybridRealtimeProvider = lazy(() => import("@/components/dashboard/ZustandHybridRealtimeProvider").then(m => ({ default: m.ZustandHybridRealtimeProvider })));
const PushNotificationButton = lazy(() => import("@/components/PushNotificationButton").then(m => ({ default: m.PushNotificationButton })));

// Optimized app content with lazy loading
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
      
      {/* Lazy loaded components with fallbacks */}
      <Suspense fallback={null}>
        <div className="fixed bottom-4 right-4 z-50">
          <PushNotificationButton />
        </div>
      </Suspense>
      
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

// Combined provider for better performance
function CombinedProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <UserDataProvider>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </UserDataProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}

// Lazy loaded auth components
function LazyAuthComponents() {
  return (
    <Suspense fallback={null}>
      <StoreSynchronizer
        syncInterval={300} // 5 minutes
        syncOnFocus={true}
        syncOnReconnect={true}
      />
      <SessionActivityTracker
        warningTime={25}
        expiryTime={30}
        checkInterval={30}
      />
    </Suspense>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CombinedProviders>
      <LazyAuthComponents />
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
        <ZustandHybridRealtimeProvider
          debug={process.env.NODE_ENV === 'development'}
          autoRefreshInterval={15000}
          showToasts={true}
        >
          <AppContent>{children}</AppContent>
        </ZustandHybridRealtimeProvider>
      </Suspense>
    </CombinedProviders>
  );
}