import { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | LC Help Desk Reports",
    default: "LC Help Desk Reports - Daily Management System",
  },
  description:
    "LC Help Desk professional daily reporting system for OPD management and tracking",
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
    title: "LC Help Desk Reports",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  keywords: [
    "LC Help Desk",
    "OPD Reports",
    "Daily Reports",
    "Medical Reports",
    "Healthcare Management",
    "Patient Tracking",
  ],
  authors: [{ name: "LC Help Desk Team" }],
  creator: "LC Help Desk",
  publisher: "LC Help Desk",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://reports.lchelpdesk.com/",
    title: "LC Help Desk Reports",
    description:
      "Professional daily reporting system for LC OPD management and tracking",
    siteName: "LC Help Desk Reports",
    images: [
      {
        url: "/screenshots/home.png",
        width: 1080,
        height: 1920,
        alt: "LC Help Desk Reports Home Screen",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LC Help Desk Reports",
    description:
      "Professional daily reporting system for LC OPD management and tracking",
    images: ["/screenshots/home.png"],
    creator: "@lchelpdesk",
    site: "@lchelpdesk",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "verification_token_if_you_have_one",
  },
};
