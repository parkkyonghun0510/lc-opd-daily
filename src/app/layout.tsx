"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { NextAuthProvider } from "@/components/providers/NextAuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { UserDataProvider } from "@/contexts/UserDataContext";
import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";
import { warmCacheAction } from "./_actions/cache-actions";

const inter = Inter({ subsets: ["latin"] });

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
                <div className="relative flex min-h-screen flex-col">
                  <div className="flex-1">{children}</div>
                </div>
                <Toaster />
                <SonnerToaster richColors closeButton position="top-right" />
              </NextAuthProvider>
            </ThemeProvider>
          </UserDataProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
