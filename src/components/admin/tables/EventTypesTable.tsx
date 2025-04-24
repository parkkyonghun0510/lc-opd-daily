'use client';

interface EventTypesTableProps {
  metrics: any;
}

export function EventTypesTable({ metrics }: EventTypesTableProps) {
  if (!metrics || !metrics.events) {
    return (
      <div className="flex items-center justify-center h-32 bg-gray-100 dark:bg-gray-800 rounded">
        <p className="text-gray-500 dark:text-gray-400">No data available</p>
      </div>
    );
  }
  
  // Get event types
  const eventTypes = Object.entries(metrics.events.byType || {});
  
  // Sort by count (descending)
  eventTypes.sort((a, b) => (b[1] as number) - (a[1] as number));
  
  if (eventTypes.length === 0) {
    return (
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded">
        <p className="text-center text-gray-500 dark:text-gray-400">No events recorded</p>
      </div>
    );
  }
  
  const totalEvents = metrics.events.total || 0;
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Event Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Count
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Percentage
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Distribution
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
          {eventTypes.map(([eventType, count], index) => {
            // Calculate percentage
            const percentage = totalEvents > 0 ? ((count as number / totalEvents) * 100).toFixed(1) : '0.0';
            
            // Generate a color based on the index
            const hue = (index * 137) % 360; // Golden angle approximation for good distribution
            const color = `hsl(${hue}, 70%, 60%)`;
            
            return (
              <tr key={eventType}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center">
                    <div 
                      className="w-3 h-3 mr-2 rounded-full" 
                      style={{ backgroundColor: color }}
                    ></div>
                    {eventType}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {count}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {percentage}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="w-full bg-gray-200 rounded-full h-2.5 max-w-[200px]">
                    <div 
                      className="h-2.5 rounded-full" 
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: color
                      }}
                    ></div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <td className="px-6 py-3 text-sm font-medium">
              Total
            </td>
            <td className="px-6 py-3 text-sm font-medium">
              {totalEvents}
            </td>
            <td className="px-6 py-3 text-sm font-medium">
              100%
            </td>
            <td className="px-6 py-3"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
