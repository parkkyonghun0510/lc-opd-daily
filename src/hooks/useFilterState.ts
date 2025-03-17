"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface FilterState {
  [key: string]: string | number | boolean | null | undefined;
}

interface FilterHistory {
  id: string;
  name: string;
  filters: FilterState;
  timestamp: string;
}

const MAX_HISTORY_ITEMS = 5;

export function useFilterState(
  initialState: FilterState,
  storageKey: string,
  options: {
    syncWithUrl?: boolean;
    persistInStorage?: boolean;
    enableHistory?: boolean;
  } = {
    syncWithUrl: true,
    persistInStorage: true,
    enableHistory: true,
  }
) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FilterState>(initialState);
  const [filterHistory, setFilterHistory] = useState<FilterHistory[]>([]);

  // Load filters from localStorage
  useEffect(() => {
    if (options.persistInStorage) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setFilters(JSON.parse(saved));
      }
    }
  }, [storageKey, options.persistInStorage]);

  // Load filter history from localStorage
  useEffect(() => {
    if (options.enableHistory) {
      const saved = localStorage.getItem(`${storageKey}_history`);
      if (saved) {
        setFilterHistory(JSON.parse(saved));
      }
    }
  }, [storageKey, options.enableHistory]);

  // Save filters to localStorage
  useEffect(() => {
    if (options.persistInStorage) {
      localStorage.setItem(storageKey, JSON.stringify(filters));
    }
  }, [filters, storageKey, options.persistInStorage]);

  // Save filter history to localStorage
  useEffect(() => {
    if (options.enableHistory && filterHistory.length > 0) {
      localStorage.setItem(
        `${storageKey}_history`,
        JSON.stringify(filterHistory)
      );
    }
  }, [filterHistory, storageKey, options.enableHistory]);

  // Sync with URL
  useEffect(() => {
    if (options.syncWithUrl) {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.set(key, String(value));
        } else {
          params.delete(key);
        }
      });
      const newUrl = params.toString() ? `?${params.toString()}` : "";
      router.push(newUrl, { scroll: false });
    }
  }, [filters, router, searchParams, options.syncWithUrl]);

  // Load from URL
  useEffect(() => {
    if (options.syncWithUrl) {
      const params = new URLSearchParams(searchParams.toString());
      const urlFilters: FilterState = {};
      Object.entries(initialState).forEach(([key]) => {
        const value = params.get(key);
        if (value !== null) {
          urlFilters[key] = value;
        }
      });
      if (Object.keys(urlFilters).length > 0) {
        setFilters((prev) => ({ ...prev, ...urlFilters }));
      }
    }
  }, [searchParams, initialState, options.syncWithUrl]);

  const updateFilters = (newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFilters(initialState);
  };

  const saveToHistory = (name: string) => {
    if (options.enableHistory) {
      setFilterHistory((prev) => {
        const newHistory = [
          {
            id: crypto.randomUUID(),
            name,
            filters,
            timestamp: new Date().toISOString(),
          },
          ...prev.filter(
            (h) => JSON.stringify(h.filters) !== JSON.stringify(filters)
          ),
        ].slice(0, MAX_HISTORY_ITEMS);
        return newHistory;
      });
    }
  };

  const loadFromHistory = (id: string) => {
    const saved = filterHistory.find((h) => h.id === id);
    if (saved) {
      setFilters(saved.filters);
    }
  };

  const deleteFromHistory = (id: string) => {
    setFilterHistory((prev) => prev.filter((h) => h.id !== id));
  };

  return {
    filters,
    updateFilters,
    resetFilters,
    filterHistory,
    saveToHistory,
    loadFromHistory,
    deleteFromHistory,
  };
}
