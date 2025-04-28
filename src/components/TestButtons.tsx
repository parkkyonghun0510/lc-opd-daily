'use client';

import { Button } from '@/components/ui/button';

export function TestSSEButton() {
  const handleClick = () => {
    // Create script element
    const script = document.createElement('script');
    script.innerHTML = `
      // Simple SSE client
      const eventSource = new EventSource('/api/realtime/sse?clientType=test&role=user&_t=' + Date.now());
      
      console.log('Connecting to SSE...');
      
      eventSource.onopen = () => {
        console.log('SSE connection opened');
      };
      
      eventSource.onerror = (err) => {
        console.error('SSE connection error:', err);
        eventSource.close();
      };
      
      eventSource.addEventListener('connected', (e) => {
        console.log('Connected event:', JSON.parse(e.data));
      });
      
      eventSource.addEventListener('notification', (e) => {
        console.log('Notification event:', JSON.parse(e.data));
      });
      
      // Clean up after 30 seconds
      setTimeout(() => {
        console.log('Closing SSE connection...');
        eventSource.close();
      }, 30000);
    `;
    document.body.appendChild(script);
  };

  return (
    <Button onClick={handleClick}>
      Test SSE Connection
    </Button>
  );
}

export function TestEventButton() {
  const handleClick = async () => {
    try {
      const response = await fetch('/api/realtime/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'notification',
          message: 'Test notification from client'
        })
      });
      
      const data = await response.json();
      console.log('Test event sent:', data);
    } catch (err) {
      console.error('Error sending test event:', err);
    }
  };

  return (
    <Button variant="outline" onClick={handleClick}>
      Send Test Event
    </Button>
  );
}

export function TestPollingButton() {
  const handleClick = () => {
    // Create script element
    const script = document.createElement('script');
    script.innerHTML = `
      // Simple polling client
      async function pollForUpdates() {
        try {
          console.log('Polling for updates...');
          const response = await fetch('/api/realtime/polling?_t=' + Date.now());
          const data = await response.json();
          console.log('Polling response:', data);
          
          // Schedule next poll
          setTimeout(pollForUpdates, 5000);
        } catch (err) {
          console.error('Polling error:', err);
          // Retry after error
          setTimeout(pollForUpdates, 10000);
        }
      }
      
      // Start polling
      pollForUpdates();
      
      // Clean up after 30 seconds
      setTimeout(() => {
        console.log('Stopping polling...');
        window.stopPolling = true;
      }, 30000);
    `;
    document.body.appendChild(script);
  };

  return (
    <Button onClick={handleClick}>
      Test Polling
    </Button>
  );
}
