import { Metadata } from "next";
import { MigrateCommentsButton } from "@/components/admin/MigrateCommentsButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Migrate Comments | Admin Tools",
  description: "Migrate legacy comments to the new ReportComment model",
};

export default async function MigrateCommentsPage() {
  // Check if user is authenticated and has admin role
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Admin Tools - Migrate Comments</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Migrate Report Comments</CardTitle>
          <CardDescription>
            This tool will migrate all legacy comments from the Report model to the new ReportComment model.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p>
              The migration process will:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Find all reports with comments in the legacy format (from the <code>comments</code> field)</li>
              <li>Parse and sanitize the comments</li>
              <li>Create new records in the ReportComment table</li>
              <li>Skip reports that already have ReportComment records</li>
            </ul>

            <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mt-4">
              <p className="text-amber-800 font-medium">Important Notes:</p>
              <ul className="list-disc pl-5 text-amber-700 mt-2">
                <li>This process cannot be undone</li>
                <li>The original comments will remain in the Report model for backward compatibility</li>
                <li>This migration is safe to run multiple times - it will skip reports that have already been migrated</li>
                <li>Only comments from the <code>comments</code> field will be migrated (the <code>commentArray</code> field is not present in the current database schema)</li>
              </ul>
            </div>

            <div className="mt-6 flex justify-center">
              <MigrateCommentsButton />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
