"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Camera,
  Shield,
  ChevronRight,
  Home,
  Key,
  Bell,
  Layout,
  Settings,
  Edit,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { fetchUserData } from "@/app/_actions/user-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  branchId?: string;
  branch?: {
    id: string;
    name: string;
    code: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    parentId: string | null;
  };
  lastLogin?: string;
  image?: string;
  username?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  computedFields: {
    displayName: string;
    accessLevel: string;
    status: string;
    primaryBranch?: {
      name: string;
      code: string;
    };
  };
  permissions: {
    canAccessAdmin: boolean;
    canViewAnalytics: boolean;
    canViewAuditLogs: boolean;
    canCustomizeDashboard: boolean;
    canManageSettings: boolean;
  };
  preferences: {
    notifications: {
      reportUpdates: boolean;
      reportComments: boolean;
      reportApprovals: boolean;
    };
    appearance: {
      compactMode: boolean;
    };
  };
}

function ProfileSkeleton() {
  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6">
      <div className="mb-8">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
      </div>

      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Link
          href="/dashboard"
          className="flex items-center hover:text-foreground"
        >
          <Home className="h-4 w-4 mr-1" />
          Dashboard
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span>Profile</span>
      </div>

      <div className="space-y-6">
        <div className="h-10 w-full bg-muted animate-pulse rounded" />

        <Card>
          <CardHeader>
            <div className="h-6 w-48 bg-muted animate-pulse rounded" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex flex-col items-center space-y-4">
                <div className="h-24 w-24 bg-muted animate-pulse rounded-full" />
                <div className="h-6 w-20 bg-muted animate-pulse rounded" />
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                    <div className="h-6 w-40 bg-muted animate-pulse rounded" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    async function loadUserProfile() {
      try {
        const result = await fetchUserData();

        if (result.status === 401) {
          router.push("/login");
          return;
        }

        if (result.status === 404) {
          setError("User profile not found");
          return;
        }

        if (result.status === 500) {
          setError("Failed to load profile");
          return;
        }

        if (!result.data) {
          setError("No user data received");
          return;
        }

        setUser(result.data);
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError("Could not load your profile. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    loadUserProfile();
  }, [router]);

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="mt-4 flex justify-center">
          <Button onClick={() => router.push("/dashboard")}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load user data. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          View and manage your account information
        </p>
      </div>

      <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
        <Link
          href="/dashboard"
          className="flex items-center hover:text-foreground"
        >
          <Home className="h-4 w-4 mr-1" />
          Dashboard
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span>Profile</span>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Your personal information and account details
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => router.push("/profile/edit")}
              className="flex items-center space-x-2"
            >
              <Edit className="h-4 w-4" />
              <span>Edit Profile</span>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex flex-col items-center space-y-4">
                <div className="relative group">
                  <Avatar className="h-24 w-24 transition-transform duration-200 group-hover:scale-105">
                    <AvatarImage
                      src={user.image}
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        // If image fails to load, hide it and let the fallback show
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                        console.error("Image failed to load:", user.image);
                      }}
                    />
                    <AvatarFallback className="bg-primary/10 text-lg">
                      {user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="icon"
                    variant="outline"
                    className="absolute bottom-0 right-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    onClick={() =>
                      toast({
                        title: "Coming soon",
                        description:
                          "Profile picture upload will be available soon.",
                      })
                    }
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
                <Badge variant={user.isActive ? "default" : "destructive"}>
                  {user.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>

              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      Name
                    </p>
                    <p className="text-sm">{user.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      Email
                    </p>
                    <p className="text-sm">{user.email}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      Role
                    </p>
                    <p className="text-sm capitalize">{user.role}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      Branch
                    </p>
                    <p className="text-sm">
                      {user.branch?.name || "Not assigned"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      Member since
                    </p>
                    <p className="text-sm">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      Last updated
                    </p>
                    <p className="text-sm">
                      {new Date(user.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <Separator className="my-6" />

                <div>
                  <h3 className="text-lg font-medium mb-4">
                    Access Permissions
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {user.permissions.canAccessAdmin
                          ? "Admin Access"
                          : "Standard Access"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Layout className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {user.permissions.canCustomizeDashboard
                          ? "Customizable Dashboard"
                          : "Standard Dashboard"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Bell className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {user.permissions.canViewAnalytics
                          ? "Analytics Access"
                          : "Limited Analytics"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {user.permissions.canViewAuditLogs
                          ? "Audit Log Access"
                          : "No Audit Access"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Notification Preferences</span>
              </CardTitle>
              <CardDescription>
                Manage your notification settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Report Updates</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified when reports are updated
                    </p>
                  </div>
                  <Badge
                    variant={
                      user.preferences.notifications.reportUpdates
                        ? "default"
                        : "secondary"
                    }
                  >
                    {user.preferences.notifications.reportUpdates
                      ? "Enabled"
                      : "Disabled"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Report Comments</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified about report comments
                    </p>
                  </div>
                  <Badge
                    variant={
                      user.preferences.notifications.reportComments
                        ? "default"
                        : "secondary"
                    }
                  >
                    {user.preferences.notifications.reportComments
                      ? "Enabled"
                      : "Disabled"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Report Approvals</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified about report approvals
                    </p>
                  </div>
                  <Badge
                    variant={
                      user.preferences.notifications.reportApprovals
                        ? "default"
                        : "secondary"
                    }
                  >
                    {user.preferences.notifications.reportApprovals
                      ? "Enabled"
                      : "Disabled"}
                  </Badge>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => router.push("/settings?tab=notifications")}
              >
                Manage Notifications
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Layout className="h-5 w-5" />
                <span>Appearance Settings</span>
              </CardTitle>
              <CardDescription>
                Customize your interface preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Compact Mode</p>
                    <p className="text-sm text-muted-foreground">
                      Use a more compact layout
                    </p>
                  </div>
                  <Badge
                    variant={
                      user.preferences.appearance.compactMode
                        ? "default"
                        : "secondary"
                    }
                  >
                    {user.preferences.appearance.compactMode
                      ? "Enabled"
                      : "Disabled"}
                  </Badge>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => router.push("/settings?tab=appearance")}
              >
                Manage Appearance
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Back to Dashboard
          </Button>
          <Button onClick={() => router.push("/settings")}>
            <Settings className="h-4 w-4 mr-2" />
            Go to Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
