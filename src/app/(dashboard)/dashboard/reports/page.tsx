"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";

// Placeholder Skeleton component since the actual one can't be found
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

export default function ReportsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading reports
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (session?.user) {
      console.log("Reports page - User session:", session.user);
    }
  }, [session]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Daily Reports</h1>
        <Button>Create New Report</Button>
      </div>

      <Tabs defaultValue="recent" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recent">Recent Reports</TabsTrigger>
          <TabsTrigger value="mine">My Reports</TabsTrigger>
          <TabsTrigger value="all">All Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="space-y-4">
          {loading ? (
            <ReportsLoadingSkeleton />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <ReportCard
                title="Branch A Report"
                date="2023-03-15"
                status="Approved"
                writeOffs={1200}
                ninetyPlus={850}
              />
              <ReportCard
                title="Branch B Report"
                date="2023-03-15"
                status="Pending"
                writeOffs={980}
                ninetyPlus={720}
              />
              <ReportCard
                title="Branch C Report"
                date="2023-03-15"
                status="Rejected"
                writeOffs={1550}
                ninetyPlus={1100}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="mine" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ReportCard
              title="My Branch Report"
              date="2023-03-15"
              status="Approved"
              writeOffs={1200}
              ninetyPlus={850}
            />
          </div>
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <p className="text-muted-foreground">
            Select filters to view all reports
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportCard({
  title,
  date,
  status,
  writeOffs,
  ninetyPlus,
}: {
  title: string;
  date: string;
  status: "Approved" | "Pending" | "Rejected";
  writeOffs: number;
  ninetyPlus: number;
}) {
  const statusColor = {
    Approved: "bg-green-100 text-green-800",
    Pending: "bg-yellow-100 text-yellow-800",
    Rejected: "bg-red-100 text-red-800",
  }[status];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{title}</CardTitle>
          <div
            className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}
          >
            {status}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{date}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Write-offs
            </p>
            <p className="text-2xl font-bold">${writeOffs.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              90+ Days
            </p>
            <p className="text-2xl font-bold">${ninetyPlus.toLocaleString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportsLoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <Skeleton className="h-6 w-[120px]" />
              <Skeleton className="h-5 w-[70px]" />
            </div>
            <Skeleton className="h-4 w-[80px] mt-1" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Skeleton className="h-4 w-[80px] mb-2" />
                <Skeleton className="h-8 w-[80px]" />
              </div>
              <div>
                <Skeleton className="h-4 w-[80px] mb-2" />
                <Skeleton className="h-8 w-[80px]" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
