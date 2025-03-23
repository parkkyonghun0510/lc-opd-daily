import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, Building2, Shield, Activity, 
  FileText, AlertTriangle, Clock, 
  TrendingUp, Settings, Database,
  Loader2, ChevronRight
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  lastChecked: Date;
  services: {
    name: string;
    status: 'up' | 'down' | 'degraded';
    responseTime: number;
  }[];
}

interface AdminOverviewProps {
  stats: {
    totalUsers: number;
    activeUsers: number;
    adminUsers: number;
    totalBranches: number;
    pendingReports: number;
    systemStatus: string;
    recentActivity: {
      type: string;
      user: string;
      action: string;
      timestamp: Date;
    }[];
    storageUsage: {
      used: number;
      total: number;
    };
  };
}

export function AdminOverview({ stats }: AdminOverviewProps) {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [prioritizedTasks, setPrioritizedTasks] = useState<{task: string; urgency: 'high' | 'medium' | 'low'; link: string}[]>([]);

  useEffect(() => {
    // Fetch system health data
    const fetchSystemHealth = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/admin/system/health');
        const data = await response.json();
        setSystemHealth(data);
      } catch (error) {
        console.error('Error fetching system health:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSystemHealth();
    
    // Generate prioritized tasks based on stats
    if (stats) {
      const tasks = [];
      if (stats.pendingReports > 0) {
        tasks.push({
          task: `Review ${stats.pendingReports} pending reports`,
          urgency: stats.pendingReports > 5 ? 'high' : 'medium',
          link: '/dashboard/approvals'
        });
      }
      
      if (systemHealth?.status === 'critical') {
        tasks.push({
          task: 'Address critical system issues',
          urgency: 'high',
          link: '/dashboard/admin/system/health'
        });
      } else if (systemHealth?.status === 'warning') {
        tasks.push({
          task: 'Check system warnings',
          urgency: 'medium',
          link: '/dashboard/admin/system/health'
        });
      }
      
      if ((stats.storageUsage.used / stats.storageUsage.total) > 0.8) {
        tasks.push({
          task: 'Storage usage is high',
          urgency: (stats.storageUsage.used / stats.storageUsage.total) > 0.9 ? 'high' : 'medium',
          link: '/dashboard/admin/storage'
        });
      }
      
      setPrioritizedTasks(tasks);
    }
    
    // Don't poll too frequently to avoid excess API calls
    const interval = setInterval(fetchSystemHealth, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [stats, systemHealth?.status]);

  // Quick action cards list
  const quickActions = [
    {
      title: "User Management",
      description: "Add, modify, or deactivate user accounts",
      icon: Users,
      href: "/dashboard/users",
      badge: stats.activeUsers > 0 ? `${stats.activeUsers} active` : undefined,
    },
    {
      title: "Role & Permissions",
      description: "Configure access levels and permissions",
      icon: Shield,
      href: "/dashboard/admin/users?tab=roles",
    },
    {
      title: "Branch Management",
      description: "Manage branch hierarchy and settings",
      icon: Building2,
      href: "/dashboard/admin/branches",
      badge: `${stats.totalBranches} total`,
    },
    {
      title: "Report Approvals",
      description: "Review and manage pending reports",
      icon: FileText,
      href: "/dashboard/approvals",
      badge: stats.pendingReports > 0 ? `${stats.pendingReports} pending` : undefined,
    },
    {
      title: "System Settings",
      description: "Configure global system parameters",
      icon: Settings,
      href: "/dashboard/admin/settings",
    },
    {
      title: "Audit Logs",
      description: "View detailed system activity",
      icon: Clock,
      href: "/dashboard/admin/audit",
    },
    {
      title: "Storage Monitor",
      description: "Manage system storage and backups",
      icon: Database,
      href: "/dashboard/admin/storage",
      badge: `${Math.round((stats.storageUsage.used / stats.storageUsage.total) * 100)}% used`,
    },
    {
      title: "System Health",
      description: "Monitor system performance and issues",
      icon: Activity,
      href: "/dashboard/admin/system/health",
      badge: systemHealth?.status,
    },
  ];

  return (
    <div className="space-y-6">
      {/* System Alerts */}
      {systemHealth?.status === 'critical' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Critical system issues detected. Check system health for details.
          </AlertDescription>
        </Alert>
      )}

      {/* Prioritized Tasks */}
      {prioritizedTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Priority Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {prioritizedTasks.map((task, index) => (
                <li key={index}>
                  <Link href={task.link} className="block">
                    <div className={`p-3 rounded-md flex items-center justify-between ${
                      task.urgency === 'high' 
                        ? 'bg-red-50 text-red-800 border border-red-200 hover:bg-red-100'
                        : task.urgency === 'medium'
                          ? 'bg-yellow-50 text-yellow-800 border border-yellow-200 hover:bg-yellow-100'
                          : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className={`h-2 w-2 rounded-full ${
                          task.urgency === 'high' ? 'bg-red-500' : 
                          task.urgency === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                        }`}></span>
                        <span>{task.task}</span>
                      </div>
                      <ChevronRight className="h-5 w-5" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Dashboard Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total Users</span>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-16" /> : stats.totalUsers}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{isLoading ? <Skeleton className="h-4 w-20" /> : `${stats.activeUsers} active users`}</span>
                <span className="mx-1">•</span>
                <span>{isLoading ? <Skeleton className="h-4 w-16" /> : `${stats.adminUsers} admins`}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Storage Usage</span>
                <Database className="h-4 w-4 text-muted-foreground" />
              </div>
              {isLoading ? (
                <>
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-32" />
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {Math.round((stats.storageUsage.used / stats.storageUsage.total) * 100)}%
                  </div>
                  <Progress 
                    value={(stats.storageUsage.used / stats.storageUsage.total) * 100}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {Math.round(stats.storageUsage.used / 1024 / 1024 / 1024)}GB of {Math.round(stats.storageUsage.total / 1024 / 1024 / 1024)}GB used
                  </p>
                </>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">System Health</span>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </div>
              {isLoading ? (
                <>
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-4 w-40" />
                </>
              ) : (
                <>
                  <div className="flex items-center space-x-2">
                    <div className={`h-3 w-3 rounded-full ${
                      systemHealth?.status === 'healthy' ? 'bg-green-500' :
                      systemHealth?.status === 'warning' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`} />
                    <span className="text-2xl font-bold capitalize">
                      {systemHealth?.status || 'Unknown'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Last checked: {systemHealth?.lastChecked ? 
                      formatDistanceToNow(new Date(systemHealth.lastChecked), { addSuffix: true }) : 
                      'Unknown'}
                  </p>
                </>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Pending Reports</span>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-16" /> : stats.pendingReports}</div>
              <p className="text-xs text-muted-foreground">
                {isLoading ? <Skeleton className="h-4 w-24" /> : "Awaiting approval"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions - Grid Layout */}
      <Card>
        <CardHeader>
          <CardTitle>Administrative Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => (
              <Button
                key={action.title}
                variant="outline"
                className="h-auto p-4 text-left flex flex-col items-start justify-start relative"
                asChild
              >
                <Link href={action.href}>
                  <div className="w-full">
                    <div className="flex items-center justify-between mb-2">
                      <action.icon className="h-5 w-5" />
                      {action.badge && (
                        <Badge variant="secondary" className="ml-2">
                          {action.badge}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-base">{action.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {action.description}
                    </p>
                  </div>
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity - Simplified */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <div>
                      <Skeleton className="h-5 w-48 mb-1" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : stats.recentActivity.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No recent activity recorded
            </div>
          ) : (
            <div className="space-y-4">
              {stats.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center justify-between py-2">
                  <div className="flex items-center space-x-4">
                    <div className={`w-2 h-2 rounded-full ${
                      activity.type === 'warning' ? 'bg-yellow-500' :
                      activity.type === 'error' ? 'bg-red-500' :
                      'bg-green-500'
                    }`} />
                    <div>
                      <p className="text-sm font-medium">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">by {activity.user}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 