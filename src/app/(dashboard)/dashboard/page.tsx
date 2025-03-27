import { RoleBasedDashboard } from "@/components/dashboard/RoleBasedDashboard";
// import { TestPushNotification } from '@/components/pwa/TestPushNotification';
// import { NotificationSubscription } from '@/components/pwa/NotificationSubscription';
// import { TestingGuide } from '@/components/pwa/TestingGuide';

export default function DashboardPage() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      
      {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-6"> */}
        
        {/* <div className="md:col-span-3">
          <TestingGuide />
        </div> */}
        
        {/* <div className="md:col-span-3">
          <TestPushNotification />
        </div> */}
      
        <div className="md:col-span-3">
          <RoleBasedDashboard />
        </div>
      </div>
    // </div>
  );
}
