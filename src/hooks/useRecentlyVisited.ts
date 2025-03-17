"use client";

import { useEffect, useState } from "react";

interface VisitedPage {
  path: string;
  title: string;
  icon: "report" | "branch" | "users" | "settings" | "analytics";
  timestamp: string;
}

const MAX_RECENT_PAGES = 5;

export function useRecentlyVisited() {
  const [recentPages, setRecentPages] = useState<VisitedPage[]>([]);

  // Load recent pages from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("recentPages");
    if (saved) {
      setRecentPages(JSON.parse(saved));
    }
  }, []);

  // Save recent pages to localStorage
  useEffect(() => {
    if (recentPages.length > 0) {
      localStorage.setItem("recentPages", JSON.stringify(recentPages));
    }
  }, [recentPages]);

  const addPage = (page: Omit<VisitedPage, "timestamp">) => {
    setRecentPages((prev) => {
      const newPages = [
        { ...page, timestamp: new Date().toISOString() },
        ...prev.filter((p) => p.path !== page.path),
      ].slice(0, MAX_RECENT_PAGES);
      return newPages;
    });
  };

  return {
    recentPages,
    addPage,
  };
}
