import { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Manage users, roles, branches, and system settings",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
