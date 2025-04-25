'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { migrateCommentsAction } from '@/app/_actions/migrate-comments-action';
import { useToast } from '@/components/ui/use-toast';

export default function FixCommentsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleFix = async () => {
    if (!confirm('Are you sure you want to fix all comments? This will help resolve UTF-8 encoding issues.')) {
      return;
    }

    setIsLoading(true);
    try {
      const migrationResult = await migrateCommentsAction();
      setResult(migrationResult);

      if (migrationResult.success) {
        toast({
          title: 'Fix Successful',
          description: `Successfully fixed ${migrationResult.migratedReports} out of ${migrationResult.totalReports} reports.`,
          variant: 'default',
        });
      } else {
        toast({
          title: 'Fix Failed',
          description: migrationResult.error || 'An unknown error occurred during the fix process.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error during fix process:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      });
      
      toast({
        title: 'Fix Failed',
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
          <CardTitle>Fix UTF-8 Encoding Issues in Comments</CardTitle>
          <CardDescription>
            This tool will fix UTF-8 encoding issues in report comments by migrating them to a new format.
            This should resolve the "invalid byte sequence for encoding UTF8" error.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Information</AlertTitle>
            <AlertDescription>
              This process will fix reports that have encoding issues in their comments.
              It's safe to run and won't affect reports that are already working correctly.
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
                    <p>Successfully fixed {result.migratedReports} out of {result.totalReports} reports.</p>
                    {result.failedReports > 0 && (
                      <p className="text-amber-600 mt-2">Failed to fix {result.failedReports} reports.</p>
                    )}
                  </div>
                ) : (
                  <p>{result.error || 'An unknown error occurred during the fix process.'}</p>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleFix} 
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fixing Comments...
              </>
            ) : (
              'Fix Comments'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
