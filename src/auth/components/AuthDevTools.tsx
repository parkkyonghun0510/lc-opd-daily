"use client";

import { useState } from "react";
import { useStore } from "@/auth/store";
import {
  refreshSession,
  synchronizeUserData,
  handleSessionTimeout,
} from "@/auth/store/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { AuthAnalyticsDashboard } from "./AuthAnalyticsDashboard";
import { toast } from "sonner";
import { format } from "date-fns";

/**
 * AuthDevTools component
 *
 * Developer tools for debugging authentication
 */
export function AuthDevTools() {
  const store = useStore();
  const [sessionExpiry, setSessionExpiry] = useState(30);
  const [showDevTools, setShowDevTools] = useState(false);

  // Format time until expiry
  const formatTimeUntilExpiry = () => {
    const timeLeft = store.timeUntilExpiry();
    if (timeLeft <= 0) return "Expired";

    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);

    return `${minutes}m ${seconds}s`;
  };

  // Format date
  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "N/A";
    return format(new Date(timestamp), "PPpp");
  };

  // Handle session expiry change
  const handleSessionExpiryChange = (value: number[]) => {
    setSessionExpiry(value[0]);
  };

  // Set custom session expiry
  const handleSetSessionExpiry = () => {
    const expiresAt = Date.now() + sessionExpiry * 60 * 1000;
    store.setSessionExpiry(expiresAt);
    toast.success(`Session expiry set to ${sessionExpiry} minutes from now`);
  };

  // Force session timeout
  const handleForceTimeout = async () => {
    store.setSessionExpiry(Date.now() - 1000);
    await handleSessionTimeout();
    toast.success("Session timeout forced");
  };

  // Toggle dev tools
  const toggleDevTools = () => {
    setShowDevTools(!showDevTools);
  };

  return (
    <>
      <div className="fixed bottom-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleDevTools}
          className="bg-white dark:bg-gray-800"
        >
          {showDevTools ? "Hide" : "Show"} Auth Dev Tools
        </Button>
      </div>

      {showDevTools && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-auto">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">
                Authentication Developer Tools
              </h2>
              <Button variant="ghost" size="sm" onClick={toggleDevTools}>
                Close
              </Button>
            </div>

            <Tabs defaultValue="state">
              <div className="p-4 border-b">
                <TabsList>
                  <TabsTrigger value="state">State</TabsTrigger>
                  <TabsTrigger value="actions">Actions</TabsTrigger>
                  <TabsTrigger value="session">Session</TabsTrigger>
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                </TabsList>
              </div>

              <div className="p-4">
                <TabsContent value="state">
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Authentication State</CardTitle>
                        <CardDescription>
                          Current authentication state from the store
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Authenticated</Label>
                              <div className="mt-1">
                                <Badge
                                  variant={
                                    store.isAuthenticated
                                      ? "default"
                                      : "secondary"
                                  }
                                >
                                  {store.isAuthenticated ? "Yes" : "No"}
                                </Badge>
                              </div>
                            </div>
                            <div>
                              <Label>Loading</Label>
                              <div className="mt-1">
                                <Badge
                                  variant={
                                    store.isLoading ? "default" : "secondary"
                                  }
                                >
                                  {store.isLoading ? "Yes" : "No"}
                                </Badge>
                              </div>
                            </div>
                            <div>
                              <Label>Session Expired</Label>
                              <div className="mt-1">
                                <Badge
                                  variant={
                                    store.isSessionExpired()
                                      ? "destructive"
                                      : "secondary"
                                  }
                                >
                                  {store.isSessionExpired() ? "Yes" : "No"}
                                </Badge>
                              </div>
                            </div>
                            <div>
                              <Label>Time Until Expiry</Label>
                              <div className="mt-1 font-mono">
                                {formatTimeUntilExpiry()}
                              </div>
                            </div>
                            <div>
                              <Label>Last Activity</Label>
                              <div className="mt-1 font-mono text-xs">
                                {formatDate(store.lastActivity)}
                              </div>
                            </div>
                            <div>
                              <Label>Session Expires At</Label>
                              <div className="mt-1 font-mono text-xs">
                                {formatDate(store.sessionExpiresAt)}
                              </div>
                            </div>
                          </div>

                          {store.error && (
                            <div>
                              <Label>Error</Label>
                              <div className="mt-1 p-2 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded">
                                {store.error}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>User Data</CardTitle>
                        <CardDescription>
                          Current user data from the store
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {store.user ? (
                          <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded overflow-auto text-xs">
                            {JSON.stringify(store.user, null, 2)}
                          </pre>
                        ) : (
                          <div className="text-muted-foreground">
                            No user data available
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Profile Data</CardTitle>
                        <CardDescription>
                          Current profile data from the store
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {store.profile ? (
                          <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded overflow-auto text-xs">
                            {JSON.stringify(store.profile, null, 2)}
                          </pre>
                        ) : (
                          <div className="text-muted-foreground">
                            No profile data available
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="actions">
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Authentication Actions</CardTitle>
                        <CardDescription>
                          Perform authentication actions
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Button
                              onClick={() => refreshSession()}
                              disabled={!store.isAuthenticated}
                            >
                              Refresh Session
                            </Button>

                            <Button
                              onClick={() => synchronizeUserData()}
                              disabled={!store.isAuthenticated}
                            >
                              Synchronize User Data
                            </Button>

                            <Button
                              onClick={() => store.updateLastActivity()}
                              disabled={!store.isAuthenticated}
                            >
                              Update Last Activity
                            </Button>

                            <Button
                              onClick={() => store.clearError()}
                              disabled={!store.error}
                              variant="outline"
                            >
                              Clear Error
                            </Button>

                            <Button
                              onClick={() => store.logout()}
                              disabled={!store.isAuthenticated}
                              variant="destructive"
                            >
                              Logout
                            </Button>

                            <Button
                              onClick={() => store.clearProfile()}
                              disabled={!store.profile}
                              variant="destructive"
                            >
                              Clear Profile
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Store Manipulation</CardTitle>
                        <CardDescription>
                          Directly manipulate the store state (for testing only)
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center space-x-2">
                            <Switch
                              id="loading-switch"
                              checked={store.isLoading}
                              onCheckedChange={(checked) =>
                                store.setLoading(checked)
                              }
                            />
                            <Label htmlFor="loading-switch">
                              Set Loading State
                            </Label>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Switch
                              id="auth-switch"
                              checked={store.isAuthenticated}
                              onCheckedChange={(checked) => {
                                if (checked && !store.user) {
                                  toast.error(
                                    "Cannot set authenticated without a user",
                                  );
                                  return;
                                }
                                store.setUser(checked ? store.user : null);
                              }}
                              disabled={!store.user && !store.isAuthenticated}
                            />
                            <Label htmlFor="auth-switch">
                              Set Authenticated State
                            </Label>
                          </div>

                          <div>
                            <Label htmlFor="error-input">
                              Set Error Message
                            </Label>
                            <div className="flex mt-1 space-x-2">
                              <Input
                                id="error-input"
                                value={store.error || ""}
                                onChange={(e) =>
                                  store.setError(e.target.value || null)
                                }
                                placeholder="Error message"
                              />
                              <Button
                                variant="outline"
                                onClick={() => store.setError(null)}
                                disabled={!store.error}
                              >
                                Clear
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="session">
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Session Management</CardTitle>
                        <CardDescription>
                          Manage session expiry and timeout
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          <div>
                            <Label>Session Expiry</Label>
                            <div className="flex items-center space-x-4 mt-2">
                              <Slider
                                value={[sessionExpiry]}
                                min={1}
                                max={60}
                                step={1}
                                onValueChange={handleSessionExpiryChange}
                                className="flex-1"
                              />
                              <span className="w-12 text-center">
                                {sessionExpiry}m
                              </span>
                            </div>
                            <div className="mt-4 flex space-x-2">
                              <Button onClick={handleSetSessionExpiry}>
                                Set Expiry
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  handleForceTimeout().catch((error) => {
                                    console.error(
                                      "Error forcing timeout:",
                                      error,
                                    );
                                    toast.error("Error forcing timeout");
                                  });
                                }}
                              >
                                Force Timeout
                              </Button>
                            </div>
                          </div>

                          <div className="pt-4 border-t">
                            <h3 className="font-medium mb-2">
                              Current Session Status
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Session Expires At</Label>
                                <div className="mt-1 font-mono text-xs">
                                  {formatDate(store.sessionExpiresAt)}
                                </div>
                              </div>
                              <div>
                                <Label>Time Until Expiry</Label>
                                <div className="mt-1 font-mono">
                                  {formatTimeUntilExpiry()}
                                </div>
                              </div>
                              <div>
                                <Label>Last Activity</Label>
                                <div className="mt-1 font-mono text-xs">
                                  {formatDate(store.lastActivity)}
                                </div>
                              </div>
                              <div>
                                <Label>Inactivity Time</Label>
                                <div className="mt-1 font-mono">
                                  {Math.floor(store.inactivityTime() / 1000)}s
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Local Storage</CardTitle>
                        <CardDescription>
                          View and manage authentication data in local storage
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <Label>Auth Storage</Label>
                            <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-auto text-xs h-40">
                              {typeof window !== "undefined"
                                ? JSON.stringify(
                                    JSON.parse(
                                      localStorage.getItem("auth-storage") ||
                                        "{}",
                                    ),
                                    null,
                                    2,
                                  )
                                : "Not available on server"}
                            </pre>
                          </div>

                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              onClick={() => {
                                localStorage.removeItem("auth-storage");
                                toast.success("Auth storage cleared");
                              }}
                            >
                              Clear Auth Storage
                            </Button>

                            <Button
                              variant="outline"
                              onClick={() => {
                                localStorage.clear();
                                toast.success("All local storage cleared");
                              }}
                            >
                              Clear All Storage
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="analytics">
                  <AuthAnalyticsDashboard />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      )}
    </>
  );
}
