// Web Worker for handling report processing tasks

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
  const { type, payload } = e.data;

  switch (type) {
    case "PROCESS_REPORTS":
      await processReports(payload);
      break;

    case "CACHE_REPORTS":
      cacheReports(payload);
      break;

    case "ANALYZE_TRENDS":
      analyzeTrends(payload);
      break;
  }
};

// Process reports in background
async function processReports(reports: Report[]): Promise<void> {
  const processedReports = reports.map((report) => {
    // Skip processing if not an object
    if (typeof report !== "object" || report === null) {
      return report;
    }

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
  });

  self.postMessage({
    type: "REPORTS_PROCESSED",
    payload: processedReports,
  });
}

// Cache reports for offline access
function cacheReports(reports: Report[]): void {
  try {
    // Store in IndexedDB for offline access
    const request = indexedDB.open("ReportsCache", 1);

    request.onupgradeneeded = (event: Event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("reports")) {
        db.createObjectStore("reports", { keyPath: "id" });
      }
    };

    request.onsuccess = (event: Event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction(["reports"], "readwrite");
      const store = transaction.objectStore("reports");

      reports.forEach((report) => {
        store.put(report);
      });

      self.postMessage({
        type: "REPORTS_CACHED",
        payload: { count: reports.length },
      } as WorkerResponse);
    };
  } catch (error) {
    self.postMessage({
      type: "ERROR",
      payload: {
        message: `Failed to cache reports: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
    } as WorkerResponse);
  }
}

// Analyze trends in report data
function analyzeTrends(reports: Report[]): void {
  const trends = {
    writeOffs: calculateTrend(reports, "writeOffs"),
    ninetyPlus: calculateTrend(reports, "ninetyPlus"),
    branchPerformance: analyzeBranchPerformance(reports),
  };

  self.postMessage({
    type: "TRENDS_ANALYZED",
    payload: trends,
  } as WorkerResponse);
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
  const values = reports.map((r) => {
    if (typeof r !== "object" || r === null) {
      return 0; // Default value for non-object items
    }
    return Number(r[field]);
  });
  const average = values.reduce((a, b) => a + b, 0) / values.length || 0;
  const trend = values[values.length - 1] - average;

  return {
    average,
    trend,
    direction: trend > 0 ? "up" : trend < 0 ? "down" : "stable",
  };
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
  const branchStats = new Map<string, BranchStats>();

  reports.forEach((report) => {
    const branchId = report.branchId;

    // Skip if branchId is not available
    if (!branchId) return;

    const stats = branchStats.get(branchId) || {
      totalWriteOffs: 0,
      totalNinetyPlus: 0,
      count: 0,
    };

    stats.totalWriteOffs += Number(report.writeOffs) || 0;
    stats.totalNinetyPlus += Number(report.ninetyPlus) || 0;
    stats.count += 1;

    branchStats.set(branchId, stats);
  });

  return Array.from(branchStats.entries()).map(([branchId, stats]) => ({
    branchId,
    averageWriteOffs: stats.totalWriteOffs / stats.count,
    averageNinetyPlus: stats.totalNinetyPlus / stats.count,
    reportCount: stats.count,
  }));
}
