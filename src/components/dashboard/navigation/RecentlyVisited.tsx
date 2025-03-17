"use client";

import {
  Clock,
  FileText,
  Building2,
  Users,
  Settings,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { useRecentlyVisited } from "@/hooks/useRecentlyVisited";

interface VisitedPage {
  path: string;
  title: string;
  icon: "report" | "branch" | "users" | "settings" | "analytics";
  timestamp: string;
}

export function RecentlyVisited() {
  const router = useRouter();
  const { recentPages } = useRecentlyVisited();

  const getIcon = (type: VisitedPage["icon"]) => {
    switch (type) {
      case "report":
        return <FileText className="h-4 w-4" />;
      case "branch":
        return <Building2 className="h-4 w-4" />;
      case "users":
        return <Users className="h-4 w-4" />;
      case "settings":
        return <Settings className="h-4 w-4" />;
      case "analytics":
        return <BarChart3 className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <Clock className="h-4 w-4 mr-2" />
          Recent Pages
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Recently Visited</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {recentPages.length === 0 ? (
          <div className="py-2 px-2 text-sm text-muted-foreground">
            No recent pages
          </div>
        ) : (
          recentPages.map((page) => (
            <DropdownMenuItem
              key={page.path}
              onClick={() => router.push(page.path)}
              className="flex items-center gap-2"
            >
              {getIcon(page.icon)}
              <span className="flex-1 truncate">{page.title}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(page.timestamp).toLocaleDateString()}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
