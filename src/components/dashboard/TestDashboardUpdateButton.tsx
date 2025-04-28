'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export default function TestDashboardUpdateButton() {
  const [isSending, setIsSending] = useState(false);
  
  const sendTestUpdate = async () => {
    try {
      setIsSending(true);
      
      const response = await fetch('/api/realtime/test-dashboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'STATS_UPDATED',
          data: {
            dashboardData: {
              totalUsers: Math.floor(Math.random() * 100) + 50,
              totalReports: Math.floor(Math.random() * 200) + 100,
              pendingReports: Math.floor(Math.random() * 20),
              totalAmount: Math.floor(Math.random() * 1000000) + 500000,
              growthRate: (Math.random() * 20) - 5 // Between -5% and 15%
            }
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Test dashboard update sent:', data);
    } catch (err) {
      console.error('Error sending test dashboard update:', err);
    } finally {
      setIsSending(false);
    }
  };
  
  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={sendTestUpdate}
      disabled={isSending}
    >
      {isSending ? (
        <>
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          Sending...
        </>
      ) : (
        <>
          <RefreshCw className="w-4 h-4 mr-2" />
          Send Test Update
        </>
      )}
    </Button>
  );
}
