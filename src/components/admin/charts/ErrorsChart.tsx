'use client';

import { useEffect, useRef } from 'react';

interface ErrorsChartProps {
  metrics: any;
  height?: number;
}

export function ErrorsChart({ metrics, height = 300 }: ErrorsChartProps) {
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
    
    // Get error types
    const errorTypes = Object.keys(metrics.errors?.byType || {});
    
    if (errorTypes.length === 0 || metrics.errors?.total === 0) {
      // No errors, draw empty chart
      ctx.fillStyle = '#1f2937';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No errors recorded', width / 2, chartHeight / 2);
      return;
    }
    
    // Draw pie chart
    const centerX = width / 2;
    const centerY = chartHeight / 2;
    const radius = Math.min(centerX, centerY) * 0.8;
    
    let startAngle = 0;
    const total = metrics.errors.total;
    
    // Sort error types by count
    const sortedErrorTypes = errorTypes.sort((a, b) => 
      (metrics.errors.byType[b] || 0) - (metrics.errors.byType[a] || 0)
    );
    
    // Draw pie slices
    sortedErrorTypes.forEach((errorType, index) => {
      const count = metrics.errors.byType[errorType] || 0;
      const sliceAngle = (count / total) * 2 * Math.PI;
      
      // Generate a color based on the index
      const hue = (index * 137) % 360; // Golden angle approximation for good distribution
      ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
      
      // Draw the slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fill();
      
      // Store the middle angle for the label
      const midAngle = startAngle + sliceAngle / 2;
      
      // Draw label line
      const labelRadius = radius * 1.1;
      const labelX = centerX + Math.cos(midAngle) * labelRadius;
      const labelY = centerY + Math.sin(midAngle) * labelRadius;
      
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX + Math.cos(midAngle) * radius, centerY + Math.sin(midAngle) * radius);
      ctx.lineTo(labelX, labelY);
      ctx.stroke();
      
      // Draw label
      ctx.fillStyle = '#1f2937';
      ctx.font = '12px sans-serif';
      ctx.textAlign = midAngle < Math.PI ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      
      // Truncate long error type names
      const displayName = errorType.length > 15 ? errorType.substring(0, 13) + '...' : errorType;
      const percentage = ((count / total) * 100).toFixed(1) + '%';
      ctx.fillText(`${displayName} (${percentage})`, labelX, labelY);
      
      // Update start angle for next slice
      startAngle += sliceAngle;
    });
    
    // Draw center circle (donut hole)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.5, 0, 2 * Math.PI);
    ctx.fill();
    
    // Draw total errors in the center
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Total Errors`, centerX, centerY - 10);
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(total.toString(), centerX, centerY + 15);
    
  }, [metrics, height]);
  
  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 dark:bg-gray-800 rounded">
        <p className="text-gray-500 dark:text-gray-400">No data available</p>
      </div>
    );
  }
  
  // Get error types for the legend
  const errorTypes = Object.entries(metrics.errors?.byType || {})
    .sort((a, b) => (b[1] as number) - (a[1] as number));
  
  const totalErrors = metrics.errors?.total || 0;
  
  return (
    <div>
      <canvas 
        ref={chartRef} 
        height={height} 
        className="w-full"
      />
      
      {errorTypes.length > 0 && totalErrors > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold mb-2">Error Types</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {errorTypes.map(([errorType, count], index) => (
              <div key={errorType} className="flex items-center">
                <div 
                  className="w-4 h-4 mr-2" 
                  style={{ backgroundColor: `hsl(${(index * 137) % 360}, 70%, 60%)` }}
                ></div>
                <span className="text-sm truncate">
                  {errorType}: {count} ({((count as number / totalErrors) * 100).toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {(errorTypes.length === 0 || totalErrors === 0) && (
        <div className="mt-4 p-4 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
          <p className="text-center">No errors recorded. Everything is working correctly!</p>
        </div>
      )}
    </div>
  );
}
