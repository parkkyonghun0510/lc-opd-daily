'use client';

import { useEffect, useRef } from 'react';

interface EventsChartProps {
  metrics: any;
  height?: number;
}

export function EventsChart({ metrics, height = 300 }: EventsChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!metrics || !chartRef.current) return;

    // This is a placeholder for chart rendering
    // In a real implementation, you would use a charting library like Chart.js

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, chartRef.current.width, chartRef.current.height);

    // Set up chart dimensions
    const width = chartRef.current.width;
    const chartHeight = chartRef.current.height;

    // Draw chart background
    ctx.fillStyle = '#f0f4f8';
    ctx.fillRect(0, 0, width, chartHeight);

    // Draw grid lines
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = chartHeight - (i / 5) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Get event types
    const eventTypes = Object.keys(metrics.events?.byType || {});

    if (eventTypes.length === 0) {
      // No event types, draw empty chart
      ctx.fillStyle = '#1f2937';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No event data available', width / 2, chartHeight / 2);
      return;
    }

    // Calculate bar width and spacing
    const barWidth = Math.min(50, (width - 40) / eventTypes.length - 10);
    const spacing = (width - barWidth * eventTypes.length) / (eventTypes.length + 1);

    // Find max value for scaling
    const maxValue = Math.max(...Object.values(metrics.events?.byType || {}) as number[]);

    // Draw bars for each event type
    eventTypes.forEach((eventType, index) => {
      const count = metrics.events.byType[eventType] || 0;
      const barHeight = maxValue > 0 ? (count / maxValue) * chartHeight * 0.9 : 0;

      // Generate a color based on the index
      const hue = (index * 137) % 360; // Golden angle approximation for good distribution
      ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;

      // Draw the bar
      const x = spacing + (barWidth + spacing) * index;
      ctx.fillRect(x, chartHeight - barHeight, barWidth, barHeight);

      // Draw the label
      ctx.fillStyle = '#1f2937';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';

      // Truncate long event type names
      const displayName = eventType.length > 10 ? eventType.substring(0, 8) + '...' : eventType;
      ctx.fillText(displayName, x + barWidth / 2, chartHeight - 5);

      // Draw the value
      ctx.fillText(count.toString(), x + barWidth / 2, chartHeight - barHeight - 5);
    });

    // Draw title
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Total Events: ${metrics.events?.total || 0}`, width / 2, 20);

  }, [metrics, height]);

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 dark:bg-gray-800 rounded">
        <p className="text-gray-500 dark:text-gray-400">No data available</p>
      </div>
    );
  }

  // Get top 5 event types for the legend
  const topEventTypes = Object.entries(metrics.events?.byType || {})
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 5);

  return (
    <div>
      <canvas
        ref={chartRef}
        height={height}
        className="w-full"
      />

      {topEventTypes.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold mb-2">Top Event Types</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {topEventTypes.map(([eventType, count], index) => (
              <div key={eventType} className="flex items-center">
                <div
                  className="w-4 h-4 mr-2"
                  style={{ backgroundColor: `hsl(${(index * 137) % 360}, 70%, 60%)` }}
                ></div>
                <span className="text-sm truncate">{eventType}: {Number(count)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
