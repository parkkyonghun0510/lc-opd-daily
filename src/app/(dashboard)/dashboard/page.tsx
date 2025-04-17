
import RoleBasedDashboard from "@/components/dashboard/RoleBasedDashboard";
import { DashboardDataProvider } from '@/contexts/DashboardDataContext';

export default function DashboardPage() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
        <div className="md:col-span-3">
          <DashboardDataProvider>
            <RoleBasedDashboard />
          </DashboardDataProvider>
        </div>
      </div>
    // </div>
  );
}
