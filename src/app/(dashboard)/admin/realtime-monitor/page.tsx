import { Metadata } from "next";
import RealtimeMonitoringDashboard from "@/components/admin/RealtimeMonitoringDashboard";

export const metadata: Metadata = {
  title: "Real-time Monitoring",
  description: "Monitor real-time connections and events",
};

export default function RealtimeMonitorPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <RealtimeMonitoringDashboard />
    </div>
  );
}
