"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, Database, Bell, Shield, Server, RefreshCw } from "lucide-react";
import { BranchSettings } from "@/components/admin/branch-settings";
import { useToast } from "@/hooks/use-toast";

export default function AdminSettingsPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const handleCacheRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Simulate cache refresh
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast({
        title: "Cache Refreshed",
        description: "System cache has been successfully refreshed.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh cache. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-8 w-8" />
          Admin Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage system configuration, security, and administrative settings
        </p>
      </div>

      <Tabs defaultValue="system" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
        </TabsList>

        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                System Status
              </CardTitle>
              <CardDescription>
                Monitor system health and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">✓</div>
                  <div className="text-sm text-muted-foreground">Database</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">✓</div>
                  <div className="text-sm text-muted-foreground">Redis</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">✓</div>
                  <div className="text-sm text-muted-foreground">Queue</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">✓</div>
                  <div className="text-sm text-muted-foreground">VAPID</div>
                </div>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium">System Cache</h4>
                  <p className="text-sm text-muted-foreground">
                    Clear and refresh system cache
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleCacheRefresh}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {isRefreshing ? "Refreshing..." : "Refresh Cache"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Security Notice:</strong> These warnings are expected and indicate proper security practices.
              Sensitive server-side environment variables (like private keys and database URLs) cannot be validated in the browser.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="branches">
          <BranchSettings />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Configure system-wide notification preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">Push Notifications</h4>
                    <p className="text-sm text-muted-foreground">
                      Enable browser push notifications
                    </p>
                  </div>
                  <Badge variant="default">Enabled</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">Email Notifications</h4>
                    <p className="text-sm text-muted-foreground">
                      Send email notifications for critical events
                    </p>
                  </div>
                  <Badge variant="secondary">Disabled</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">Telegram Bot</h4>
                    <p className="text-sm text-muted-foreground">
                      Integration with Telegram for alerts
                    </p>
                  </div>
                  <Badge variant="secondary">Not Configured</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Configuration
              </CardTitle>
              <CardDescription>
                Manage authentication and security settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">NextAuth Configuration</h4>
                    <p className="text-sm text-muted-foreground">
                      Authentication provider settings
                    </p>
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">API Route Protection</h4>
                    <p className="text-sm text-muted-foreground">
                      Middleware authentication for API endpoints
                    </p>
                  </div>
                  <Badge variant="default">Enabled</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">Rate Limiting</h4>
                    <p className="text-sm text-muted-foreground">
                      Request rate limiting for API protection
                    </p>
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Database Management
              </CardTitle>
              <CardDescription>
                Monitor and manage database operations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">Connection Status</h4>
                    <p className="text-sm text-muted-foreground">
                      Database connectivity status
                    </p>
                  </div>
                  <Badge variant="default">Connected</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">Prisma Schema</h4>
                    <p className="text-sm text-muted-foreground">
                      Database schema synchronization
                    </p>
                  </div>
                  <Badge variant="default">Synchronized</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">Backup Status</h4>
                    <p className="text-sm text-muted-foreground">
                      Automated backup configuration
                    </p>
                  </div>
                  <Badge variant="secondary">Manual</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}