import { redis } from "./redis";

const METRICS_KEY = "cache:metrics";

interface CacheMetrics {
  hits: number;
  misses: number;
  lastReset: string;
}

export async function recordCacheHit(key: string) {
  const metrics = await getMetrics();
  metrics.hits += 1;
  await saveMetrics(metrics);

  // Log for monitoring
  //console.log(`Cache HIT for key: ${key}`);
}

export async function recordCacheMiss(key: string) {
  const metrics = await getMetrics();
  metrics.misses += 1;
  await saveMetrics(metrics);

  // Log for monitoring
  //console.log(`Cache MISS for key: ${key}`);
}

async function getMetrics(): Promise<CacheMetrics> {
  const metrics = await redis.get<CacheMetrics>(METRICS_KEY);
  if (!metrics) {
    return {
      hits: 0,
      misses: 0,
      lastReset: new Date().toISOString(),
    };
  }
  return metrics;
}

async function saveMetrics(metrics: CacheMetrics) {
  await redis.set(METRICS_KEY, metrics);
}

export async function getCacheStats() {
  const metrics = await getMetrics();
  const total = metrics.hits + metrics.misses;
  const hitRate = total > 0 ? (metrics.hits / total) * 100 : 0;

  return {
    ...metrics,
    total,
    hitRate: Math.round(hitRate * 100) / 100, // Round to 2 decimal places
  };
}

export async function resetMetrics() {
  await redis.set(METRICS_KEY, {
    hits: 0,
    misses: 0,
    lastReset: new Date().toISOString(),
  });
}
