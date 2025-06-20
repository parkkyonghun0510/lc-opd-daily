"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Send } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function SystemUpdateForm() {
  const [title, setTitle] = useState("System Update");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    if (!message.trim()) {
      setError("Message cannot be empty.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/system-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim() || "System Update", // Ensure title isn't empty string
          message: message.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send system update");
      }

      setSuccessMessage(data.message || "System update sent successfully!");
      setMessage(""); // Clear message field on success
      toast({
        title: "Success",
        description: data.message || "System update notification queued.",
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred";
      setError(errorMessage);
      toast({
        title: "Error Sending Update",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send System Update Notification</CardTitle>
        <CardDescription>
          Send a notification to all active users. This will trigger both in-app
          and Telegram notifications (if linked).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="system-update-title">Title (Optional)</Label>
            <Input
              id="system-update-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="System Update"
              maxLength={100}
            />
          </div>
          <div>
            <Label htmlFor="system-update-message">Message</Label>
            <Textarea
              id="system-update-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter the system update message here..."
              required
              rows={5}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {successMessage && (
            <Alert variant="default">
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={isLoading || !message.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" /> Send Notification
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
