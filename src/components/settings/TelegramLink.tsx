'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from "@/components/ui/use-toast";
import { Loader2, Link as LinkIcon, Unlink, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TelegramSubscription {
    id: string;
    chatId: string;
    username: string | null;
    createdAt: string;
}

export function TelegramLink() {
  const [subscription, setSubscription] = useState<TelegramSubscription | null>(null);
  const [isLinked, setIsLinked] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscriptionStatus();
  }, []);

  async function fetchSubscriptionStatus() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/users/me/telegram/subscription');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch status');
      }
      setIsLinked(data.linked);
      setSubscription(data.subscription || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setIsLinked(null); // Indicate indeterminate state on error
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLinkTelegram() {
    setIsGeneratingLink(true);
    setGeneratedLink(null);
    setError(null);
    try {
      const response = await fetch('/api/users/me/telegram/generate-link', {
        method: 'POST'
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate link');
      }
      setGeneratedLink(data.telegramLink);
      toast({
        title: "Link Generated",
        description: "Click the button below or open the link in Telegram to complete.",
      });
      // Optionally open immediately: window.open(data.telegramLink, '_blank');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      toast({
        title: "Error Generating Link",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingLink(false);
    }
  }

  async function handleUnlinkTelegram() {
    setIsUnlinking(true);
    setError(null);
    try {
      const response = await fetch('/api/users/me/telegram/subscription', {
        method: 'DELETE'
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to unlink');
      }
      setIsLinked(false);
      setSubscription(null);
      setGeneratedLink(null); // Clear generated link if present
      toast({
        title: "Success",
        description: "Telegram account unlinked successfully.",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      toast({
        title: "Error Unlinking",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUnlinking(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Telegram Notifications</CardTitle>
        <CardDescription>
          Link your Telegram account to receive important notifications directly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading status...</span>
          </div>
        )}

        {!isLoading && isLinked === false && (
          <div className="space-y-3">
            <Alert variant="default">
              <LinkIcon className="h-4 w-4" />
              <AlertDescription>
                Your account is not currently linked to Telegram.
              </AlertDescription>
            </Alert>
            {!generatedLink && (
                <Button 
                    onClick={handleLinkTelegram} 
                    disabled={isGeneratingLink}
                >
                {isGeneratingLink ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Link...</>
                ) : (
                    <><LinkIcon className="mr-2 h-4 w-4" /> Link Telegram Account</>
                )}
                </Button>
            )}
            {generatedLink && (
              <Alert variant="default" className="border-green-500 bg-green-50 dark:bg-green-950/20 dark:border-green-500/30">
                <ExternalLink className="h-4 w-4 text-green-500" />
                <AlertDescription className='flex flex-col sm:flex-row sm:items-center sm:gap-3'>
                  <span>Click the button, then press "Start" in Telegram:</span>
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(generatedLink, '_blank')}
                  >
                    Open Telegram Link <ExternalLink className="ml-1 h-3 w-3" />
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {!isLoading && isLinked === true && subscription && (
          <div className="space-y-3">
             <Alert variant="default" className="border-green-500 bg-green-50 dark:bg-green-950/20 dark:border-green-500/30">
              <LinkIcon className="h-4 w-4 text-green-500" />
              <AlertDescription>
                Your account is linked to Telegram {subscription.username ? `@${subscription.username}` : ''}.
                (Linked on: {new Date(subscription.createdAt).toLocaleDateString()})
              </AlertDescription>
            </Alert>
            <Button 
              variant="destructive"
              onClick={handleUnlinkTelegram}
              disabled={isUnlinking}
            >
              {isUnlinking ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Unlinking...</>
              ) : (
                  <><Unlink className="mr-2 h-4 w-4" /> Unlink Telegram</>
              )}
            </Button>
          </div>
        )}

        {!isLoading && error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
} 