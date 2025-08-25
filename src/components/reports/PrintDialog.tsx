"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type PrintOptions = {
  includeAnalytics: boolean;
  includeComments: boolean;
};

export function PrintDialog({
  onPrint,
  disabled,
}: {
  onPrint: (options: PrintOptions) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<PrintOptions>({
    includeAnalytics: true,
    includeComments: true,
  });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="flex items-center gap-1"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-label="Print reports"
     >
        <Printer className="h-4 w-4" />
        Print
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Print Reports</DialogTitle>
            <DialogDescription>
              Select what to include in the printed report.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="include-analytics">Include analytics</Label>
                <p className="text-sm text-gray-500">Totals and summary metrics</p>
              </div>
              <Switch
                id="include-analytics"
                checked={options.includeAnalytics}
                onCheckedChange={(v) =>
                  setOptions((o) => ({ ...o, includeAnalytics: !!v }))
                }
                aria-label="Toggle include analytics in print output"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="include-comments">Include comments</Label>
                <p className="text-sm text-gray-500">Show report comments</p>
              </div>
              <Switch
                id="include-comments"
                checked={options.includeComments}
                onCheckedChange={(v) =>
                  setOptions((o) => ({ ...o, includeComments: !!v }))
                }
                aria-label="Toggle include comments in print output"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onPrint(options);
                setOpen(false);
              }}
            >
              Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}