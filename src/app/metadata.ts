import { Metadata } from "next";

export const metadata: Metadata = {
  title: "LC OPD Daily Report",
  description: "Daily report management system for LC OPD",
  manifest: "/manifest.json",
  themeColor: "#1a1a1a",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LC OPD Daily Report",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://reports.lchelpdesk.com/",
    title: "LC OPD Daily Report",
    description: "Daily report management system for LC OPD",
    siteName: "LC OPD Daily Report",
    images: [
      {
        url: "/screenshots/home.png",
        width: 1080,
        height: 1920,
        alt: "LC OPD Daily Report Home Screen",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LC OPD Daily Report",
    description: "Daily report management system for LC OPD",
    images: ["/screenshots/home.png"],
  },
};
