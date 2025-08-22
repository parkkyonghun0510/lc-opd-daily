"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Search, Filter, Download, Calendar, User, Activity } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";

interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: Record<string, any>;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  type: string;
}

export default function AdminAuditPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  // Mock audit data for demonstration
  useEffect(() => {
    const mockAuditLogs: AuditLog[] = [
      {
        id: "1",
        userId: "user-1",
        userName: "Admin User",
        action: "REPORT_APPROVED",
        details: {
          reportId: "report-123",
          branchName: "Main Branch",
          reportType: "Daily Report"
        },
        timestamp: new Date().toISOString(),
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0...",
        type: "userActivity"
      },
      {
        id: "2",
        userId: "user-2",
        userName: "Manager User",
        action: "USER_LOGIN",
        details: {
          loginMethod: "credentials",
          success: true
        },
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        ipAddress: "192.168.1.2",
        userAgent: "Mozilla/5.0...",
        type: "authentication"
      },
      {
        id: "3",
        userId: "user-3",
        userName: "Branch User",
        action: "REPORT_CREATED",
        details: {
          reportId: "report-124",
          branchName: "Branch A",
          reportType: "Weekly Report"
        },
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        ipAddress: "192.168.1.3",
        userAgent: "Mozilla/5.0...",
        type: "userActivity"
      },
      {
        id: "4",
        userId: "user-1",
        userName: "Admin User",
        action: "USER_CREATED",
        details: {
          newUserId: "user-4",
          newUserName: "New Employee",
          role: "USER"
        },
        timestamp: new Date(Date.now() - 10800000).toISOString(),
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0...",
        type: "userManagement"
      },
      {
        id: "5",
        userId: "user-2",
        userName: "Manager User",
        action: "NOTIFICATION_SENT",
        details: {
          notificationType: "REPORT_APPROVAL_REQUEST",
          recipientCount: 3
        },
        timestamp: new Date(Date.now() - 14400000).toISOString(),
        ipAddress: "192.168.1.2",
        userAgent: "Mozilla/5.0...",
        type: "system"
      }
    ];

    setTimeout(() => {
      setAuditLogs(mockAuditLogs);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = 
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    const matchesType = typeFilter === "all" || log.type === typeFilter;
    
    return matchesSearch && matchesAction && matchesType;
  });

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case "USER_LOGIN":
      case "USER_LOGOUT":
        return "default";
      case "REPORT_APPROVED":
      case "REPORT_CREATED":
        return "default";
      case "REPORT_REJECTED":
        return "destructive";
      case "USER_CREATED":
      case "USER_UPDATED":
        return "secondary";
      case "NOTIFICATION_SENT":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case "authentication":
        return "default";
      case "userActivity":
        return "secondary";
      case "userManagement":
        return "outline";
      case "system":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const handleExport = () => {
    toast({
      title: "Export Started",
      description: "Audit logs are being prepared for download.",
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Audit Logs
        </h1>
        <p className="text-muted-foreground mt-2">
          Monitor system activities, user actions, and security events
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity Overview
            </CardTitle>
            <CardDescription>
              Recent system activity and security metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{auditLogs.length}</div>
                <div className="text-sm text-muted-foreground">Total Events</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {auditLogs.filter(log => log.type === "authentication").length}
                </div>
                <div className="text-sm text-muted-foreground">Auth Events</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {auditLogs.filter(log => log.type === "userActivity").length}
                </div>
                <div className="text-sm text-muted-foreground">User Actions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {auditLogs.filter(log => log.type === "system").length}
                </div>
                <div className="text-sm text-muted-foreground">System Events</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit Log Filters</CardTitle>
            <CardDescription>
              Filter and search through audit logs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="USER_LOGIN">User Login</SelectItem>
                  <SelectItem value="REPORT_APPROVED">Report Approved</SelectItem>
                  <SelectItem value="REPORT_CREATED">Report Created</SelectItem>
                  <SelectItem value="USER_CREATED">User Created</SelectItem>
                  <SelectItem value="NOTIFICATION_SENT">Notification Sent</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="authentication">Authentication</SelectItem>
                  <SelectItem value="userActivity">User Activity</SelectItem>
                  <SelectItem value="userManagement">User Management</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Detailed audit log entries ({filteredLogs.length} entries)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-2">Loading audit logs...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(log.timestamp), "MMM dd, HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {log.userName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getActionBadgeVariant(log.action)}>
                            {log.action.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getTypeBadgeVariant(log.type)}>
                            {log.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="text-sm text-muted-foreground truncate">
                            {Object.entries(log.details).map(([key, value]) => (
                              <div key={key}>
                                <span className="font-medium">{key}:</span> {String(value)}
                              </div>
                            )).slice(0, 2)}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {log.ipAddress}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Security Information:</strong> Audit logs are automatically generated for all user actions, 
            authentication events, and system activities. Logs are retained for compliance and security monitoring purposes.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}