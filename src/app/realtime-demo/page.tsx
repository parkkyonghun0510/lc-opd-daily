import { Metadata } from 'next';
import HybridRealtimeDemo from '@/components/HybridRealtimeDemo';
import DashboardRealtimeExample from '@/components/DashboardRealtimeExample';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const metadata: Metadata = {
  title: 'Hybrid Realtime Demo',
  description: 'Demonstration of the hybrid SSE/Polling approach for real-time updates',
};

export default function RealtimeDemoPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Hybrid Realtime Updates Demo</h1>
      <p className="mb-6">
        This page demonstrates the hybrid approach for real-time updates using SSE with polling fallback.
        It provides reliable real-time updates across all browsers and network conditions.
      </p>

      <Tabs defaultValue="general" className="mb-8">
        <TabsList className="mb-4">
          <TabsTrigger value="general">General Demo</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard Example</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <HybridRealtimeDemo />
        </TabsContent>

        <TabsContent value="dashboard">
          <DashboardRealtimeExample />
        </TabsContent>
      </Tabs>

      <div className="mt-8 p-4 bg-muted rounded-md">
        <h2 className="text-xl font-semibold mb-2">Implementation Notes</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>This implementation uses a hybrid approach that combines SSE and polling.</li>
          <li>SSE is used when available for efficient real-time updates.</li>
          <li>Polling is used as a fallback when SSE is not supported or fails.</li>
          <li>The system automatically switches between methods based on browser support and connection stability.</li>
          <li>All events are stored in memory on the server and can be retrieved via polling.</li>
          <li>This approach provides the best balance of real-time performance and reliability.</li>
        </ul>
      </div>
    </div>
  );
}
