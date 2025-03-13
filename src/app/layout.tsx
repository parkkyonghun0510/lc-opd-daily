import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { warmCache } from "@/lib/cache-warmer";
import { Toaster as SonnerToaster } from "sonner";
import { NextAuthProvider } from "@/components/providers/NextAuthProvider";

const inter = Inter({ subsets: ["latin"] });

// Warm the cache when the application starts
warmCache().catch(console.error);

export const metadata: Metadata = {
  title: "Daily Reports System",
  description: "Branch daily reports management system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Warm up the cache
  warmCache();

  return (
    <html lang="en">
      <body className={inter.className}>
        <NextAuthProvider>
          <div className="relative flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
          </div>
          <Toaster />
          <SonnerToaster richColors closeButton position="top-right" />
        </NextAuthProvider>
      </body>
    </html>
  );
}
