"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RoleManager } from "./RoleManager";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus, Users, ShieldCheck, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/components/ui/use-toast";

interface UserStats {
  total: number;
  active: number;
  admin: number;
  lastCreated: {
    id: string;
    username: string;
    name: string;
    createdAt: string;
  } | null;
}

export function UserSettings() {
  const router = useRouter();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchUserStats = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/users/stats');
        
        if (!response.ok) {
          throw new Error('Failed to fetch user statistics');
        }
        
        const data = await response.json();
        setUserStats(data);
      } catch (error) {
        console.error('Error fetching user statistics:', error);
        toast({
          title: "Error",
          description: "Failed to load user statistics",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserStats();
  }, []);
  
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
      return 'Unknown';
    }
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">User Management</h3>
        <p className="text-sm text-muted-foreground">
          Manage user accounts, assign roles, and control access permissions.
        </p>
      </div>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="roles">Role Assignment</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>User Directory</CardTitle>
                <CardDescription>
                  View and manage all users in the system
                </CardDescription>
              </div>
              <Button asChild>
                <Link href="/dashboard/admin/users">
                  <Users className="mr-2 h-4 w-4" />
                  View All Users
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-dashed border-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" asChild className="justify-start">
                          <Link href="/dashboard/admin/users">
                            <Users className="mr-2 h-4 w-4" />
                            Manage Users
                          </Link>
                        </Button>
                        <Button variant="outline" asChild className="justify-start">
                          <Link href="/dashboard/admin/users/create">
                            <UserPlus className="mr-2 h-4 w-4" />
                            Add New User
                          </Link>
                        </Button>
                        <Button variant="outline" asChild className="justify-start">
                          <Link href="/dashboard/admin/audit">
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            View Audit Logs
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">System Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                        <div className="flex justify-center items-center h-24">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Total Users:</span>
                            <span className="font-medium">{userStats?.total || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Active Users:</span>
                            <span className="font-medium">{userStats?.active || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Admin Users:</span>
                            <span className="font-medium">{userStats?.admin || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Last Account Created:</span>
                            <span className="font-medium">
                              {userStats?.lastCreated ? 
                                `${userStats.lastCreated.name} (${formatDate(userStats.lastCreated.createdAt)})` : 
                                'None'}
                            </span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Role Assignment</CardTitle>
              <CardDescription>
                Assign roles to users and manage their branch access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RoleManager context="user" />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Permission Settings</CardTitle>
              <CardDescription>
                Configure role-based permissions for different user types
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-4">
                <p>
                  Each role in the system has predefined permissions that determine what users can access and modify.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  <div className="border rounded-md p-4">
                    <h4 className="font-medium mb-2">Admin</h4>
                    <p className="text-sm text-muted-foreground mb-2">Full system access with all permissions.</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>Manage users and roles</li>
                      <li>Configure system settings</li>
                      <li>Access all branches</li>
                      <li>View all reports</li>
                      <li>Access audit logs</li>
                    </ul>
                  </div>
                  
                  <div className="border rounded-md p-4">
                    <h4 className="font-medium mb-2">Branch Manager</h4>
                    <p className="text-sm text-muted-foreground mb-2">Manage assigned branches and their sub-branches.</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>Manage branch users</li>
                      <li>Access branch reports</li>
                      <li>Approve branch reports</li>
                      <li>View branch analytics</li>
                    </ul>
                  </div>
                  
                  <div className="border rounded-md p-4">
                    <h4 className="font-medium mb-2">User</h4>
                    <p className="text-sm text-muted-foreground mb-2">Standard access to assigned branches only.</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>Create and edit reports</li>
                      <li>View assigned branch data</li>
                      <li>Limited dashboard access</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
