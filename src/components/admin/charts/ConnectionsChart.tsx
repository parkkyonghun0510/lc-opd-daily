'use client';

import { useEffect, useRef } from 'react';

interface ConnectionsChartProps {
  metrics: any;
  height?: number;
}

export function ConnectionsChart({ metrics, height = 300 }: ConnectionsChartProps) {
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

    // Draw bars
    const barWidth = width / 4 - 20;
    const spacing = 20;

    // Total connections
    const totalConnections = metrics.connections?.total || 0;
    const maxValue = Math.max(
      totalConnections,
      metrics.connections?.active || 0,
      metrics.connections?.peak || 0,
      Object.values(metrics.connections?.byUser || {}).reduce((a: number, b: unknown) => Math.max(a, Number(b) || 0), 0)
    );

    // Draw total connections bar
    ctx.fillStyle = '#3b82f6';
    const totalHeight = maxValue > 0 ? (totalConnections / maxValue) * chartHeight * 0.9 : 0;
    ctx.fillRect(spacing, chartHeight - totalHeight, barWidth, totalHeight);

    // Draw active connections bar
    ctx.fillStyle = '#10b981';
    const activeConnections = metrics.connections?.active || 0;
    const activeHeight = maxValue > 0 ? (activeConnections / maxValue) * chartHeight * 0.9 : 0;
    ctx.fillRect(spacing * 2 + barWidth, chartHeight - activeHeight, barWidth, activeHeight);

    // Draw peak connections bar
    ctx.fillStyle = '#f59e0b';
    const peakConnections = metrics.connections?.peak || 0;
    const peakHeight = maxValue > 0 ? (peakConnections / maxValue) * chartHeight * 0.9 : 0;
    ctx.fillRect(spacing * 3 + barWidth * 2, chartHeight - peakHeight, barWidth, peakHeight);

    // Draw unique users bar
    ctx.fillStyle = '#8b5cf6';
    const uniqueUsers = Object.keys(metrics.connections?.byUser || {}).length;
    const uniqueHeight = maxValue > 0 ? (uniqueUsers / maxValue) * chartHeight * 0.9 : 0;
    ctx.fillRect(spacing * 4 + barWidth * 3, chartHeight - uniqueHeight, barWidth, uniqueHeight);

    // Draw labels
    ctx.fillStyle = '#1f2937';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';

    ctx.fillText('Total', spacing + barWidth / 2, chartHeight - 10);
    ctx.fillText('Active', spacing * 2 + barWidth * 1.5, chartHeight - 10);
    ctx.fillText('Peak', spacing * 3 + barWidth * 2.5, chartHeight - 10);
    ctx.fillText('Users', spacing * 4 + barWidth * 3.5, chartHeight - 10);

    // Draw values
    ctx.fillText(totalConnections.toString(), spacing + barWidth / 2, chartHeight - totalHeight - 5);
    ctx.fillText(activeConnections.toString(), spacing * 2 + barWidth * 1.5, chartHeight - activeHeight - 5);
    ctx.fillText(peakConnections.toString(), spacing * 3 + barWidth * 2.5, chartHeight - peakHeight - 5);
    ctx.fillText(uniqueUsers.toString(), spacing * 4 + barWidth * 3.5, chartHeight - uniqueHeight - 5);

  }, [metrics, height]);

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 dark:bg-gray-800 rounded">
        <p className="text-gray-500 dark:text-gray-400">No data available</p>
      </div>
    );
  }

  return (
    <div>
      <canvas
        ref={chartRef}
        height={height}
        className="w-full"
      />
      <div className="flex justify-around mt-4">
        <div className="flex items-center">
          <div className="w-4 h-4 bg-blue-500 mr-2"></div>
          <span>Total: {metrics.connections?.total || 0}</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-green-500 mr-2"></div>
          <span>Active: {metrics.connections?.active || 0}</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-yellow-500 mr-2"></div>
          <span>Peak: {metrics.connections?.peak || 0}</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-purple-500 mr-2"></div>
          <span>Users: {Object.keys(metrics.connections?.byUser || {}).length}</span>
        </div>
      </div>
    </div>
  );
}
