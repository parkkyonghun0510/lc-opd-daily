import { useState } from "react";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { PermissionSummary } from "@/components/auth/PermissionSummary";
import {
  Permission,
  UserRole,
  getGroupedPermissions,
  getPermissionDisplayName,
} from "@/lib/auth/roles";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  useAllPermissions,
  usePermissionCheck,
  useRoleCheck,
} from "@/hooks/usePermissionCheck";
import { Separator } from "@/components/ui/separator";

/**
 * A demonstration component showing how to use permission-based UI components
 */
export function RolePermissionDemo() {
  const [currentTab, setCurrentTab] = useState("overview");
  const { permissions, isLoading } = useAllPermissions();
  const { hasRole: isAdmin } = useRoleCheck(UserRole.ADMIN);

  if (isLoading) {
    return <div className="p-4">Loading permission data...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Role & Permission System Demo</CardTitle>
          <CardDescription>
            Examples of how to use the permission system in your UI components
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            defaultValue="overview"
            value={currentTab}
            onValueChange={setCurrentTab}
            className="space-y-4"
          >
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="components">Components</TabsTrigger>
              <TabsTrigger value="hooks">Hooks</TabsTrigger>
              <TabsTrigger value="admin">Admin Only</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2">Your Permissions</h3>
                <PermissionSummary variant="accordion" />
              </div>
            </TabsContent>

            <TabsContent value="components" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      Permission Gate Example
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <PermissionGate
                        permissions={[Permission.VIEW_REPORTS]}
                        fallback={
                          <div className="text-red-500">
                            You don't have permission to view reports
                          </div>
                        }
                      >
                        <div className="p-2 bg-green-100 dark:bg-green-900 rounded">
                          You have permission to view reports
                        </div>
                      </PermissionGate>

                      <PermissionGate
                        permissions={[Permission.DELETE_REPORTS]}
                        fallback={
                          <div className="text-red-500">
                            You don't have permission to delete reports
                          </div>
                        }
                      >
                        <div className="p-2 bg-green-100 dark:bg-green-900 rounded">
                          You have permission to delete reports
                        </div>
                      </PermissionGate>

                      <PermissionGate
                        roles={[UserRole.ADMIN]}
                        fallback={
                          <div className="text-red-500">
                            Admin role required
                          </div>
                        }
                      >
                        <div className="p-2 bg-green-100 dark:bg-green-900 rounded">
                          You have the ADMIN role
                        </div>
                      </PermissionGate>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      Permission Summary Variants
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-2 border rounded">
                        <h4 className="text-xs mb-2 font-medium">
                          Inline variant:
                        </h4>
                        <PermissionSummary variant="inline" />
                      </div>

                      <div className="p-2 border rounded">
                        <h4 className="text-xs mb-2 font-medium">
                          Accordion variant:
                        </h4>
                        <PermissionSummary variant="accordion" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="hooks" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    Permission Hooks Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <PermissionHookExample
                      permission={Permission.VIEW_REPORTS}
                      label="Check View Reports Permission"
                    />
                    <PermissionHookExample
                      permission={Permission.EDIT_REPORTS}
                      label="Check Edit Reports Permission"
                    />
                    <PermissionHookExample
                      permission={Permission.DELETE_REPORTS}
                      label="Check Delete Reports Permission"
                    />
                    <PermissionHookExample
                      permission={Permission.MANAGE_USERS}
                      label="Check Manage Users Permission"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="admin" className="space-y-4">
              <PermissionGate
                roles={[UserRole.ADMIN]}
                fallback={
                  <Card>
                    <CardContent className="p-6">
                      <div className="text-center">
                        <h3 className="text-lg font-medium mb-2">
                          Admin Access Required
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          This tab contains sensitive information that requires
                          admin privileges.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                }
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      Admin Control Panel
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-3 bg-green-100 dark:bg-green-900 rounded">
                      <p>Welcome, Administrator!</p>
                      <p className="text-sm">
                        You have access to all system features and permissions.
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" size="sm">
                      System Settings
                    </Button>
                  </CardFooter>
                </Card>
              </PermissionGate>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper component for the hooks example
function PermissionHookExample({
  permission,
  label,
}: {
  permission: Permission;
  label: string;
}) {
  const { hasPermission, isLoading } = usePermissionCheck([permission]);

  return (
    <div className="flex items-center justify-between p-2 border rounded">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{permission}</p>
      </div>
      <div>
        {isLoading ? (
          <div className="animate-pulse h-6 w-16 bg-gray-200 dark:bg-gray-800 rounded"></div>
        ) : (
          <div
            className={`text-sm px-2 py-1 rounded ${
              hasPermission
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
            }`}
          >
            {hasPermission ? "Granted" : "Denied"}
          </div>
        )}
      </div>
    </div>
  );
}
