"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { ReportCommentsList } from "@/components/reports/ReportCommentsList";

export default function TestReportCommentsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runTest = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/test/report-comments");
      const data = await response.json();
      
      if (response.ok) {
        setTestResult(data);
      } else {
        setError(data.error || "Test failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Test ReportComment Implementation</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Run Test</CardTitle>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={runTest} 
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running Test...
              </>
            ) : (
              "Run Test"
            )}
          </Button>
          
          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
              <p className="font-semibold">Error:</p>
              <p>{error}</p>
            </div>
          )}
          
          {testResult && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Test Result:</h3>
              <pre className="p-4 bg-gray-100 rounded-md overflow-auto max-h-96">
                {JSON.stringify(testResult, null, 2)}
              </pre>
              
              {testResult.report?.id && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-2">Comments for Test Report:</h3>
                  <ReportCommentsList 
                    reportId={testResult.report.id} 
                    initialComments={testResult.report.ReportComment || []}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
