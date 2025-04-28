import { Metadata } from 'next';
import SSEDashboard from '@/components/admin/SSEDashboard';

export const metadata: Metadata = {
  title: 'SSE Dashboard | Admin',
  description: 'Server-Sent Events (SSE) monitoring dashboard',
};

export default function SSEDashboardPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <SSEDashboard />
    </div>
  );
}
