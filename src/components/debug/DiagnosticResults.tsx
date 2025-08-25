import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DiagnosticResultsProps {
  testResults: string[];
}

export function DiagnosticResults({ testResults }: DiagnosticResultsProps) {
  if (testResults.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Test Results</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {testResults.map((result, index) => (
            <div key={index} className="text-sm font-mono">
              {result}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}