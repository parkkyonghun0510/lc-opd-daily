"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { NextAuthProvider } from "@/components/providers/NextAuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { UserDataProvider, useUserData } from "@/contexts/UserDataContext";
import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";
import { warmCacheAction } from "./_actions/cache-actions";
import { ServerErrorBoundary } from "@/components/ui/ServerErrorBoundary";
import Head from 'next/head';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';

const inter = Inter({ subsets: ["latin"] });

// Separate component to use the useUserData hook
function AppContent({ children }: { children: React.ReactNode }) {
  const { serverError, refreshUserData, persistentError, handleClearAuth } = useUserData();
  
  return (
    <>
      <div className="relative flex min-h-screen flex-col">
        <div className="flex-1">{children}</div>
      </div>
      <ServerErrorBoundary 
        error={serverError} 
        onRetry={refreshUserData}
        persistentError={persistentError}
        onClearSession={handleClearAuth}
      />
      <InstallPrompt />
      <Toaster />
      <SonnerToaster richColors closeButton position="top-right" />
    </>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Warm up the cache on mount
  useEffect(() => {
    warmCacheAction().catch(console.error);
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="application-name" content="LC OPD Daily Report" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LC Report" />
        <meta name="description" content="Daily OPD Report Management System" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#000000" />

        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="shortcut icon" href="/favicon.ico" />
      </head>
      <body className={inter.className}>
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
      </body>
    </html>
  );
}
