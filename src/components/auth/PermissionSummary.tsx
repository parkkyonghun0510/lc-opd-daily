import { useSession } from "next-auth/react";
import {
  Permission,
  UserRole,
  getGroupedPermissions,
  getPermissionDisplayName,
  checkPermission,
} from "@/lib/auth/roles";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAllPermissions } from "@/hooks/usePermissionCheck";

interface PermissionSummaryProps {
  showAll?: boolean;
  variant?: "card" | "inline" | "accordion";
  userId?: string;
}

/**
 * Component to display a summary of the current user's permissions
 * Useful for admin settings screens and user management
 */
export function PermissionSummary({
  showAll = false,
  variant = "card",
  userId,
}: PermissionSummaryProps) {
  const { data: session, status } = useSession();
  const { permissions, isLoading } = useAllPermissions();

  if (isLoading) {
    return (
      <div className="animate-pulse h-8 bg-gray-200 dark:bg-gray-800 rounded"></div>
    );
  }

  if (!session?.user) {
    return <div className="text-red-500">Not authenticated</div>;
  }

  const userRole = session.user.role as string;
  const roleDisplay = userRole
    .replace(/_/g, " ")
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const groupedPermissions = getGroupedPermissions();

  // Get the user's permissions in each category
  const userPermissions = Object.entries(groupedPermissions).reduce(
    (acc, [category, perms]) => {
      acc[category] = perms.filter((p) => checkPermission(userRole, p));
      return acc;
    },
    {} as Record<string, Permission[]>,
  );

  if (variant === "inline") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">Role:</span>
          <Badge variant="outline" className="capitalize">
            {roleDisplay}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1">
          {Object.values(userPermissions)
            .flat()
            .slice(0, showAll ? undefined : 5)
            .map((permission) => (
              <Badge key={permission} variant="secondary" className="text-xs">
                {getPermissionDisplayName(permission)}
              </Badge>
            ))}
          {!showAll && Object.values(userPermissions).flat().length > 5 && (
            <Badge variant="outline" className="text-xs">
              +{Object.values(userPermissions).flat().length - 5} more
            </Badge>
          )}
        </div>
      </div>
    );
  }

  if (variant === "accordion") {
    return (
      <Accordion type="single" collapsible className="w-full">
        {Object.entries(userPermissions).map(([category, perms]) =>
          perms.length > 0 ? (
            <AccordionItem key={category} value={category}>
              <AccordionTrigger className="text-sm font-medium">
                {category} ({perms.length})
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-1 pt-2">
                  {perms.map((permission) => (
                    <Badge
                      key={permission}
                      variant="secondary"
                      className="text-xs"
                    >
                      {getPermissionDisplayName(permission)}
                    </Badge>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ) : null,
        )}
      </Accordion>
    );
  }

  // Default card view
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>User Permissions</span>
          <Badge>{roleDisplay}</Badge>
        </CardTitle>
        <CardDescription>
          Permissions available with {roleDisplay} role
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(userPermissions).map(([category, perms]) =>
            perms.length > 0 ? (
              <div key={category}>
                <h4 className="text-sm font-medium mb-2">{category}</h4>
                <div className="flex flex-wrap gap-1">
                  {perms.map((permission) => (
                    <Badge
                      key={permission}
                      variant="secondary"
                      className="text-xs"
                    >
                      {getPermissionDisplayName(permission)}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
      </CardContent>
    </Card>
  );
}
