"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ConnectionsChart } from "./charts/ConnectionsChart";
import { EventsChart } from "./charts/EventsChart";
import { ErrorsChart } from "./charts/ErrorsChart";
import { PerformanceChart } from "./charts/PerformanceChart";
import { UserConnectionsTable } from "./tables/UserConnectionsTable";
import { EventTypesTable } from "./tables/EventTypesTable";
import { AlertsPanel } from "./panels/AlertsPanel";
import { ControlPanel } from "./panels/ControlPanel";

/**
 * SSE Admin Dashboard
 *
 * This component provides a comprehensive dashboard for monitoring
 * SSE connections, events, errors, and performance.
 */
export default function SSEDashboard() {
  const { data: session } = useSession();
  const [metrics, setMetrics] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(10000); // 10 seconds
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "connections"
    | "events"
    | "errors"
    | "performance"
    | "alerts"
    | "control"
  >("overview");

  // Check if the user is an admin
  const isAdmin =
    session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";

  // Fetch SSE metrics
  const fetchMetrics = useCallback(async () => {
    if (!isAdmin) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/admin/sse-metrics");

      if (!response.ok) {
        throw new Error(
          `Error fetching SSE metrics: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      setMetrics(data.metrics);
    } catch (err) {
      console.error("Error fetching SSE metrics:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  // Fetch SSE stats
  const fetchStats = useCallback(async () => {
    if (!isAdmin) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/admin/sse-monitor");

      if (!response.ok) {
        throw new Error(
          `Error fetching SSE stats: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      setStats(data.stats);
    } catch (err) {
      console.error("Error fetching SSE stats:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  // Fetch SSE alerts
  const fetchAlerts = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const response = await fetch("/api/admin/sse-alerts");

      if (!response.ok) {
        throw new Error(
          `Error fetching SSE alerts: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      console.error("Error fetching SSE alerts:", err);
    }
  }, [isAdmin]);

  // Fetch all data
  const fetchData = useCallback(() => {
    fetchMetrics();
    fetchStats();
    fetchAlerts();
  }, [fetchMetrics, fetchStats, fetchAlerts]);

  // Set up auto-refresh
  useEffect(() => {
    if (!isAdmin) return;

    // Initial fetch
    fetchData();

    // Set up auto-refresh interval
    let intervalId: NodeJS.Timeout | null = null;

    if (autoRefresh) {
      intervalId = setInterval(fetchData, refreshInterval);
    }

    // Clean up
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isAdmin, autoRefresh, refreshInterval, fetchData]);

  // If not admin, don't show anything
  if (!isAdmin) {
    return (
      <div className="p-4 bg-red-100 text-red-700 rounded">
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p>You do not have permission to access the SSE Admin Dashboard.</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">SSE Admin Dashboard</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label htmlFor="refresh-interval" className="text-sm">
              Refresh:
            </label>
            <select
              id="refresh-interval"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(parseInt(e.target.value, 10))}
              className="px-2 py-1 border rounded text-sm"
              disabled={!autoRefresh}
            >
              <option value="5000">5s</option>
              <option value="10000">10s</option>
              <option value="30000">30s</option>
              <option value="60000">1m</option>
            </select>
          </div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span>Auto-refresh</span>
          </label>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>
      )}

      {/* Tabs */}
      <div className="mb-4 border-b border-gray-200">
        <ul className="flex flex-wrap -mb-px">
          <li className="mr-2">
            <button
              className={`inline-block p-4 ${activeTab === "overview" ? "border-b-2 border-blue-500 text-blue-500" : "text-gray-500 hover:text-gray-700"}`}
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </button>
          </li>
          <li className="mr-2">
            <button
              className={`inline-block p-4 ${activeTab === "connections" ? "border-b-2 border-blue-500 text-blue-500" : "text-gray-500 hover:text-gray-700"}`}
              onClick={() => setActiveTab("connections")}
            >
              Connections
            </button>
          </li>
          <li className="mr-2">
            <button
              className={`inline-block p-4 ${activeTab === "events" ? "border-b-2 border-blue-500 text-blue-500" : "text-gray-500 hover:text-gray-700"}`}
              onClick={() => setActiveTab("events")}
            >
              Events
            </button>
          </li>
          <li className="mr-2">
            <button
              className={`inline-block p-4 ${activeTab === "errors" ? "border-b-2 border-blue-500 text-blue-500" : "text-gray-500 hover:text-gray-700"}`}
              onClick={() => setActiveTab("errors")}
            >
              Errors
            </button>
          </li>
          <li className="mr-2">
            <button
              className={`inline-block p-4 ${activeTab === "performance" ? "border-b-2 border-blue-500 text-blue-500" : "text-gray-500 hover:text-gray-700"}`}
              onClick={() => setActiveTab("performance")}
            >
              Performance
            </button>
          </li>
          <li className="mr-2">
            <button
              className={`inline-block p-4 ${activeTab === "alerts" ? "border-b-2 border-blue-500 text-blue-500" : "text-gray-500 hover:text-gray-700"}`}
              onClick={() => setActiveTab("alerts")}
            >
              Alerts
              {alerts.length > 0 && (
                <span className="ml-2 px-2 py-1 text-xs bg-red-500 text-white rounded-full">
                  {alerts.length}
                </span>
              )}
            </button>
          </li>
          <li className="mr-2">
            <button
              className={`inline-block p-4 ${activeTab === "control" ? "border-b-2 border-blue-500 text-blue-500" : "text-gray-500 hover:text-gray-700"}`}
              onClick={() => setActiveTab("control")}
            >
              Control Panel
            </button>
          </li>
        </ul>
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded shadow">
                <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                  Active Connections
                </h3>
                <p className="text-3xl font-bold">
                  {metrics?.connections?.active || stats?.localConnections || 0}
                </p>
              </div>
              <div className="p-4 bg-green-100 dark:bg-green-900 rounded shadow">
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                  Total Events
                </h3>
                <p className="text-3xl font-bold">
                  {metrics?.events?.total || 0}
                </p>
              </div>
              <div className="p-4 bg-red-100 dark:bg-red-900 rounded shadow">
                <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
                  Total Errors
                </h3>
                <p className="text-3xl font-bold">
                  {metrics?.errors?.total || 0}
                </p>
              </div>
              <div className="p-4 bg-purple-100 dark:bg-purple-900 rounded shadow">
                <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-200">
                  Avg Processing Time
                </h3>
                <p className="text-3xl font-bold">
                  {metrics?.performance?.averageEventProcessingTime?.toFixed(
                    2,
                  ) || "0.00"}{" "}
                  ms
                </p>
              </div>
            </div>

            {/* Mini Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-white dark:bg-gray-700 rounded shadow">
                <h3 className="text-lg font-semibold mb-2">Connections</h3>
                <ConnectionsChart metrics={metrics} height={200} />
              </div>
              <div className="p-4 bg-white dark:bg-gray-700 rounded shadow">
                <h3 className="text-lg font-semibold mb-2">Events</h3>
                <EventsChart metrics={metrics} height={200} />
              </div>
            </div>

            {/* Recent Alerts */}
            {alerts.length > 0 && (
              <div className="p-4 bg-white dark:bg-gray-700 rounded shadow">
                <h3 className="text-lg font-semibold mb-2">Recent Alerts</h3>
                <ul className="space-y-2">
                  {alerts.slice(0, 5).map((alert, index) => (
                    <li
                      key={index}
                      className="p-2 bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-200 rounded"
                    >
                      {alert}
                    </li>
                  ))}
                </ul>
                {alerts.length > 5 && (
                  <button
                    className="mt-2 text-blue-500 hover:underline"
                    onClick={() => setActiveTab("alerts")}
                  >
                    View all {alerts.length} alerts
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Connections Tab */}
        {activeTab === "connections" && (
          <div className="space-y-6">
            <div className="p-4 bg-white dark:bg-gray-700 rounded shadow">
              <h3 className="text-lg font-semibold mb-4">Connection Metrics</h3>
              <ConnectionsChart metrics={metrics} height={300} />
            </div>

            <div className="p-4 bg-white dark:bg-gray-700 rounded shadow">
              <h3 className="text-lg font-semibold mb-4">User Connections</h3>
              <UserConnectionsTable stats={stats} />
            </div>
          </div>
        )}

        {/* Events Tab */}
        {activeTab === "events" && (
          <div className="space-y-6">
            <div className="p-4 bg-white dark:bg-gray-700 rounded shadow">
              <h3 className="text-lg font-semibold mb-4">Event Metrics</h3>
              <EventsChart metrics={metrics} height={300} />
            </div>

            <div className="p-4 bg-white dark:bg-gray-700 rounded shadow">
              <h3 className="text-lg font-semibold mb-4">Event Types</h3>
              <EventTypesTable metrics={metrics} />
            </div>
          </div>
        )}

        {/* Errors Tab */}
        {activeTab === "errors" && (
          <div className="space-y-6">
            <div className="p-4 bg-white dark:bg-gray-700 rounded shadow">
              <h3 className="text-lg font-semibold mb-4">Error Metrics</h3>
              <ErrorsChart metrics={metrics} height={300} />
            </div>

            <div className="p-4 bg-white dark:bg-gray-700 rounded shadow">
              <h3 className="text-lg font-semibold mb-4">Error Types</h3>
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Error Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Count
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Percentage
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                  {metrics?.errors?.byType &&
                    Object.entries(metrics.errors.byType).map(
                      ([errorType, count]: [string, any]) => (
                        <tr key={errorType}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {errorType}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {count}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {metrics.errors.total > 0
                              ? ((count / metrics.errors.total) * 100).toFixed(
                                  2,
                                )
                              : "0.00"}
                            %
                          </td>
                        </tr>
                      ),
                    )}
                  {(!metrics?.errors?.byType ||
                    Object.keys(metrics.errors.byType).length === 0) && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400"
                      >
                        No errors recorded
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === "performance" && (
          <div className="space-y-6">
            <div className="p-4 bg-white dark:bg-gray-700 rounded shadow">
              <h3 className="text-lg font-semibold mb-4">
                Performance Metrics
              </h3>
              <PerformanceChart metrics={metrics} height={300} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-white dark:bg-gray-700 rounded shadow">
                <h3 className="text-lg font-semibold mb-2">
                  Avg Processing Time
                </h3>
                <p className="text-3xl font-bold">
                  {metrics?.performance?.averageEventProcessingTime?.toFixed(
                    2,
                  ) || "0.00"}{" "}
                  ms
                </p>
              </div>
              <div className="p-4 bg-white dark:bg-gray-700 rounded shadow">
                <h3 className="text-lg font-semibold mb-2">Events Processed</h3>
                <p className="text-3xl font-bold">
                  {metrics?.performance?.eventProcessingCount || 0}
                </p>
              </div>
              <div className="p-4 bg-white dark:bg-gray-700 rounded shadow">
                <h3 className="text-lg font-semibold mb-2">Last Reset</h3>
                <p className="text-xl">
                  {metrics?.lastReset
                    ? new Date(metrics.lastReset).toLocaleString()
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === "alerts" && <AlertsPanel alerts={alerts} />}

        {/* Control Panel Tab */}
        {activeTab === "control" && (
          <ControlPanel onSettingsChanged={fetchData} />
        )}
      </div>
    </div>
  );
}
