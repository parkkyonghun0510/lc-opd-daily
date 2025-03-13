import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileTextIcon, BarChart3Icon, PlusCircleIcon } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Create Report</CardTitle>
            <CardDescription>
              Submit a new daily report for your branch
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/reports/create">
              <Button className="w-full">
                <PlusCircleIcon className="mr-2 h-4 w-4" />
                Create New Report
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>View Reports</CardTitle>
            <CardDescription>
              Browse and filter all submitted reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/reports">
              <Button className="w-full" variant="outline">
                <FileTextIcon className="mr-2 h-4 w-4" />
                View All Reports
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Consolidated View</CardTitle>
            <CardDescription>
              See consolidated data across all branches
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/consolidated">
              <Button className="w-full" variant="outline">
                <BarChart3Icon className="mr-2 h-4 w-4" />
                View Consolidated Data
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
