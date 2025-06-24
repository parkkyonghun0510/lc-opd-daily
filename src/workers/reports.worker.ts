// Web Worker for handling report processing tasks
// Commented out unused variable
// let processingQueue: any[] = [];

// Handle messages from the main thread
self.onmessage = async (e) => {
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
async function processReports(reports: unknown[]) {
  // processingQueue = reports;

  const processedReports = reports.map((report) => {
    // Type guard to ensure report is a Record<string, unknown>
    if (typeof report !== "object" || report === null) {
      return report; // Skip processing if not an object
    }

    const typedReport = report as Record<string, unknown>;

    return {
      ...typedReport,
      writeOffs:
        typeof typedReport.writeOffs === "object"
          ? Number(typedReport.writeOffs)
          : typedReport.writeOffs,
      ninetyPlus:
        typeof typedReport.ninetyPlus === "object"
          ? Number(typedReport.ninetyPlus)
          : typedReport.ninetyPlus,
      // Add computed fields
      riskScore: calculateRiskScore(typedReport),
      changeFromLastReport: calculateChange(typedReport),
    };
  });

  self.postMessage({
    type: "REPORTS_PROCESSED",
    payload: processedReports,
  });
}

// Cache reports for offline access
function cacheReports(reports: unknown[]) {
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
      });
    };
  } catch (error) {
    self.postMessage({
      type: "ERROR",
      payload: {
        message: `Failed to cache reports: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
    });
  }
}

// Analyze trends in report data
function analyzeTrends(reports: unknown[]) {
  const trends = {
    writeOffs: calculateTrend(reports, "writeOffs"),
    ninetyPlus: calculateTrend(reports, "ninetyPlus"),
    branchPerformance: analyzeBranchPerformance(reports),
  };

  self.postMessage({
    type: "TRENDS_ANALYZED",
    payload: trends,
  });
}

// Helper functions
function calculateRiskScore(report: Record<string, unknown>) {
  const writeOffsScore = (Number(report.writeOffs) / 1000000) * 0.6;
  const ninetyPlusScore = (Number(report.ninetyPlus) / 1000000) * 0.4;
  return writeOffsScore + ninetyPlusScore;
}

function calculateChange(report: Record<string, unknown>) {
  // Calculate change from previous report
  // This is a placeholder - actual implementation would need access to historical data
  // Using report parameter to avoid unused variable warning
  console.log(
    `Calculating change for report with ID: ${report.id || "unknown"}`,
  );
  return 0;
}

function calculateTrend(reports: unknown[], field: string) {
  const values = reports.map((r) => {
    if (typeof r !== "object" || r === null) {
      return 0; // Default value for non-object items
    }
    const typedR = r as Record<string, unknown>;
    return Number(typedR[field]);
  });
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  const trend = values[values.length - 1] - average;

  return {
    average,
    trend,
    direction: trend > 0 ? "up" : trend < 0 ? "down" : "stable",
  };
}

function analyzeBranchPerformance(reports: unknown[]) {
  const branchStats = new Map();

  reports.forEach((report) => {
    // Type guard to ensure report is a Record<string, unknown>
    if (typeof report !== "object" || report === null) {
      return; // Skip non-object items
    }

    const typedReport = report as Record<string, unknown>;
    const branchId = typedReport.branchId;

    // Skip if branchId is not available
    if (!branchId) return;

    const stats = branchStats.get(branchId) || {
      totalWriteOffs: 0,
      totalNinetyPlus: 0,
      count: 0,
    };

    stats.totalWriteOffs += Number(typedReport.writeOffs) || 0;
    stats.totalNinetyPlus += Number(typedReport.ninetyPlus) || 0;
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
