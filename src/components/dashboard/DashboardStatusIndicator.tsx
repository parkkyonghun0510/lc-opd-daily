"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useDashboardStore } from "@/stores/dashboardStore";

// Completely rewritten component to avoid using hooks that might cause infinite loops
export default function DashboardStatusIndicator() {
  // Get state directly from the store instead of using hooks
  const store = useDashboardStore();

  // Extract only the values we need
  const isConnected = store.isConnected;
  const connectionMethod = store.connectionMethod;
  const connectionError = store.connectionError;
  const isLoading = store.isLoading;

  // Define handlers that call store methods directly
  const handleRefresh = () => {
    const role = "USER"; // Default role if we can't get it
    store.refreshDashboardData(role);
  };

  const handleReconnect = () => {
    // Dispatch a custom event that the SSE component can listen for
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("sse-reconnect-requested"));
    }
  };

  // Render the component with static values
  return (
    <div className="flex items-center space-x-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center">
              {isConnected ? (
                <Badge
                  variant="outline"
                  className="bg-green-50 text-green-700 border-green-200 flex items-center"
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Connected
                  {connectionMethod && (
                    <span className="ml-1 text-xs text-green-600">
                      ({connectionMethod})
                    </span>
                  )}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-red-50 text-red-700 border-red-200 flex items-center"
                >
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Disconnected
                </Badge>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-2 max-w-xs">
              <p className="font-semibold">Dashboard Connection Status</p>
              <div className="text-sm">
                {isConnected ? (
                  <div className="flex items-center text-green-600">
                    <Wifi className="w-4 h-4 mr-1" />
                    Connected using {connectionMethod || "unknown"} method
                  </div>
                ) : (
                  <div className="flex items-center text-red-600">
                    <WifiOff className="w-4 h-4 mr-1" />
                    Not connected to real-time updates
                  </div>
                )}
              </div>
              {connectionError && (
                <div className="text-xs text-red-600 mt-1">
                  Error: {connectionError}
                </div>
              )}
              <div className="pt-2 flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReconnect}
                  disabled={isLoading}
                  className="text-xs h-7 px-2"
                >
                  Reconnect
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="text-xs h-7 px-2"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Refresh
                </Button>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
