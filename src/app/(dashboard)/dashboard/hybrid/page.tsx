import { Metadata } from 'next';
import HybridDashboardLayout from '../hybrid-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DashboardHybridContent from '@/components/dashboard/DashboardHybridContent';
import TestDashboardUpdateButton from '@/components/dashboard/TestDashboardUpdateButton';

export const metadata: Metadata = {
  title: 'Hybrid Dashboard',
  description: 'Dashboard with hybrid real-time updates',
};

// Opt out of static optimization
export const dynamic = 'force-dynamic';

export default function HybridDashboardPage() {
  return (
    <HybridDashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Hybrid Dashboard</h1>
        <p className="mb-6">
          This dashboard uses a hybrid approach for real-time updates, combining SSE with polling fallback.
        </p>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Dashboard Overview</CardTitle>
            <CardDescription>
              Key metrics and statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardHybridContent />
          </CardContent>
          <CardFooter className="flex justify-end">
            <TestDashboardUpdateButton />
          </CardFooter>
        </Card>

        <Tabs defaultValue="about" className="mb-8">
          <TabsList className="mb-4">
            <TabsTrigger value="about">About Hybrid Approach</TabsTrigger>
            <TabsTrigger value="benefits">Benefits</TabsTrigger>
            <TabsTrigger value="implementation">Implementation</TabsTrigger>
          </TabsList>

          <TabsContent value="about">
            <Card>
              <CardHeader>
                <CardTitle>About the Hybrid Approach</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4">
                  The hybrid approach combines Server-Sent Events (SSE) with traditional polling to provide
                  reliable real-time updates across all browsers and network conditions.
                </p>
                <p>
                  When SSE is available and working, it's used for efficient real-time updates.
                  If SSE fails or is not supported, the system automatically falls back to polling.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="benefits">
            <Card>
              <CardHeader>
                <CardTitle>Benefits of the Hybrid Approach</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Reliability:</strong> Multiple fallback mechanisms ensure updates reach clients</li>
                  <li><strong>Compatibility:</strong> Works across all browsers and network conditions</li>
                  <li><strong>Simplicity:</strong> Simpler implementation with fewer edge cases</li>
                  <li><strong>Performance:</strong> Uses the most efficient method available for each client</li>
                  <li><strong>Stability:</strong> Less likely to break with a simpler approach</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="implementation">
            <Card>
              <CardHeader>
                <CardTitle>Implementation Details</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4">
                  The implementation consists of several key components:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Event Emitter:</strong> Server-side component that emits events</li>
                  <li><strong>SSE Handler:</strong> Manages SSE connections and sends events</li>
                  <li><strong>Polling Endpoint:</strong> Fallback for browsers without SSE support</li>
                  <li><strong>Hybrid Hook:</strong> Client-side hook that combines SSE and polling</li>
                  <li><strong>Dashboard Context:</strong> Provides dashboard data with real-time updates</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </HybridDashboardLayout>
  );
}
