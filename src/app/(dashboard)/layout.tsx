"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserButton } from "@/components/user-button";
import { Menu, X } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center px-4">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold">Daily Reports System</span>
          </Link>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </Button>

          {/* Desktop navigation */}
          <nav className="hidden md:flex ml-auto items-center space-x-4">
            <Link href="/reports/create">
              <Button variant="ghost">Create Report</Button>
            </Link>
            <Link href="/reports">
              <Button variant="ghost">View Reports</Button>
            </Link>
            <Link href="/consolidated">
              <Button variant="ghost">Consolidated View</Button>
            </Link>
            <UserButton />
          </nav>
        </div>

        {/* Mobile navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t p-4">
            <nav className="flex flex-col space-y-2">
              <Link
                href="/reports/create"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Button variant="ghost" className="w-full justify-start">
                  Create Report
                </Button>
              </Link>
              <Link href="/reports" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">
                  View Reports
                </Button>
              </Link>
              <Link
                href="/consolidated"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Button variant="ghost" className="w-full justify-start">
                  Consolidated View
                </Button>
              </Link>
              <div className="flex justify-end pt-2">
                <UserButton />
              </div>
            </nav>
          </div>
        )}
      </header>
      <main className="container py-6 px-4">{children}</main>
    </div>
  );
}
