// Web Worker for handling report processing tasks
import { openDB } from 'idb';

// Define types for worker messages
type WorkerMessageType = "PROCESS_REPORTS" | "CACHE_REPORTS" | "ANALYZE_TRENDS";
type WorkerResponseType =
  | "REPORTS_PROCESSED"
  | "REPORTS_CACHED"
  | "TRENDS_ANALYZED"
  | "ERROR";

interface WorkerMessage {
  type: WorkerMessageType;
  payload: Report[] | unknown;
}

interface WorkerResponse {
  type: WorkerResponseType;
  payload: unknown;
}

// Define report interface
interface Report {
  id?: string;
  branchId?: string;
  writeOffs: number | string | object;
  ninetyPlus: number | string | object;
  riskScore?: number;
  changeFromLastReport?: number;
}

// Handle messages from the main thread
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  try {
    if (!e.data || typeof e.data !== 'object') {
      throw new Error('Invalid message format');
    }
    
    const { type, payload } = e.data;

    if (!type) {
      throw new Error('Message type is required');
    }

    switch (type) {
      case "PROCESS_REPORTS":
        await processReports(payload as Report[]);
        break;

      case "CACHE_REPORTS":
        await cacheReports(payload as Report[]);
        break;

      case "ANALYZE_TRENDS":
        analyzeTrends(payload as Report[]); 
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    console.error('Worker message handler error:', error);
    self.postMessage({
      type: "ERROR",
      payload: {
        message: `Worker error: ${error instanceof Error ? error.message : "Unknown error"}`
      },
    } as WorkerResponse);
  }
};

// Process reports in background
async function processReports(reports: Report[]): Promise<void> {
  try {
    // Validate input
    if (!Array.isArray(reports)) {
      throw new Error("Invalid input: reports must be an array");
    }
    
    const processedReports = reports.map((report) => {
      // Skip processing if not an object
      if (typeof report !== "object" || report === null) {
        return report;
      }

      try {
        // Process each report with error handling
        return {
          ...report,
          writeOffs:
            typeof report.writeOffs === "object"
              ? Number(report.writeOffs)
              : report.writeOffs,
          ninetyPlus:
            typeof report.ninetyPlus === "object"
              ? Number(report.ninetyPlus)
              : report.ninetyPlus,
          // Add computed fields
          riskScore: calculateRiskScore(report),
          changeFromLastReport: calculateChange(report),
        };
      } catch (reportError) {
        console.error("Error processing individual report:", reportError);
        // Return the original report if processing fails
        return report;
      }
    });

    self.postMessage({
      type: "REPORTS_PROCESSED",
      payload: processedReports,
    });
  } catch (error) {
    console.error("Error processing reports:", error);
    self.postMessage({
      type: "ERROR",
      payload: {
        message: `Failed to process reports: ${error instanceof Error ? error.message : "Unknown error"}`
      },
    } as WorkerResponse);
  }
}

// Cache reports in IndexedDB
async function cacheReports(reports: Report[]): Promise<void> {
  try {
    // Validate input
    if (!Array.isArray(reports)) {
      throw new Error("Invalid input: reports must be an array");
    }
    
    // Open IndexedDB
    const db = await openDB("reports-cache", 1, {
      upgrade(db) {
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains("reports")) {
          db.createObjectStore("reports", { keyPath: "id" });
        }
      },
    });

    // Start transaction
    const tx = db.transaction("reports", "readwrite");
    const store = tx.objectStore("reports");

    // Clear existing data
    await store.clear();

    // Add all reports
    let addedCount = 0;
    for (const report of reports) {
      // Skip invalid reports
      if (typeof report !== 'object' || report === null || !report.id) {
        console.warn("Skipping invalid report during cache operation");
        continue;
      }
      
      try {
        await store.add(report);
        addedCount++;
      } catch (addError) {
        console.error(`Error adding report ${report.id} to cache:`, addError);
        // Continue with other reports even if one fails
      }
    }

    // Complete transaction
    await tx.done;

    self.postMessage({
      type: "REPORTS_CACHED",
      payload: { count: addedCount },
    });
  } catch (error) {
    console.error("Error caching reports:", error);
    self.postMessage({
      type: "ERROR",
      payload: {
        message: `Failed to cache reports: ${error instanceof Error ? error.message : "Unknown error"}`
      },
    } as WorkerResponse);
  }
}

// Analyze trends in report data
function analyzeTrends(reports: Report[]): void {
  try {
    // Validate input
    if (!Array.isArray(reports)) {
      throw new Error("Invalid input: reports must be an array");
    }
    
    const trends = {
      writeOffs: calculateTrend(reports, "writeOffs"),
      ninetyPlus: calculateTrend(reports, "ninetyPlus"),
      branchPerformance: analyzeBranchPerformance(reports),
    };

    self.postMessage({
      type: "TRENDS_ANALYZED",
      payload: trends,
    } as WorkerResponse);
  } catch (error) {
    console.error("Error analyzing trends:", error);
    self.postMessage({
      type: "ERROR",
      payload: {
        message: `Failed to analyze trends: ${error instanceof Error ? error.message : "Unknown error"}`
      },
    } as WorkerResponse);
  }
}

// Helper functions
function calculateRiskScore(report: Report): number {
  const writeOffsScore = (Number(report.writeOffs) / 1000000) * 0.6;
  const ninetyPlusScore = (Number(report.ninetyPlus) / 1000000) * 0.4;
  return writeOffsScore + ninetyPlusScore;
}

function calculateChange(report: Report): number {
  // Calculate change from previous report
  // This is a placeholder - actual implementation would need access to historical data
  // Using report parameter to avoid unused variable warning
  console.log(
    `Calculating change for report with ID: ${report.id || "unknown"}`,
  );
  return 0;
}

interface TrendResult {
  average: number;
  trend: number;
  direction: "up" | "down" | "stable";
}

function calculateTrend(reports: Report[], field: keyof Report): TrendResult {
  try {
    // Ensure we have valid reports
    if (!Array.isArray(reports) || reports.length === 0) {
      return {
        average: 0,
        trend: 0,
        direction: "stable",
      };
    }
    
    // Extract values with better error handling
    const values = reports.map((r) => {
      if (typeof r !== "object" || r === null) {
        return 0; // Default value for non-object items
      }
      
      // Ensure the field exists and can be converted to a number
      const value = r[field];
      if (value === undefined || value === null) {
        return 0;
      }
      
      const numValue = Number(value);
      return isNaN(numValue) ? 0 : numValue;
    });
    
    // Calculate average and trend
    const average = values.reduce((a, b) => a + b, 0) / values.length || 0;
    const trend = values.length > 0 ? values[values.length - 1] - average : 0;

    return {
      average,
      trend,
      direction: trend > 0 ? "up" : trend < 0 ? "down" : "stable",
    };
  } catch (error) {
    console.error(`Error calculating trend for ${String(field)}:`, error);
    // Return default values in case of error
    return {
      average: 0,
      trend: 0,
      direction: "stable",
    };
  }
}

interface BranchStats {
  totalWriteOffs: number;
  totalNinetyPlus: number;
  count: number;
}

interface BranchPerformance {
  branchId: string;
  averageWriteOffs: number;
  averageNinetyPlus: number;
  reportCount: number;
}

function analyzeBranchPerformance(reports: Report[]): BranchPerformance[] {
  try {
    // Validate input
    if (!Array.isArray(reports)) {
      console.error("Invalid input: reports must be an array");
      return [];
    }
    
    const branchStats = new Map<string, BranchStats>();

    reports.forEach((report) => {
      // Skip invalid reports
      if (typeof report !== 'object' || report === null) {
        return;
      }
      
      const branchId = report.branchId;

      // Skip if branchId is not available
      if (!branchId) return;

      const stats = branchStats.get(branchId) || {
        totalWriteOffs: 0,
        totalNinetyPlus: 0,
        count: 0,
      };

      // Safely convert values to numbers
      const writeOffsValue = Number(report.writeOffs) || 0;
      const ninetyPlusValue = Number(report.ninetyPlus) || 0;
      
      // Only add valid numbers
      stats.totalWriteOffs += !isNaN(writeOffsValue) ? writeOffsValue : 0;
      stats.totalNinetyPlus += !isNaN(ninetyPlusValue) ? ninetyPlusValue : 0;
      stats.count += 1;

      branchStats.set(branchId, stats);
    });

    return Array.from(branchStats.entries()).map(([branchId, stats]) => ({
      branchId,
      averageWriteOffs: stats.count > 0 ? stats.totalWriteOffs / stats.count : 0,
      averageNinetyPlus: stats.count > 0 ? stats.totalNinetyPlus / stats.count : 0,
      reportCount: stats.count,
    }));
  } catch (error) {
    console.error("Error analyzing branch performance:", error);
    return [];
  }
}
