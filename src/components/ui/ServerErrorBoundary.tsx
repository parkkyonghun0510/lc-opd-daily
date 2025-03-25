import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ServerErrorBoundaryProps {
  error: string | null;
  onRetry?: () => void;
  persistentError?: boolean;
  onClearSession?: () => void;
}

export function ServerErrorBoundary({ 
  error, 
  onRetry, 
  persistentError = false,
  onClearSession 
}: ServerErrorBoundaryProps) {
  if (!error) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border rounded-lg shadow-lg max-w-md w-full p-6">
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Server Connection Error</AlertTitle>
          <AlertDescription>
            {error}
            {persistentError && (
              <p className="mt-2 text-sm">
                This issue appears to be persistent. You may need to clear your session data to resolve it.
              </p>
            )}
          </AlertDescription>
        </Alert>
        
        <div className="flex justify-end gap-2">
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </Button>
          
          {onRetry && (
            <Button 
              variant="default" 
              onClick={onRetry}
            >
              Retry Connection
            </Button>
          )}
          
          {persistentError && onClearSession && (
            <Button 
              variant="destructive" 
              onClick={onClearSession}
            >
              Clear Session Data
            </Button>
          )}
        </div>
      </div>
    </div>
  );
} 