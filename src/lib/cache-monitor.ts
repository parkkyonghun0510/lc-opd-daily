import { getRedis } from "./redis";

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
  const redisClient = await getRedis();
  const raw = await redisClient.get(METRICS_KEY);
  if (!raw) {
    return {
      hits: 0,
      misses: 0,
      lastReset: new Date().toISOString(),
    };
  }
  try {
    const parsed = JSON.parse(raw) as CacheMetrics;
    return parsed;
  } catch {
    // If parsing fails, reset metrics to a sane default
    return {
      hits: 0,
      misses: 0,
      lastReset: new Date().toISOString(),
    };
  }
}

async function saveMetrics(metrics: CacheMetrics) {
  const redisClient = await getRedis();
  await redisClient.set(METRICS_KEY, JSON.stringify(metrics));
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
  const redisClient = await getRedis();
  await redisClient.set(
    METRICS_KEY,
    JSON.stringify({
      hits: 0,
      misses: 0,
      lastReset: new Date().toISOString(),
    })
  );
}
