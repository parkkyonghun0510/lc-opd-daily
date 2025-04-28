'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

/**
 * SSE Monitor Component
 *
 * This component displays statistics about SSE connections for admin users.
 * It shows the number of connected clients, unique users, and other metrics.
 */
export default function SSEMonitor() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Check if the user is an admin
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN';

  // Fetch SSE statistics
  const fetchStats = async () => {
    if (!isAdmin) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/sse-monitor');

      if (!response.ok) {
        throw new Error(`Error fetching SSE stats: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching SSE stats:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Set up auto-refresh
  useEffect(() => {
    if (!isAdmin) return;

    // Initial fetch
    fetchStats();

    // Set up auto-refresh interval
    let intervalId: NodeJS.Timeout | null = null;

    if (autoRefresh) {
      intervalId = setInterval(fetchStats, 5000); // Refresh every 5 seconds
    }

    // Clean up
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isAdmin, autoRefresh]);

  // If not admin, don't show anything
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">SSE Connection Monitor</h2>
        <div className="flex items-center space-x-4">
          <button
            onClick={fetchStats}
            disabled={loading}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span>Auto-refresh</span>
          </label>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
              <div className="text-sm text-gray-500 dark:text-gray-400">Handler Type</div>
              <div className="text-2xl font-semibold">{stats.handlerType}</div>
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
              <div className="text-sm text-gray-500 dark:text-gray-400">Instance ID</div>
              <div className="text-lg font-semibold truncate">{stats.stats.instanceId || 'N/A'}</div>
            </div>
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded">
              <div className="text-sm text-gray-500 dark:text-gray-400">Last Updated</div>
              <div className="text-lg font-semibold">
                {new Date(stats.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded">
              <div className="text-sm text-blue-500 dark:text-blue-300">Local Connections</div>
              <div className="text-2xl font-semibold">{stats.stats.localConnections}</div>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded">
              <div className="text-sm text-green-500 dark:text-green-300">Local Unique Users</div>
              <div className="text-2xl font-semibold">{stats.stats.localUniqueUsers}</div>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded">
              <div className="text-sm text-purple-500 dark:text-purple-300">Global Connections</div>
              <div className="text-2xl font-semibold">
                {typeof stats.stats.globalTotalConnections === 'number'
                  ? stats.stats.globalTotalConnections
                  : 'N/A'}
              </div>
            </div>
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900 rounded">
              <div className="text-sm text-indigo-500 dark:text-indigo-300">Global Unique Users</div>
              <div className="text-2xl font-semibold">
                {typeof stats.stats.globalUniqueUsers === 'number'
                  ? stats.stats.globalUniqueUsers
                  : 'N/A'}
              </div>
            </div>
          </div>

          {/* User Connections Table */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">User Connections</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      User ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Local Connections
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Global Connections
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                  {Object.entries(stats.stats.localUserCounts || {}).map(([userId, count]) => (
                    <tr key={userId}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {userId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {Number(count)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {stats.stats.globalUserCounts && typeof stats.stats.globalUserCounts === 'object'
                          ? stats.stats.globalUserCounts[userId] || 'N/A'
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
