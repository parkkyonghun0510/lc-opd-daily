"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/use-toast";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { Permission } from "@/lib/auth/roles";

export default function MigrateCommentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("migrate");

  // Run the migration
  const runMigration = async () => {
    setLoading(true);
    setMigrationResult(null);

    try {
      const response = await fetch("/api/tools/migrate-report-comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to run migration");
      }

      const result = await response.json();
      setMigrationResult(result);

      toast({
        title: "Migration Complete",
        description: result.message,
        variant: result.errorCount > 0 ? "destructive" : "default",
      });
    } catch (error) {
      console.error("Error running migration:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to run migration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // If not authenticated or loading, show loading state
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <PermissionGate permissions={[Permission.MANAGE_SETTINGS]}>
      <div className="container mx-auto py-8 space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Report Comments Migration Tool</h1>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList>
            <TabsTrigger value="migrate">Migrate Comments</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          <TabsContent value="migrate" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  Migrate Legacy Comments to ReportComment Model
                </CardTitle>
                <CardDescription>
                  This tool will migrate comments from the legacy format (stored
                  in the Report model's comments field) to the new ReportComment
                  model. This process supports threaded comments with
                  parent-child relationships and preserves the conversation
                  structure.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Migration in progress...</span>
                    </div>
                    <Progress value={45} className="w-full" />
                  </div>
                ) : migrationResult ? (
                  <div className="space-y-4">
                    <Alert
                      variant={
                        migrationResult.errorCount > 0
                          ? "destructive"
                          : "default"
                      }
                    >
                      {migrationResult.errorCount > 0 ? (
                        <AlertCircle className="h-4 w-4" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                      <AlertTitle>
                        Migration{" "}
                        {migrationResult.errorCount > 0
                          ? "Completed with Errors"
                          : "Successful"}
                      </AlertTitle>
                      <AlertDescription>
                        {migrationResult.message}
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">
                            Total Reports
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            {migrationResult.totalReports}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">
                            Successful
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-green-600">
                            {migrationResult.successCount}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium">
                            Errors
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-red-600">
                            {migrationResult.errorCount}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {migrationResult.errors &&
                      migrationResult.errors.length > 0 && (
                        <div className="mt-4">
                          <h3 className="text-lg font-semibold mb-2">
                            Error Details
                          </h3>
                          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md max-h-60 overflow-y-auto">
                            <pre className="text-xs whitespace-pre-wrap">
                              {migrationResult.errors.join("\n")}
                            </pre>
                          </div>
                        </div>
                      )}
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Important</AlertTitle>
                    <AlertDescription>
                      This migration will create ReportComment records for all
                      comments in the legacy format. It is safe to run multiple
                      times as it will only process reports that haven't been
                      migrated yet. This process now supports threaded comments
                      with parent-child relationships.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => router.push("/dashboard/admin")}
                >
                  Back to Admin
                </Button>
                <Button onClick={runMigration} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Migrating...
                    </>
                  ) : migrationResult ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Run Again
                    </>
                  ) : (
                    "Start Migration"
                  )}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="about" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>About the Migration Tool</CardTitle>
                <CardDescription>
                  Understanding the comment migration process
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="prose dark:prose-invert max-w-none">
                  <h3>Migration Process</h3>
                  <p>
                    This tool migrates comments from the legacy format (stored
                    in the Report model's <code>comments</code> field) to the
                    new ReportComment model. The migration process:
                  </p>
                  <ol>
                    <li>
                      Finds all reports with comments in the legacy format
                    </li>
                    <li>
                      Parses the comments string to extract individual comments
                    </li>
                    <li>Creates new ReportComment records for each comment</li>
                    <li>
                      Preserves the relationship between comments and their
                      parent comments for threaded discussions
                    </li>
                  </ol>

                  <h3>Benefits of the New Model</h3>
                  <ul>
                    <li>
                      Better handling of UTF-8 characters including emojis
                    </li>
                    <li>Proper relational structure</li>
                    <li>Ability to query and filter comments</li>
                    <li>Better performance for reports with many comments</li>
                    <li>
                      Support for threaded comments with parent-child
                      relationships
                    </li>
                  </ul>

                  <h3>Backward Compatibility</h3>
                  <p>
                    For backward compatibility, the legacy <code>comments</code>{" "}
                    field is still maintained. New comments added through the
                    new API endpoints will update both the ReportComment model
                    and the legacy comments field. This ensures that older parts
                    of the application that might still rely on the legacy
                    format continue to work.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGate>
  );
}
