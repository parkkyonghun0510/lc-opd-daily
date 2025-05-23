// Web Worker for handling report processing tasks
let processingQueue: any[] = [];

// Handle messages from the main thread
self.onmessage = async (e) => {
    const { type, payload } = e.data;

    switch (type) {
        case 'PROCESS_REPORTS':
            await processReports(payload);
            break;

        case 'CACHE_REPORTS':
            cacheReports(payload);
            break;

        case 'ANALYZE_TRENDS':
            analyzeTrends(payload);
            break;
    }
};

// Process reports in background
async function processReports(reports: any[]) {
    processingQueue = reports;

    const processedReports = reports.map(report => ({
        ...report,
        writeOffs: typeof report.writeOffs === 'object' ? Number(report.writeOffs) : report.writeOffs,
        ninetyPlus: typeof report.ninetyPlus === 'object' ? Number(report.ninetyPlus) : report.ninetyPlus,
        // Add computed fields
        riskScore: calculateRiskScore(report),
        changeFromLastReport: calculateChange(report),
    }));

    self.postMessage({
        type: 'REPORTS_PROCESSED',
        payload: processedReports
    });
}

// Cache reports for offline access
function cacheReports(reports: any[]) {
    try {
        // Store in IndexedDB for offline access
        const request = indexedDB.open('ReportsCache', 1);

        request.onupgradeneeded = (event: any) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('reports')) {
                db.createObjectStore('reports', { keyPath: 'id' });
            }
        };

        request.onsuccess = (event: any) => {
            const db = event.target.result;
            const transaction = db.transaction(['reports'], 'readwrite');
            const store = transaction.objectStore('reports');

            reports.forEach(report => {
                store.put(report);
            });

            self.postMessage({
                type: 'REPORTS_CACHED',
                payload: { count: reports.length }
            });
        };
    } catch (error) {
        self.postMessage({
            type: 'ERROR',
            payload: { message: 'Failed to cache reports' }
        });
    }
}

// Analyze trends in report data
function analyzeTrends(reports: any[]) {
    const trends = {
        writeOffs: calculateTrend(reports, 'writeOffs'),
        ninetyPlus: calculateTrend(reports, 'ninetyPlus'),
        branchPerformance: analyzeBranchPerformance(reports),
    };

    self.postMessage({
        type: 'TRENDS_ANALYZED',
        payload: trends
    });
}

// Helper functions
function calculateRiskScore(report: any) {
    const writeOffsScore = (report.writeOffs / 1000000) * 0.6;
    const ninetyPlusScore = (report.ninetyPlus / 1000000) * 0.4;
    return writeOffsScore + ninetyPlusScore;
}

function calculateChange(report: any) {
    // Calculate change from previous report
    // This is a placeholder - actual implementation would need access to historical data
    return 0;
}

function calculateTrend(reports: any[], field: string) {
    const values = reports.map(r => Number(r[field]));
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const trend = values[values.length - 1] - average;

    return {
        average,
        trend,
        direction: trend > 0 ? 'up' : trend < 0 ? 'down' : 'stable'
    };
}

function analyzeBranchPerformance(reports: any[]) {
    const branchStats = new Map();

    reports.forEach(report => {
        const stats = branchStats.get(report.branchId) || {
            totalWriteOffs: 0,
            totalNinetyPlus: 0,
            count: 0
        };

        stats.totalWriteOffs += Number(report.writeOffs);
        stats.totalNinetyPlus += Number(report.ninetyPlus);
        stats.count += 1;

        branchStats.set(report.branchId, stats);
    });

    return Array.from(branchStats.entries()).map(([branchId, stats]) => ({
        branchId,
        averageWriteOffs: stats.totalWriteOffs / stats.count,
        averageNinetyPlus: stats.totalNinetyPlus / stats.count,
        reportCount: stats.count
    }));
}