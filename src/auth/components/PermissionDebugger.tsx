'use client';

import { useState } from 'react';
import { usePermissions } from '@/auth/hooks/useAuth';
import { Permission, UserRole } from '@/lib/auth/roles';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Check, X, User, Shield, Info } from 'lucide-react';

/**
 * Component for debugging permissions in the UI
 * Only shown in development mode
 */
export function PermissionDebugger() {
  const { hasPermission, hasRole, debug } = usePermissions();
  const [searchTerm, setSearchTerm] = useState('');
  const [customPermission, setCustomPermission] = useState('');
  const [checkResult, setCheckResult] = useState<boolean | null>(null);
  
  // Only show in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  // Get all permissions
  const allPermissions = Object.values(Permission);
  
  // Filter permissions based on search term
  const filteredPermissions = searchTerm 
    ? allPermissions.filter(p => 
        p.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : allPermissions;
  
  // Group permissions by category
  const groupedPermissions: Record<string, Permission[]> = {
    'Admin': filteredPermissions.filter(p => p.includes('ADMIN') || p.includes('MANAGE')),
    'Reports': filteredPermissions.filter(p => p.includes('REPORT')),
    'Branch': filteredPermissions.filter(p => p.includes('BRANCH')),
    'User': filteredPermissions.filter(p => p.includes('USER')),
    'Dashboard': filteredPermissions.filter(p => p.toLowerCase().includes('dashboard') || p.toLowerCase().includes('analytics')),
    'Other': filteredPermissions.filter(p => 
      !p.includes('ADMIN') && 
      !p.includes('MANAGE') && 
      !p.includes('REPORT') && 
      !p.includes('BRANCH') && 
      !p.includes('USER') && 
      !p.toLowerCase().includes('dashboard') && 
      !p.toLowerCase().includes('analytics')
    )
  };
  
  // Check custom permission
  const checkCustomPermission = () => {
    if (!customPermission) return;
    setCheckResult(hasPermission(customPermission));
  };
  
  // Get debug info
  const debugInfo = debug();
  
  return (
    <Card className="w-full max-w-3xl mx-auto my-4 border-dashed border-yellow-500 dark:border-yellow-700">
      <CardHeader className="bg-yellow-50 dark:bg-yellow-900/20">
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Permission Debugger
          <Badge variant="outline" className="ml-2">Development Only</Badge>
        </CardTitle>
        <CardDescription>
          Debug and test permissions for the current user
        </CardDescription>
      </CardHeader>
      
      <Tabs defaultValue="check">
        <TabsList className="w-full">
          <TabsTrigger value="check">Check Permissions</TabsTrigger>
          <TabsTrigger value="user">User Info</TabsTrigger>
          <TabsTrigger value="all">All Permissions</TabsTrigger>
        </TabsList>
        
        <TabsContent value="check">
          <CardContent className="pt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Input 
                  placeholder="Enter permission to check..." 
                  value={customPermission}
                  onChange={(e) => setCustomPermission(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && checkCustomPermission()}
                />
                <Button onClick={checkCustomPermission} variant="secondary">
                  Check
                </Button>
              </div>
              
              {checkResult !== null && (
                <div className={`p-3 rounded-md ${
                  checkResult 
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' 
                    : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                }`}>
                  <div className="flex items-center gap-2">
                    {checkResult 
                      ? <Check className="h-5 w-5" /> 
                      : <X className="h-5 w-5" />
                    }
                    <span>
                      Permission <strong>{customPermission}</strong> is {checkResult ? 'granted' : 'denied'} for role {debugInfo.role}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="text-sm text-muted-foreground">
                <p>Common permissions to check:</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {['ACCESS_ADMIN', 'MANAGE_USERS', 'VIEW_REPORTS', 'APPROVE_REPORTS'].map(perm => (
                    <Badge 
                      key={perm} 
                      variant="outline" 
                      className="cursor-pointer hover:bg-secondary"
                      onClick={() => {
                        setCustomPermission(perm);
                        setCheckResult(hasPermission(perm));
                      }}
                    >
                      {perm}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </TabsContent>
        
        <TabsContent value="user">
          <CardContent className="pt-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">User</p>
                  <p className="text-sm">{debugInfo.user?.name || 'Not authenticated'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm">{debugInfo.user?.email || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Role</p>
                  <p className="text-sm">{debugInfo.role || 'None'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Branch ID</p>
                  <p className="text-sm">{debugInfo.user?.branchId || 'None'}</p>
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-medium">Role Checks</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(UserRole).map(role => (
                    <div 
                      key={role}
                      className={`p-2 rounded-md text-sm ${
                        hasRole(role) 
                          ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' 
                          : 'bg-gray-50 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        {hasRole(role) ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        {role}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </TabsContent>
        
        <TabsContent value="all">
          <CardContent className="pt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search permissions..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <ScrollArea className="h-[300px]">
                {Object.entries(groupedPermissions).map(([category, permissions]) => (
                  permissions.length > 0 && (
                    <div key={category} className="mb-4">
                      <h3 className="text-sm font-medium mb-2">{category} ({permissions.length})</h3>
                      <div className="space-y-1">
                        {permissions.map(permission => (
                          <div 
                            key={permission}
                            className={`p-2 rounded-md text-sm ${
                              hasPermission(permission) 
                                ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' 
                                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                {hasPermission(permission) 
                                  ? <Check className="h-3 w-3" /> 
                                  : <X className="h-3 w-3" />
                                }
                                {permission}
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  setCustomPermission(permission);
                                  setCheckResult(hasPermission(permission));
                                }}
                              >
                                <Info className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ))}
              </ScrollArea>
            </div>
          </CardContent>
        </TabsContent>
      </Tabs>
      
      <CardFooter className="bg-yellow-50 dark:bg-yellow-900/20 text-xs text-muted-foreground">
        <p>This component is only visible in development mode</p>
      </CardFooter>
    </Card>
  );
}
