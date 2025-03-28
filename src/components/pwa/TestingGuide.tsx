'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function TestingGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How to Test Role-Based Notifications</CardTitle>
        <CardDescription>
          Follow these steps to test notifications with different user accounts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger>Step 1: Prepare User Accounts</AccordionTrigger>
            <AccordionContent>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Ensure you have accounts with different roles (admin, manager, approver, regular user)</li>
                <li>Make sure these accounts are assigned to appropriate branches</li>
                <li>You can use your admin account to set up user roles if needed</li>
              </ol>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-2">
            <AccordionTrigger>Step 2: Subscribe Each Account</AccordionTrigger>
            <AccordionContent>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Log in with the first user account</li>
                <li>Navigate to the dashboard</li>
                <li>Use the <strong>Notification Settings</strong> panel to <strong>Subscribe</strong></li>
                <li>When prompted by your browser, allow notifications</li>
                <li>Log out</li>
                <li>Repeat these steps for each user account you want to test</li>
              </ol>
              <div className="mt-2 p-2 bg-blue-50 text-blue-700 rounded border border-blue-200">
                <strong>Tip:</strong> Use different browsers or private/incognito windows for each user account to keep them all logged in simultaneously.
              </div>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-3">
            <AccordionTrigger>Step 3: Send Test Notifications</AccordionTrigger>
            <AccordionContent>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Log in with an admin or test account</li>
                <li>Navigate to the dashboard</li>
                <li>Use the <strong>Test Role-Based Notifications</strong> panel</li>
                <li>Fill in relevant test data (branch IDs, report IDs should match real data in your system)</li>
                <li>Send different types of notifications</li>
                <li>Observe which users receive which notifications based on their roles</li>
              </ol>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-4">
            <AccordionTrigger>Step 4: Verify Notification Actions</AccordionTrigger>
            <AccordionContent>
              <ol className="list-decimal pl-5 space-y-2">
                <li>When notifications appear, try clicking different action buttons</li>
                <li>Verify that you are taken to the correct page</li>
                <li>Test actions like "Approve," "View Details," and "Reply"</li>
                <li>Confirm that the notification properly handles the action</li>
              </ol>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-5">
            <AccordionTrigger>Troubleshooting</AccordionTrigger>
            <AccordionContent>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>No notifications appearing:</strong> Check that your browser allows notifications and that you've subscribed with the Subscribe button.</li>
                <li><strong>Wrong users getting notifications:</strong> Verify user roles and branch assignments in your database.</li>
                <li><strong>Actions not working:</strong> Ensure the service worker is registered properly and URLs in notification actions are correct.</li>
                <li><strong>Console errors:</strong> Check browser console for any error messages related to push notifications.</li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
} 