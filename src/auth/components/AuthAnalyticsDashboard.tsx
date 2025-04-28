"use client";

import { useState, useEffect } from 'react';
import { getStoredAuthEvents, AuthEventType, clearStoredAuthEvents } from '@/auth/utils/analytics';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

/**
 * AuthAnalyticsDashboard component
 * 
 * Displays analytics for authentication events
 */
export function AuthAnalyticsDashboard() {
  const [events, setEvents] = useState<Array<{
    type: AuthEventType;
    data: any;
  }>>([]);
  const [activeTab, setActiveTab] = useState('overview');

  // Load events from localStorage
  useEffect(() => {
    const storedEvents = getStoredAuthEvents();
    setEvents(storedEvents);
  }, []);

  // Clear events
  const handleClearEvents = () => {
    clearStoredAuthEvents();
    setEvents([]);
  };

  // Count events by type
  const eventCounts = events.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Format event type for display
  const formatEventType = (type: string) => {
    return type.replace('auth:', '').split('_').map(
      word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  // Prepare data for charts
  const barChartData = Object.entries(eventCounts).map(([type, count]) => ({
    name: formatEventType(type),
    count,
  }));

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  // Get event badge color
  const getEventColor = (type: AuthEventType) => {
    switch (type) {
      case AuthEventType.LOGIN_SUCCESS:
        return 'bg-green-500';
      case AuthEventType.LOGIN_FAILURE:
        return 'bg-red-500';
      case AuthEventType.LOGOUT:
        return 'bg-yellow-500';
      case AuthEventType.SESSION_EXPIRED:
        return 'bg-orange-500';
      case AuthEventType.SESSION_EXTENDED:
        return 'bg-blue-500';
      case AuthEventType.PERMISSION_DENIED:
        return 'bg-purple-500';
      case AuthEventType.PROFILE_UPDATED:
        return 'bg-indigo-500';
      case AuthEventType.PREFERENCES_UPDATED:
        return 'bg-pink-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Authentication Analytics</CardTitle>
        <CardDescription>
          Track and analyze authentication events in your application
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="charts">Charts</TabsTrigger>
            <TabsTrigger value="events">Event Log</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(eventCounts).map(([type, count]) => (
                <Card key={type} className="overflow-hidden">
                  <CardHeader className="p-4">
                    <Badge className={`${getEventColor(type as AuthEventType)} text-white`}>
                      {formatEventType(type)}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-3xl font-bold">{count}</div>
                    <div className="text-sm text-muted-foreground">
                      {count === 1 ? 'event' : 'events'} recorded
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="charts">
            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Events by Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={barChartData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="name" 
                          angle={-45} 
                          textAnchor="end" 
                          height={70} 
                        />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Event Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={barChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                          label={({ name, percent }) => 
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {barChartData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={COLORS[index % COLORS.length]} 
                            />
                          ))}
                        </Pie>
                        <Legend />
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="events">
            <div className="space-y-4">
              {events.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                  No events recorded yet
                </div>
              ) : (
                <div className="space-y-4">
                  {events.slice().reverse().map((event, index) => (
                    <Card key={index}>
                      <CardHeader className="p-4">
                        <div className="flex justify-between items-center">
                          <Badge className={`${getEventColor(event.type)} text-white`}>
                            {formatEventType(event.type)}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(event.data.timestamp), 'PPpp')}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="space-y-2">
                          {event.data.userId && (
                            <div>
                              <span className="font-semibold">User ID:</span> {event.data.userId}
                            </div>
                          )}
                          {event.data.username && (
                            <div>
                              <span className="font-semibold">Username:</span> {event.data.username}
                            </div>
                          )}
                          {event.data.role && (
                            <div>
                              <span className="font-semibold">Role:</span> {event.data.role}
                            </div>
                          )}
                          {event.data.error && (
                            <div>
                              <span className="font-semibold">Error:</span> {event.data.error}
                            </div>
                          )}
                          {event.data.details && (
                            <div>
                              <span className="font-semibold">Details:</span>
                              <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto">
                                {JSON.stringify(event.data.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="text-sm text-muted-foreground">
          {events.length} {events.length === 1 ? 'event' : 'events'} recorded
        </div>
        <Button variant="outline" onClick={handleClearEvents}>
          Clear Events
        </Button>
      </CardFooter>
    </Card>
  );
}
