"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Clock, FileText, Building2 } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";

interface SearchResult {
  id: string;
  title: string;
  type: "report" | "branch";
  url: string;
  timestamp?: string;
}

interface RecentSearch {
  query: string;
  timestamp: string;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const commandRef = useRef<HTMLDivElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("recentSearches");
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  // Save recent searches to localStorage
  useEffect(() => {
    if (recentSearches.length > 0) {
      localStorage.setItem("recentSearches", JSON.stringify(recentSearches));
    }
  }, [recentSearches]);

  // Handle keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Handle search
  const handleSearch = async (value: string) => {
    if (!value.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(value)}`,
      );
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle result selection
  const handleSelect = (result: SearchResult) => {
    // Add to recent searches
    setRecentSearches((prev) => {
      const newSearches = [
        { query: result.title, timestamp: new Date().toISOString() },
        ...prev.filter((s) => s.query !== result.title),
      ].slice(0, 5);
      return newSearches;
    });

    // Navigate to result
    router.push(result.url);
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-9 p-0 xl:h-10 xl:w-60 xl:justify-start xl:px-3 xl:py-2"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 xl:mr-2" />
        <span className="hidden xl:inline-flex">
          Search reports, branches...
        </span>
        <span className="sr-only">Search reports, branches...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 xl:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command ref={commandRef} className="rounded-lg border shadow-md">
          <CommandInput
            placeholder="Search reports, branches..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              handleSearch(e.target.value);
            }}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Searching..." : "No results found."}
            </CommandEmpty>
            {results.length > 0 && (
              <CommandGroup className="px-2">
                <div className="px-2 py-1.5 text-sm font-semibold">Results</div>
                {results.map((result) => (
                  <CommandItem
                    key={result.id}
                    onSelect={() => handleSelect(result)}
                    className="flex items-center gap-2"
                  >
                    {result.type === "report" ? (
                      <FileText className="h-4 w-4" />
                    ) : (
                      <Building2 className="h-4 w-4" />
                    )}
                    <span>{result.title}</span>
                    {result.timestamp && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {result.timestamp}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {recentSearches.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup className="px-2">
                  <div className="px-2 py-1.5 text-sm font-semibold">
                    Recent Searches
                  </div>
                  {recentSearches.map((search, index) => (
                    <CommandItem
                      key={index}
                      onSelect={() => {
                        setQuery(search.query);
                        handleSearch(search.query);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Clock className="h-4 w-4" />
                      <span>{search.query}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {new Date(search.timestamp).toLocaleDateString()}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
