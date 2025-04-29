"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { NotificationPrompt } from "@/components/pwa/NotificationPrompt";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { metadata } from "./metadata";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1a1a1a" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LC Help Desk Reports" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="LC Help Desk Reports" />
        <meta name="robots" content="index, follow" />
        <meta name="googlebot" content="index, follow" />
        <meta property="og:site_name" content="LC Help Desk Reports" />
        <meta name="author" content="LC Help Desk Team" />
        
        {/* Structured data for organization */}
        <Script id="structured-data" type="application/ld+json">
          {`
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "LC Help Desk",
              "url": "https://reports.lchelpdesk.com",
              "logo": "https://reports.lchelpdesk.com/lc-logo.png",
              "description": "Professional daily reporting system for LC OPD management and tracking"
            }
          `}
        </Script>
      </head>
      <body className={inter.className} suppressHydrationWarning={true}>
        <Providers>
          {children}
          <Toaster />
          <InstallPrompt />
          <NotificationPrompt />
          <ServiceWorkerRegistration />
        </Providers>
      </body>
    </html>
  );
}
