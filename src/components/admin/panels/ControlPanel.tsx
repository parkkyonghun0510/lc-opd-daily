"use client";

import { useState, useEffect } from "react";

interface ControlPanelProps {
  onSettingsChanged?: () => void;
}

export function ControlPanel({ onSettingsChanged }: ControlPanelProps) {
  // Alert settings
  const [alertSettings, setAlertSettings] = useState({
    enabled: true,
    activeConnectionsThreshold: 1000,
    peakConnectionsThreshold: 2000,
    errorRateThreshold: 5,
    avgProcessingTimeThreshold: 100,
  });

  // Rate limit settings
  const [rateLimitSettings, setRateLimitSettings] = useState({
    enabled: true,
    limit: 5,
    window: 60,
  });

  // SSE settings
  const [sseSettings, setSSESettings] = useState({
    inactiveTimeout: 300, // 5 minutes in seconds
    pingInterval: 30, // 30 seconds
    maxConnectionsPerUser: 3,
  });

  // Load settings
  useEffect(() => {
    // In a real implementation, this would load settings from an API
    // For now, we'll just use the default values
  }, []);

  // Save alert settings
  const saveAlertSettings = async () => {
    try {
      // In a real implementation, this would save settings to an API
      // For now, we'll just show a success message
      window.alert("Alert settings saved successfully");

      if (onSettingsChanged) {
        onSettingsChanged();
      }
    } catch (error) {
      console.error("Error saving alert settings:", error);
      window.alert("Error saving alert settings");
    }
  };

  // Save rate limit settings
  const saveRateLimitSettings = async () => {
    try {
      // In a real implementation, this would save settings to an API
      // For now, we'll just show a success message
      window.alert("Rate limit settings saved successfully");

      if (onSettingsChanged) {
        onSettingsChanged();
      }
    } catch (error) {
      console.error("Error saving rate limit settings:", error);
      window.alert("Error saving rate limit settings");
    }
  };

  // Save SSE settings
  const saveSSESettings = async () => {
    try {
      // In a real implementation, this would save settings to an API
      // For now, we'll just show a success message
      window.alert("SSE settings saved successfully");

      if (onSettingsChanged) {
        onSettingsChanged();
      }
    } catch (error) {
      console.error("Error saving SSE settings:", error);
      window.alert("Error saving SSE settings");
    }
  };

  // Reset metrics
  const resetMetrics = async () => {
    try {
      // In a real implementation, this would call an API to reset metrics
      // For now, we'll just show a success message
      window.alert("Metrics reset successfully");

      if (onSettingsChanged) {
        onSettingsChanged();
      }
    } catch (error) {
      console.error("Error resetting metrics:", error);
      window.alert("Error resetting metrics");
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Settings */}
      <div className="p-4 bg-white dark:bg-gray-700 rounded shadow">
        <h3 className="text-lg font-semibold mb-4">Alert Settings</h3>

        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="alert-enabled"
              checked={alertSettings.enabled}
              onChange={(e) =>
                setAlertSettings({
                  ...alertSettings,
                  enabled: e.target.checked,
                })
              }
              className="mr-2"
            />
            <label htmlFor="alert-enabled" className="font-medium">
              Enable Alerts
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="active-connections-threshold"
                className="block text-sm font-medium mb-1"
              >
                Active Connections Threshold
              </label>
              <input
                type="number"
                id="active-connections-threshold"
                value={alertSettings.activeConnectionsThreshold}
                onChange={(e) =>
                  setAlertSettings({
                    ...alertSettings,
                    activeConnectionsThreshold: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border rounded"
                min="1"
              />
            </div>

            <div>
              <label
                htmlFor="peak-connections-threshold"
                className="block text-sm font-medium mb-1"
              >
                Peak Connections Threshold
              </label>
              <input
                type="number"
                id="peak-connections-threshold"
                value={alertSettings.peakConnectionsThreshold}
                onChange={(e) =>
                  setAlertSettings({
                    ...alertSettings,
                    peakConnectionsThreshold: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border rounded"
                min="1"
              />
            </div>

            <div>
              <label
                htmlFor="error-rate-threshold"
                className="block text-sm font-medium mb-1"
              >
                Error Rate Threshold (%)
              </label>
              <input
                type="number"
                id="error-rate-threshold"
                value={alertSettings.errorRateThreshold}
                onChange={(e) =>
                  setAlertSettings({
                    ...alertSettings,
                    errorRateThreshold: parseFloat(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border rounded"
                min="0.1"
                max="100"
                step="0.1"
              />
            </div>

            <div>
              <label
                htmlFor="avg-processing-time-threshold"
                className="block text-sm font-medium mb-1"
              >
                Avg Processing Time Threshold (ms)
              </label>
              <input
                type="number"
                id="avg-processing-time-threshold"
                value={alertSettings.avgProcessingTimeThreshold}
                onChange={(e) =>
                  setAlertSettings({
                    ...alertSettings,
                    avgProcessingTimeThreshold: parseFloat(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border rounded"
                min="1"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={saveAlertSettings}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Save Alert Settings
            </button>
          </div>
        </div>
      </div>

      {/* Rate Limit Settings */}
      <div className="p-4 bg-white dark:bg-gray-700 rounded shadow">
        <h3 className="text-lg font-semibold mb-4">Rate Limit Settings</h3>

        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="rate-limit-enabled"
              checked={rateLimitSettings.enabled}
              onChange={(e) =>
                setRateLimitSettings({
                  ...rateLimitSettings,
                  enabled: e.target.checked,
                })
              }
              className="mr-2"
            />
            <label htmlFor="rate-limit-enabled" className="font-medium">
              Enable Rate Limiting
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="rate-limit-limit"
                className="block text-sm font-medium mb-1"
              >
                Connection Limit (per user/IP)
              </label>
              <input
                type="number"
                id="rate-limit-limit"
                value={rateLimitSettings.limit}
                onChange={(e) =>
                  setRateLimitSettings({
                    ...rateLimitSettings,
                    limit: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border rounded"
                min="1"
              />
            </div>

            <div>
              <label
                htmlFor="rate-limit-window"
                className="block text-sm font-medium mb-1"
              >
                Time Window (seconds)
              </label>
              <input
                type="number"
                id="rate-limit-window"
                value={rateLimitSettings.window}
                onChange={(e) =>
                  setRateLimitSettings({
                    ...rateLimitSettings,
                    window: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border rounded"
                min="1"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={saveRateLimitSettings}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Save Rate Limit Settings
            </button>
          </div>
        </div>
      </div>

      {/* SSE Settings */}
      <div className="p-4 bg-white dark:bg-gray-700 rounded shadow">
        <h3 className="text-lg font-semibold mb-4">SSE Settings</h3>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="inactive-timeout"
                className="block text-sm font-medium mb-1"
              >
                Inactive Timeout (seconds)
              </label>
              <input
                type="number"
                id="inactive-timeout"
                value={sseSettings.inactiveTimeout}
                onChange={(e) =>
                  setSSESettings({
                    ...sseSettings,
                    inactiveTimeout: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border rounded"
                min="30"
              />
            </div>

            <div>
              <label
                htmlFor="ping-interval"
                className="block text-sm font-medium mb-1"
              >
                Ping Interval (seconds)
              </label>
              <input
                type="number"
                id="ping-interval"
                value={sseSettings.pingInterval}
                onChange={(e) =>
                  setSSESettings({
                    ...sseSettings,
                    pingInterval: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border rounded"
                min="5"
              />
            </div>

            <div>
              <label
                htmlFor="max-connections-per-user"
                className="block text-sm font-medium mb-1"
              >
                Max Connections Per User
              </label>
              <input
                type="number"
                id="max-connections-per-user"
                value={sseSettings.maxConnectionsPerUser}
                onChange={(e) =>
                  setSSESettings({
                    ...sseSettings,
                    maxConnectionsPerUser: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border rounded"
                min="1"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={saveSSESettings}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Save SSE Settings
            </button>
          </div>
        </div>
      </div>

      {/* Admin Actions */}
      <div className="p-4 bg-white dark:bg-gray-700 rounded shadow">
        <h3 className="text-lg font-semibold mb-4">Admin Actions</h3>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={resetMetrics}
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              Reset Metrics
            </button>

            <button
              onClick={() =>
                window.alert(
                  "This would disconnect all clients in a real implementation",
                )
              }
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Disconnect All Clients
            </button>
          </div>

          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded text-sm">
            <p className="font-medium">Warning:</p>
            <p>
              These actions affect all connected clients and cannot be undone.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
