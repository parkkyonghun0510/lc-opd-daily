import { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SimpleHybridTest from '@/components/SimpleHybridTest';
import { TestSSEButton, TestEventButton, TestPollingButton } from '@/components/TestButtons';

export const metadata: Metadata = {
  title: 'Test Hybrid Realtime',
  description: 'Simple test page for hybrid realtime updates',
};

export default function TestHybridPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Test Hybrid Realtime</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Simple Test</CardTitle>
          <CardDescription>
            A simple test for hybrid realtime updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            This page includes a simple client-side script to test the hybrid realtime approach.
            Open your browser console to see the connection status and events.
          </p>

          <div className="flex space-x-4">
            <TestSSEButton />
            <TestEventButton />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Polling Test</CardTitle>
          <CardDescription>
            Test the polling fallback mechanism
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            This tests the polling fallback mechanism.
          </p>

          <TestPollingButton />
        </CardContent>
      </Card>

      <SimpleHybridTest />
    </div>
  );
}
