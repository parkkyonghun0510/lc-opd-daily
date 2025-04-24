'use client';

interface UserConnectionsTableProps {
  stats: any;
}

export function UserConnectionsTable({ stats }: UserConnectionsTableProps) {
  if (!stats) {
    return (
      <div className="flex items-center justify-center h-32 bg-gray-100 dark:bg-gray-800 rounded">
        <p className="text-gray-500 dark:text-gray-400">No data available</p>
      </div>
    );
  }
  
  // Get user connections
  let userConnections: [string, number][] = [];
  
  if (stats.localUserCounts) {
    // Redis handler
    userConnections = Object.entries(stats.localUserCounts);
  } else if (stats.userCounts) {
    // Memory handler
    userConnections = Object.entries(stats.userCounts);
  }
  
  // Sort by connection count (descending)
  userConnections.sort((a, b) => b[1] - a[1]);
  
  // Get global connections if available
  const hasGlobalData = stats.globalUserCounts && typeof stats.globalUserCounts === 'object';
  
  if (userConnections.length === 0) {
    return (
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded">
        <p className="text-center text-gray-500 dark:text-gray-400">No active user connections</p>
      </div>
    );
  }
  
  return (
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
            {hasGlobalData && (
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Global Connections
              </th>
            )}
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Percentage
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
          {userConnections.map(([userId, count]) => {
            // Calculate percentage
            const totalConnections = stats.localConnections || stats.totalConnections || 1;
            const percentage = ((count / totalConnections) * 100).toFixed(1);
            
            // Get global count if available
            const globalCount = hasGlobalData && stats.globalUserCounts[userId] 
              ? stats.globalUserCounts[userId] 
              : null;
            
            return (
              <tr key={userId}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {userId}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {count}
                </td>
                {hasGlobalData && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {globalCount !== null ? globalCount : 'N/A'}
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center">
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2 max-w-[150px]">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full" 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span>{percentage}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
