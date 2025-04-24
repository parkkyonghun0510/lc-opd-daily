'use client';

import { useState } from 'react';

interface AlertsPanelProps {
  alerts: string[];
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  const [filter, setFilter] = useState<string>('');
  
  // Filter alerts
  const filteredAlerts = filter
    ? alerts.filter(alert => alert.toLowerCase().includes(filter.toLowerCase()))
    : alerts;
  
  // Group alerts by type
  const alertGroups: Record<string, string[]> = {};
  
  filteredAlerts.forEach(alert => {
    // Extract alert type from the format [TYPE] Message
    const match = alert.match(/^\[(.*?)\]/);
    const type = match ? match[1] : 'Other';
    
    if (!alertGroups[type]) {
      alertGroups[type] = [];
    }
    
    alertGroups[type].push(alert);
  });
  
  if (alerts.length === 0) {
    return (
      <div className="p-6 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded shadow">
        <div className="flex items-center justify-center">
          <svg className="w-8 h-8 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
          </svg>
          <h3 className="text-xl font-semibold">No Alerts</h3>
        </div>
        <p className="mt-2 text-center">Everything is working correctly. No alerts have been triggered.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">
          Alerts ({filteredAlerts.length})
        </h3>
        <div className="relative">
          <input
            type="text"
            placeholder="Filter alerts..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          )}
        </div>
      </div>
      
      {Object.entries(alertGroups).map(([type, typeAlerts]) => (
        <div key={type} className="p-4 bg-white dark:bg-gray-700 rounded shadow">
          <h4 className="text-lg font-semibold mb-3 flex items-center">
            <AlertIcon type={type} />
            <span className="ml-2">{type} Alerts ({typeAlerts.length})</span>
          </h4>
          
          <ul className="space-y-2">
            {typeAlerts.map((alert, index) => (
              <li 
                key={index} 
                className={`p-3 rounded ${getAlertBackgroundColor(type)}`}
              >
                {alert}
              </li>
            ))}
          </ul>
        </div>
      ))}
      
      <div className="p-4 bg-white dark:bg-gray-700 rounded shadow">
        <h4 className="text-lg font-semibold mb-3">Alert Actions</h4>
        <div className="flex space-x-4">
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => window.alert('This would acknowledge all alerts in a real implementation')}
          >
            Acknowledge All
          </button>
          <button
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            onClick={() => window.alert('This would clear all alerts in a real implementation')}
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper function to get alert background color
function getAlertBackgroundColor(type: string): string {
  switch (type.toUpperCase()) {
    case 'HIGH CONNECTIONS':
    case 'HIGH PEAK':
      return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
    case 'HIGH ERROR RATE':
      return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
    case 'SLOW PROCESSING':
      return 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200';
    default:
      return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
  }
}

// Alert icon component
function AlertIcon({ type }: { type: string }) {
  switch (type.toUpperCase()) {
    case 'HIGH CONNECTIONS':
    case 'HIGH PEAK':
      return (
        <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
        </svg>
      );
    case 'HIGH ERROR RATE':
      return (
        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
        </svg>
      );
    case 'SLOW PROCESSING':
      return (
        <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"></path>
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path>
        </svg>
      );
  }
}
