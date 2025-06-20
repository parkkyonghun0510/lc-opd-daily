import { NextRequest, NextResponse } from "next/server";
import { generatePrometheusMetrics } from "@/lib/monitoring/prometheusExporter";

/**
 * Prometheus Metrics Endpoint
 *
 * This endpoint exposes SSE metrics in Prometheus format for scraping
 * by Prometheus monitoring system.
 *
 * It should be secured in production environments to prevent unauthorized access.
 */
export async function GET(req: NextRequest) {
  try {
    // In production, you should add authentication here
    // For example, using an API key or basic auth

    // Check for API key (simple example)
    const apiKey = req.headers.get("x-api-key");
    const configuredApiKey = process.env.METRICS_API_KEY;

    if (configuredApiKey && apiKey !== configuredApiKey) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Generate Prometheus metrics
    const metrics = generatePrometheusMetrics();

    // Return the metrics with the correct content type
    return new Response(metrics, {
      headers: {
        "Content-Type": "text/plain; version=0.0.4",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[Metrics] Error generating metrics:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
