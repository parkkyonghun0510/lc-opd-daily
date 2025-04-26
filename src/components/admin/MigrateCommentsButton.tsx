"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export function MigrateCommentsButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleMigration = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/tools/migrate-report-comments", {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error ||
          errorData.details ||
          "Migration failed"
        );
      }

      const data = await response.json();
      setResult(data);

      toast({
        title: "Migration Complete",
        description: `Successfully migrated ${data.successCount} reports. ${data.errorCount > 0 ? `Failed: ${data.errorCount}` : ""
          }`,
        variant: data.errorCount > 0 ? "destructive" : "default",
      });
    } catch (error) {
      console.error("Error during migration:", error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      toast({
        title: "Migration Failed",
        description:
          error instanceof Error ? error.message : "Failed to migrate comments",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Migrate Comments to ReportComment Model</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Migrate Report Comments</DialogTitle>
          <DialogDescription>
            This will migrate all legacy comments from the Report model to the new ReportComment model.
            This process cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {result && (
          <div className="my-4">
            {result.success ? (
              <Alert variant="success" className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle>Migration Successful</AlertTitle>
                <AlertDescription>
                  <div className="mt-2 text-sm">
                    <p>Total reports processed: {result.totalReports}</p>
                    <p>Successfully migrated: {result.successCount}</p>
                    {result.errorCount > 0 && (
                      <p className="text-red-600">Failed: {result.errorCount}</p>
                    )}
                  </div>
                  {result.errors && result.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="font-semibold">Errors:</p>
                      <ul className="list-disc pl-5 text-xs text-red-600 max-h-40 overflow-y-auto">
                        {result.errors.map((error: string, index: number) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Migration Failed</AlertTitle>
                <AlertDescription>
                  {result.error || "An unknown error occurred"}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between">
          <Button
            variant="outline"
            onClick={() => setIsDialogOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleMigration}
            disabled={isLoading}
            className={result?.success ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Migrating...
              </>
            ) : result?.success ? (
              "Migration Complete"
            ) : (
              "Start Migration"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
