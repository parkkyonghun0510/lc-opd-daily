"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Send, Users, ListTree, Building } from "lucide-react";
import { NotificationType } from "@/utils/notificationTemplates";

export function TestHierarchyNotifications() {
  const [branches, setBranches] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [notificationType, setNotificationType] = useState<string>("SYSTEM_NOTIFICATION");
  const [includeSubBranches, setIncludeSubBranches] = useState(false);
  const [includeParentBranches, setIncludeParentBranches] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(true);

  // Fetch branches on component mount
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await fetch('/api/branches');
        if (response.ok) {
          const data = await response.json();
          setBranches(data || []);
        } else {
          console.error('Failed to fetch branches');
          toast({
            title: "Error",
            description: "Failed to load branches",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error fetching branches:', error);
        toast({
          title: "Error",
          description: "Failed to load branches",
          variant: "destructive",
        });
      } finally {
        setLoadingBranches(false);
      }
    };

    fetchBranches();
  }, []);

  // Available notification types
  const notificationTypes = [
    { value: "SYSTEM_NOTIFICATION", label: "System Notification" },
    { value: "REPORT_SUBMITTED", label: "Report Submitted" },
    { value: "REPORT_APPROVED", label: "Report Approved" },
    { value: "REPORT_REJECTED", label: "Report Rejected" },
    { value: "REPORT_NEEDS_REVISION", label: "Report Needs Revision" },
    { value: "APPROVAL_PENDING", label: "Approval Pending" },
    { value: "REPORT_REMINDER", label: "Report Reminder" },
    { value: "REPORT_OVERDUE", label: "Report Overdue" },
    { value: "COMMENT_ADDED", label: "Comment Added" }
  ];

  // Send test notification
  const sendTestNotification = async () => {
    if (!selectedBranch) {
      toast({
        title: "Validation Error",
        description: "Please select a branch",
        variant: "destructive",
      });
      return;
    }

    if (!notificationType) {
      toast({
        title: "Validation Error",
        description: "Please select a notification type",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      
      const response = await fetch('/api/push/test-hierarchy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branchId: selectedBranch,
          notificationType,
          includeSubBranches,
          includeParentBranches,
          message: message || `Test notification: ${notificationType}`
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send test notification');
      }

      const result = await response.json();
      
      toast({
        title: "Notification Sent",
        description: `Notification sent to ${result.stats.targetUsers} users`,
      });
      
      // Reset fields
      setMessage("");
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to send test notification',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <ListTree className="mr-2 h-5 w-5" />
          Test Branch Hierarchy Notifications
        </CardTitle>
        <CardDescription>
          Send test notifications using branch hierarchy to verify notification targeting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Branch selection */}
        <div className="space-y-2">
          <Label htmlFor="branch">Branch</Label>
          <Select 
            value={selectedBranch} 
            onValueChange={setSelectedBranch}
            disabled={loadingBranches}
          >
            <SelectTrigger id="branch" className="w-full">
              <SelectValue placeholder={loadingBranches ? "Loading branches..." : "Select branch"} />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name} ({branch.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Notification type selection */}
        <div className="space-y-2">
          <Label htmlFor="notificationType">Notification Type</Label>
          <Select 
            value={notificationType} 
            onValueChange={setNotificationType}
          >
            <SelectTrigger id="notificationType" className="w-full">
              <SelectValue placeholder="Select notification type" />
            </SelectTrigger>
            <SelectContent>
              {notificationTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Hierarchy options */}
        <div className="space-y-4 pt-2">
          <Label>Hierarchy Options</Label>
          <div className="flex flex-col space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="includeSubBranches" 
                checked={includeSubBranches}
                onCheckedChange={(checked) => setIncludeSubBranches(checked === true)}
              />
              <Label htmlFor="includeSubBranches" className="cursor-pointer flex items-center">
                <Building className="mr-1 h-4 w-4" />
                Include Sub-Branches
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="includeParentBranches" 
                checked={includeParentBranches}
                onCheckedChange={(checked) => setIncludeParentBranches(checked === true)}
              />
              <Label htmlFor="includeParentBranches" className="cursor-pointer flex items-center">
                <Building className="mr-1 h-4 w-4" />
                Include Parent Branches
              </Label>
            </div>
          </div>
        </div>

        {/* Custom message */}
        <div className="space-y-2">
          <Label htmlFor="message">Custom Message (optional)</Label>
          <Textarea 
            id="message" 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter a custom notification message"
            className="min-h-[80px]"
          />
        </div>

        {/* Submit button */}
        <Button 
          onClick={sendTestNotification} 
          disabled={isLoading || !selectedBranch || !notificationType}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send Test Notification
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
} 