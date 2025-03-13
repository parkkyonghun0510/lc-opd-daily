"use client";
import React from "react";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserButton } from "@/components/user-button";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  User,
  Menu,
  X,
  ChevronRight,
  Banknote,
} from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      exact: true,
    },
    {
      name: "Reports",
      icon: FileText,
      subItems: [
        { name: "Create New", href: "/reports/create" },
        { name: "Browse All", href: "/reports" },
      ],
    },
    {
      name: "Consolidated",
      href: "/consolidated",
      icon: BarChart3,
    },
    {
      name: "Profile",
      href: "/profile",
      icon: User,
    },
  ];

  const breadcrumbs = pathname
    .split("/")
    .filter((segment) => segment && !segment.startsWith("("))
    .map((segment, index, arr) => ({
      name: segment.replace(/-/g, " "),
      href: "/" + arr.slice(0, index + 1).join("/"),
    }));

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Header */}
      <header className="border-b hidden md:block">
        <div className="container flex h-16 items-center px-4">
          <Link href="/" className="flex items-center space-x-2">
            <Banknote className="h-6 w-6" />
            <span className="text-xl font-bold">Daily Reports</span>
          </Link>
          <nav className="ml-auto flex items-center space-x-4">
            <UserButton />
          </nav>
        </div>
      </header>

      {/* Mobile Navigation */}
      {/* <header className="border-b md:hidden">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="m-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64">
            <nav className="grid gap-2 text-sm">
              {navigation.map((item) => (
                <div key={item.href || item.name} className="space-y-1">
                  {item.subItems ? (
                    <div className="flex flex-col">
                      <div className="flex items-center gap-3 px-3 py-2 text-muted-foreground">
                        <item.icon className="h-4 w-4" />
                        <span className="capitalize">{item.name}</span>
                      </div>
                      {item.subItems.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={cn(
                            "ml-6 flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm",
                            pathname === sub.href
                              ? "text-primary"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <span>{sub.name}</span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <Link
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2",
                        pathname === item.href
                          ? "bg-muted text-primary"
                          : "text-muted-foreground hover:text-primary"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="capitalize">{item.name}</span>
                    </Link>
                  )}
                </div>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </header> */}

      {/* Main Content */}
      <div className="container py-6 px-4">
        <div className="mb-6 flex items-center space-x-1 text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground">
            Home
          </Link>
          {breadcrumbs.map((crumb) => (
            <div key={crumb.href} className="flex items-center">
              <ChevronRight className="h-4 w-4 mx-1" />
              <Link
                href={crumb.href}
                className="capitalize hover:text-foreground"
              >
                {crumb.name}
              </Link>
            </div>
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}
