'use client';

import { useState, useEffect, useRef } from 'react';
import { useSSE } from '@/hooks/useSSE';

interface SSEDebuggerProps {
  endpoint?: string;
  userId?: string;
  token?: string;
}

export default function SSEDebugger({ endpoint = '/api/sse', userId, token }: SSEDebuggerProps) {
  // Connection state
  const [isManuallyConnected, setIsManuallyConnected] = useState(false);
  const [customEndpoint, setCustomEndpoint] = useState(endpoint);
  const [customUserId, setCustomUserId] = useState(userId || '');
  const [customToken, setCustomToken] = useState(token || '');
  
  // Event log
  const [eventLog, setEventLog] = useState<Array<{
    id: string;
    timestamp: number;
    type: string;
    data: any;
  }>>([]);
  
  // Auto-scroll
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  // SSE connection
  const {
    isConnected,
    error,
    lastEvent,
    reconnect,
    closeConnection
  } = useSSE({
    endpoint: isManuallyConnected ? customEndpoint : undefined,
    clientMetadata: {
      type: 'debugger',
      clientInfo: 'SSE Debugger'
    },
    eventHandlers: {
      // Handle all events
      connected: (data) => {
        addEventToLog('connected', data);
      },
      notification: (data) => {
        addEventToLog('notification', data);
      },
      update: (data) => {
        addEventToLog('update', data);
      },
      ping: (data) => {
        addEventToLog('ping', data);
      },
      message: (data) => {
        addEventToLog('message', data);
      }
    },
    debug: true,
    enableCache: false
  });
  
  // Add event to log
  const addEventToLog = (type: string, data: any) => {
    setEventLog(prevLog => [
      {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type,
        data
      },
      ...prevLog.slice(0, 99) // Keep only the last 100 events
    ]);
  };
  
  // Auto-scroll to the bottom of the log
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [eventLog, autoScroll]);
  
  // Connect to SSE
  const connect = () => {
    setIsManuallyConnected(true);
    reconnect();
  };
  
  // Disconnect from SSE
  const disconnect = () => {
    setIsManuallyConnected(false);
    closeConnection();
  };
  
  // Clear event log
  const clearLog = () => {
    setEventLog([]);
  };
  
  // Get event type color
  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'connected':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'notification':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'update':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'ping':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    }
  };
  
  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">SSE Debugger</h2>
      
      {/* Connection Controls */}
      <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded">
        <h3 className="text-lg font-semibold mb-3">Connection</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label htmlFor="endpoint" className="block text-sm font-medium mb-1">
              Endpoint
            </label>
            <input
              type="text"
              id="endpoint"
              value={customEndpoint}
              onChange={(e) => setCustomEndpoint(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              placeholder="/api/sse"
              disabled={isManuallyConnected}
            />
          </div>
          
          <div>
            <label htmlFor="userId" className="block text-sm font-medium mb-1">
              User ID
            </label>
            <input
              type="text"
              id="userId"
              value={customUserId}
              onChange={(e) => setCustomUserId(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              placeholder="user-123"
              disabled={isManuallyConnected}
            />
          </div>
          
          <div>
            <label htmlFor="token" className="block text-sm font-medium mb-1">
              Token (optional)
            </label>
            <input
              type="text"
              id="token"
              value={customToken}
              onChange={(e) => setCustomToken(e.target.value)}
              className="w-full px-3 py-2 border rounded"
              placeholder="jwt-token"
              disabled={isManuallyConnected}
            />
          </div>
        </div>
        
        <div className="flex space-x-4">
          {!isManuallyConnected ? (
            <button
              onClick={connect}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              disabled={!customEndpoint || !customUserId}
            >
              Connect
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Disconnect
            </button>
          )}
          
          {isManuallyConnected && (
            <button
              onClick={reconnect}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Reconnect
            </button>
          )}
        </div>
        
        {/* Connection Status */}
        <div className="mt-4">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="font-medium">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          {error && (
            <div className="mt-2 p-2 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded">
              {error}
            </div>
          )}
        </div>
      </div>
      
      {/* Event Log */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">Event Log</h3>
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded"
              />
              <span>Auto-scroll</span>
            </label>
            <button
              onClick={clearLog}
              className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Clear Log
            </button>
          </div>
        </div>
        
        <div 
          ref={logContainerRef}
          className="h-96 overflow-y-auto border rounded p-2 bg-gray-50 dark:bg-gray-900"
        >
          {eventLog.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
              No events received yet
            </div>
          ) : (
            <div className="space-y-2">
              {eventLog.map(event => (
                <div 
                  key={event.id} 
                  className={`p-3 rounded ${getEventTypeColor(event.type)}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold">{event.type}</span>
                    <span className="text-xs">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className="text-xs overflow-x-auto">
                    {JSON.stringify(event.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Event Sender */}
      <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-700 rounded">
        <h3 className="text-lg font-semibold mb-3">Send Test Event</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="eventType" className="block text-sm font-medium mb-1">
              Event Type
            </label>
            <select
              id="eventType"
              className="w-full px-3 py-2 border rounded"
              defaultValue="notification"
            >
              <option value="notification">notification</option>
              <option value="update">update</option>
              <option value="custom">custom</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="targetUserId" className="block text-sm font-medium mb-1">
              Target User ID
            </label>
            <input
              type="text"
              id="targetUserId"
              className="w-full px-3 py-2 border rounded"
              placeholder="user-123"
              defaultValue={customUserId}
            />
          </div>
        </div>
        
        <div className="mb-4">
          <label htmlFor="eventData" className="block text-sm font-medium mb-1">
            Event Data (JSON)
          </label>
          <textarea
            id="eventData"
            className="w-full px-3 py-2 border rounded h-32 font-mono"
            placeholder='{"title": "Test Notification", "body": "This is a test notification"}'
            defaultValue='{"title": "Test Notification", "body": "This is a test notification"}'
          ></textarea>
        </div>
        
        <button
          onClick={() => {
            const eventType = (document.getElementById('eventType') as HTMLSelectElement).value;
            const targetUserId = (document.getElementById('targetUserId') as HTMLInputElement).value;
            const eventDataStr = (document.getElementById('eventData') as HTMLTextAreaElement).value;
            
            try {
              const eventData = JSON.parse(eventDataStr);
              
              // In a real implementation, this would call an API to send the event
              window.alert(`This would send a ${eventType} event to user ${targetUserId} with data: ${eventDataStr}`);
            } catch (error) {
              window.alert(`Invalid JSON: ${error}`);
            }
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Send Event
        </button>
      </div>
      
      {/* Connection Info */}
      <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded">
        <h3 className="text-lg font-semibold mb-3">Connection Info</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium mb-1">Browser Support</h4>
            <p className={typeof EventSource !== 'undefined' ? 'text-green-600' : 'text-red-600'}>
              {typeof EventSource !== 'undefined' ? 'SSE is supported in this browser' : 'SSE is NOT supported in this browser'}
            </p>
          </div>
          
          <div>
            <h4 className="font-medium mb-1">Last Event</h4>
            <pre className="text-xs overflow-x-auto bg-white dark:bg-gray-800 p-2 rounded">
              {lastEvent ? JSON.stringify(lastEvent, null, 2) : 'No events received'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
