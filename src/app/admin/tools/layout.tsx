import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Tools | LC Reports",
  description: "Administrative tools for system maintenance",
};

export default function AdminToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
