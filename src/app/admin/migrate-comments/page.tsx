'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { migrateCommentsAction } from '@/app/_actions/migrate-comments-action';
import { useToast } from '@/components/ui/use-toast';

export default function MigrateCommentsPage() {
  // This page is now accessible to all authenticated users since it's a critical fix
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleMigration = async () => {
    if (!confirm('Are you sure you want to migrate all legacy comments? This operation cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    try {
      const migrationResult = await migrateCommentsAction();
      setResult(migrationResult);

      if (migrationResult.success) {
        toast({
          title: 'Migration Successful',
          description: `Successfully migrated ${migrationResult.migratedReports} out of ${migrationResult.totalReports} reports.`,
          variant: 'default',
        });
      } else {
        toast({
          title: 'Migration Failed',
          description: migrationResult.error || 'An unknown error occurred during migration.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error during migration:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      });

      toast({
        title: 'Migration Failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Migrate Legacy Comments</CardTitle>
          <CardDescription>
            This tool will migrate all legacy comments to the new structured comment array format.
            This helps fix UTF-8 encoding issues and enables better comment functionality.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              This operation will process all reports that have legacy comments but empty comment arrays.
              It may take some time depending on the number of reports. Make sure you have a backup before proceeding.
            </AlertDescription>
          </Alert>

          {result && (
            <Alert className={`mb-4 ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              {result.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertTitle>{result.success ? 'Success' : 'Error'}</AlertTitle>
              <AlertDescription>
                {result.success ? (
                  <div>
                    <p>Successfully migrated {result.migratedReports} out of {result.totalReports} reports.</p>
                    {result.failedReports > 0 && (
                      <p className="text-amber-600 mt-2">Failed to migrate {result.failedReports} reports.</p>
                    )}
                    {result.errors && result.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="font-semibold">Errors:</p>
                        <ul className="list-disc pl-5 text-sm">
                          {result.errors.slice(0, 5).map((error: string, index: number) => (
                            <li key={index}>{error}</li>
                          ))}
                          {result.errors.length > 5 && (
                            <li>...and {result.errors.length - 5} more errors</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p>{result.error || 'An unknown error occurred during migration.'}</p>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleMigration}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Migrating Comments...
              </>
            ) : (
              'Start Migration'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
