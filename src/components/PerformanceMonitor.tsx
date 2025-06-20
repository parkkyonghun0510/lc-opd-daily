import { useEffect, useRef } from "react";
import { useErrorMonitoring } from "@/hooks/useErrorMonitoring";

interface PerformanceMetrics {
  timeToFirstByte: number;
  timeToInteractive: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
}

interface Props {
  children: React.ReactNode;
  pageId: string;
}

export function PerformanceMonitor({ children, pageId }: Props) {
  const { measurePerformance } = useErrorMonitoring();
  const metricsLogged = useRef(false);

  useEffect(() => {
    if (metricsLogged.current) return;

    const logMetrics = () => {
      try {
        if ("performance" in window) {
          // Get performance metrics
          const navigationTiming = performance.getEntriesByType(
            "navigation",
          )[0] as PerformanceNavigationTiming;
          const paintTimings = performance.getEntriesByType("paint");
          const lcpEntries = performance.getEntriesByType(
            "largest-contentful-paint",
          );

          const metrics: PerformanceMetrics = {
            timeToFirstByte:
              navigationTiming.responseStart - navigationTiming.requestStart,
            timeToInteractive:
              navigationTiming.domInteractive - navigationTiming.requestStart,
            firstContentfulPaint:
              paintTimings.find(
                (entry) => entry.name === "first-contentful-paint",
              )?.startTime || 0,
            largestContentfulPaint:
              lcpEntries[lcpEntries.length - 1]?.startTime || 0,
          };

          // Log each metric
          Object.entries(metrics).forEach(([key, value]) => {
            measurePerformance(`${pageId}_${key}`, value);
          });

          // Log cumulative layout shift if available
          if ("layoutShift" in performance) {
            let cls = 0;
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                // Use type assertion to access layout shift specific properties
                const layoutShiftEntry = entry as unknown as {
                  hadRecentInput: boolean;
                  value: number;
                };

                if (!layoutShiftEntry.hadRecentInput) {
                  cls += layoutShiftEntry.value;
                }
              }
              measurePerformance(`${pageId}_cumulative_layout_shift`, cls);
            }).observe({ type: "layout-shift", buffered: true });
          }

          // Log long tasks
          new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
              measurePerformance(`${pageId}_long_task`, entry.duration);
            });
          }).observe({ entryTypes: ["longtask"] });

          metricsLogged.current = true;
        }
      } catch (error) {
        console.error("Error logging performance metrics:", error);
      }
    };

    // Log metrics after the component mounts and content is loaded
    if (document.readyState === "complete") {
      logMetrics();
    } else {
      window.addEventListener("load", logMetrics);
      return () => window.removeEventListener("load", logMetrics);
    }
  }, [pageId, measurePerformance]);

  return <>{children}</>;
}
