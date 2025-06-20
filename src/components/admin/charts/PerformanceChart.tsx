"use client";

import { useEffect, useRef } from "react";

interface PerformanceChartProps {
  metrics: any;
  height?: number;
}

export function PerformanceChart({
  metrics,
  height = 300,
}: PerformanceChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!metrics || !chartRef.current) return;

    // This is a placeholder for chart rendering
    // In a real implementation, you would use a charting library like Chart.js

    const ctx = chartRef.current.getContext("2d");
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, chartRef.current.width, chartRef.current.height);

    // Set up chart dimensions
    const width = chartRef.current.width;
    const chartHeight = chartRef.current.height;

    // Draw chart background
    ctx.fillStyle = "#f0f4f8";
    ctx.fillRect(0, 0, width, chartHeight);

    // Draw grid lines
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1;

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = chartHeight - (i / 5) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Check if we have performance data
    if (
      !metrics.performance ||
      metrics.performance.eventProcessingCount === 0
    ) {
      // No performance data, draw empty chart
      ctx.fillStyle = "#1f2937";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No performance data available", width / 2, chartHeight / 2);
      return;
    }

    // Draw gauge chart for average processing time
    const centerX = width / 2;
    const centerY = chartHeight / 2;
    const radius = Math.min(centerX, centerY) * 0.8;

    // Draw gauge background
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, 2 * Math.PI);
    ctx.fillStyle = "#e5e7eb";
    ctx.fill();

    // Calculate gauge value (0-1)
    const avgTime = metrics.performance.averageEventProcessingTime || 0;
    const maxTime = 200; // 200ms is considered slow
    const gaugeValue = Math.min(1, avgTime / maxTime);

    // Draw gauge value
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, Math.PI + gaugeValue * Math.PI);

    // Color based on value (green to red)
    let color;
    if (gaugeValue < 0.3) {
      color = "#10b981"; // Green
    } else if (gaugeValue < 0.7) {
      color = "#f59e0b"; // Yellow
    } else {
      color = "#ef4444"; // Red
    }

    ctx.fillStyle = color;
    ctx.fill();

    // Draw gauge center
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.1, 0, 2 * Math.PI);
    ctx.fillStyle = "#1f2937";
    ctx.fill();

    // Draw gauge needle
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    const needleAngle = Math.PI + gaugeValue * Math.PI;
    ctx.lineTo(
      centerX + Math.cos(needleAngle) * radius * 0.9,
      centerY + Math.sin(needleAngle) * radius * 0.9,
    );
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw gauge labels
    ctx.fillStyle = "#1f2937";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";

    // 0ms label
    ctx.fillText("0ms", centerX - radius * 0.9, centerY + 20);

    // 100ms label
    ctx.fillText("100ms", centerX, centerY - radius * 0.7);

    // 200ms label
    ctx.fillText("200ms+", centerX + radius * 0.9, centerY + 20);

    // Draw average time in the center
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("Avg Processing Time", centerX, centerY + radius * 0.3);
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(`${avgTime.toFixed(2)} ms`, centerX, centerY + radius * 0.5);

    // Draw event count
    ctx.font = "14px sans-serif";
    ctx.fillText(
      `Events Processed: ${metrics.performance.eventProcessingCount}`,
      centerX,
      centerY + radius * 0.7,
    );
  }, [metrics, height]);

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 dark:bg-gray-800 rounded">
        <p className="text-gray-500 dark:text-gray-400">No data available</p>
      </div>
    );
  }

  const avgTime = metrics.performance?.averageEventProcessingTime || 0;
  let performanceStatus;

  if (avgTime < 50) {
    performanceStatus = (
      <div className="mt-4 p-3 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
        <p className="font-semibold">Excellent Performance</p>
        <p className="text-sm">
          Average processing time is under 50ms, which is excellent.
        </p>
      </div>
    );
  } else if (avgTime < 100) {
    performanceStatus = (
      <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
        <p className="font-semibold">Good Performance</p>
        <p className="text-sm">
          Average processing time is under 100ms, which is good.
        </p>
      </div>
    );
  } else if (avgTime < 150) {
    performanceStatus = (
      <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
        <p className="font-semibold">Moderate Performance</p>
        <p className="text-sm">
          Average processing time is between 100-150ms. Consider optimization.
        </p>
      </div>
    );
  } else {
    performanceStatus = (
      <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded">
        <p className="font-semibold">Poor Performance</p>
        <p className="text-sm">
          Average processing time is over 150ms. Optimization is recommended.
        </p>
      </div>
    );
  }

  return (
    <div>
      <canvas ref={chartRef} height={height} className="w-full" />

      {performanceStatus}
    </div>
  );
}
