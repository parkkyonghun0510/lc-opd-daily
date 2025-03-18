"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { History, Save, Trash2, RotateCcw, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useFilterState } from "@/hooks/useFilterState";

interface FilterManagerProps {
  storageKey: string;
  initialState: Record<string, string | number | boolean | null | undefined>;
  children: React.ReactNode;
  className?: string;
}

export function FilterManager({
  storageKey,
  initialState,
  children,
  className,
}: FilterManagerProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [newFilterName, setNewFilterName] = useState("");

  const {
    resetFilters,
    filterHistory,
    saveToHistory,
    loadFromHistory,
    deleteFromHistory,
  } = useFilterState(initialState, storageKey);

  const handleSaveFilter = () => {
    if (newFilterName.trim()) {
      saveToHistory(newFilterName.trim());
      setNewFilterName("");
      setIsSaving(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Filters
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <History className="h-4 w-4" />
                Saved Filters
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Saved Filters</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {filterHistory.length === 0 ? (
                <div className="py-2 px-2 text-sm text-muted-foreground">
                  No saved filters
                </div>
              ) : (
                filterHistory.map((filter) => (
                  <div key={filter.id} className="flex items-center gap-2">
                    <DropdownMenuItem
                      className="flex-1"
                      onClick={() => loadFromHistory(filter.id)}
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      {filter.name}
                    </DropdownMenuItem>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => deleteFromHistory(filter.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
              <DropdownMenuSeparator />
              {isSaving ? (
                <div className="p-2">
                  <Input
                    value={newFilterName}
                    onChange={(e) => setNewFilterName(e.target.value)}
                    placeholder="Filter name"
                    className="mb-2"
                  />
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={handleSaveFilter}
                  >
                    Save
                  </Button>
                </div>
              ) : (
                <DropdownMenuItem onClick={() => setIsSaving(true)}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Current Filters
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {children}
    </div>
  );
}
