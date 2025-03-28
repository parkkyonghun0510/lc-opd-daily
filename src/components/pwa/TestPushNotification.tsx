'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { NotificationType } from '@/utils/notificationTemplates';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export function TestPushNotification() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [reportSubmitted, setReportSubmitted] = useState({
    branchId: 'cm8py14ft0007tq902rg41dxg',
    branchName: 'សាខា ព្រះវិហារ',
    date: new Date().toISOString().split('T')[0],
    reportId: 'report-1',
    id: ''
  });

  const [reportStatus, setReportStatus] = useState({
    reportId: 'report-1',
    date: '2023-03-26'
  });

  const [approvalPending, setApprovalPending] = useState({
    count: 5
  });

  const [commentAdded, setCommentAdded] = useState({
    reportId: 'report-1',
    date: '2023-03-26',
    commenter: 'John Doe',
    commentId: 'comment-1',
    commenterId: 'user-1'
  });

  const sendNotification = async (type: NotificationType, data: any) => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, data }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send notification');
      }

      toast({
        title: 'Success',
        description: `Notification sent: ${result.stats.push?.successful ?? 0} push, ${result.stats.inApp?.created ?? 0} in-app`,
      });
      
      return result;
    } catch (error) {
      console.error('Error sending notification:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send notification',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Test Role-Based Notifications</CardTitle>
        <CardDescription>
          Send targeted notifications to users based on their roles and relationships
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="report-submitted">
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="report-submitted">Submitted</TabsTrigger>
            <TabsTrigger value="report-status">Status</TabsTrigger>
            <TabsTrigger value="approval">Approval</TabsTrigger>
            <TabsTrigger value="comment">Comment</TabsTrigger>
          </TabsList>
          
          <TabsContent value="report-submitted" className="space-y-4">
            <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md border border-amber-200 mb-2">
              <strong>Note:</strong> For proper targeting, enter valid data from your database. 
              If user ID is provided, that user will always be notified regardless of role.
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="branchId">Branch ID</Label>
                <Input 
                  id="branchId" 
                  value={reportSubmitted.branchId}
                  onChange={(e) => setReportSubmitted({...reportSubmitted, branchId: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branchName">Branch Name</Label>
                <Input 
                  id="branchName" 
                  value={reportSubmitted.branchName}
                  onChange={(e) => setReportSubmitted({...reportSubmitted, branchName: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input 
                  id="date" 
                  value={reportSubmitted.date}
                  onChange={(e) => setReportSubmitted({...reportSubmitted, date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reportId">Report ID</Label>
                <Input 
                  id="reportId" 
                  value={reportSubmitted.reportId}
                  onChange={(e) => setReportSubmitted({...reportSubmitted, reportId: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userId">User ID (Optional)</Label>
                <Input 
                  id="userId" 
                  value={reportSubmitted.id}
                  onChange={(e) => setReportSubmitted({...reportSubmitted, id: e.target.value})}
                  placeholder="User ID to notify directly"
                />
              </div>
            </div>
            <Button 
              onClick={() => sendNotification(NotificationType.REPORT_SUBMITTED, reportSubmitted)}
              disabled={isLoading}
              className="w-full mt-4"
            >
              {isLoading ? 'Sending...' : 'Send Report Submitted Notification'}
            </Button>
            <div className="text-xs text-muted-foreground mt-2">
              This will notify managers and approvers for the specified branch
            </div>
          </TabsContent>
          
          <TabsContent value="report-status" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="statusReportId">Report ID</Label>
                <Input 
                  id="statusReportId" 
                  value={reportStatus.reportId}
                  onChange={(e) => setReportStatus({...reportStatus, reportId: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="statusDate">Date</Label>
                <Input 
                  id="statusDate" 
                  value={reportStatus.date}
                  onChange={(e) => setReportStatus({...reportStatus, date: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <Button 
                onClick={() => sendNotification(NotificationType.REPORT_APPROVED, reportStatus)}
                disabled={isLoading}
                variant="outline"
              >
                Approved
              </Button>
              <Button 
                onClick={() => sendNotification(NotificationType.REPORT_REJECTED, reportStatus)}
                disabled={isLoading}
                variant="outline"
              >
                Rejected
              </Button>
              <Button 
                onClick={() => sendNotification(NotificationType.REPORT_NEEDS_REVISION, reportStatus)}
                disabled={isLoading}
                variant="outline"
              >
                Needs Revision
              </Button>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              These notifications will go to the report submitter and branch managers
            </div>
          </TabsContent>
          
          <TabsContent value="approval" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="count">Pending Count</Label>
              <Input 
                id="count" 
                type="number"
                value={approvalPending.count}
                onChange={(e) => setApprovalPending({...approvalPending, count: parseInt(e.target.value)})}
              />
            </div>
            <Button 
              onClick={() => sendNotification(NotificationType.APPROVAL_PENDING, approvalPending)}
              disabled={isLoading}
              className="w-full mt-4"
            >
              {isLoading ? 'Sending...' : 'Send Approval Pending Notification'}
            </Button>
            <div className="text-xs text-muted-foreground mt-2">
              This will notify all users with approval permissions
            </div>
          </TabsContent>
          
          <TabsContent value="comment" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="commentReportId">Report ID</Label>
                <Input 
                  id="commentReportId" 
                  value={commentAdded.reportId}
                  onChange={(e) => setCommentAdded({...commentAdded, reportId: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commentDate">Date</Label>
                <Input 
                  id="commentDate" 
                  value={commentAdded.date}
                  onChange={(e) => setCommentAdded({...commentAdded, date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commenter">Commenter</Label>
                <Input 
                  id="commenter" 
                  value={commentAdded.commenter}
                  onChange={(e) => setCommentAdded({...commentAdded, commenter: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commenterId">Commenter ID</Label>
                <Input 
                  id="commenterId" 
                  value={commentAdded.commenterId}
                  onChange={(e) => setCommentAdded({...commentAdded, commenterId: e.target.value})}
                />
              </div>
            </div>
            <Button 
              onClick={() => sendNotification(NotificationType.COMMENT_ADDED, commentAdded)}
              disabled={isLoading}
              className="w-full mt-4"
            >
              {isLoading ? 'Sending...' : 'Send Comment Notification'}
            </Button>
            <div className="text-xs text-muted-foreground mt-2">
              This will notify all users involved with this report except the commenter
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 