#!/usr/bin/env node

/**
 * Redis Connection Test Script
 * 
 * Tests that separate Redis connections for cache and pub/sub operations work correctly
 */

// Load environment variables from .env file
require('dotenv').config();

async function testRedisConnections() {
  // Dynamic import to handle ES modules from CommonJS
  let getRedis, getRedisPubSub, getRedisStatus;

  // Import the ES module functions
  try {
    const redisModule = await import('../src/lib/redis.ts');
    getRedis = redisModule.getRedis;
    getRedisPubSub = redisModule.getRedisPubSub;
    getRedisStatus = redisModule.getRedisStatus;
  } catch (error) {
    console.error('❌ Failed to import Redis module:', error.message);
    process.exit(1);
  }
  console.log('🧪 Testing Redis Connection Separation');
  console.log('=====================================');
  
  try {
    // Test 1: Get regular Redis connection for cache operations
    console.log('📦 Testing cache connection...');
    const cacheClient = await getRedis();
    
    // Test basic cache operations
    await cacheClient.set('test:cache', 'cache_value', 'EX', 60);
    const cacheValue = await cacheClient.get('test:cache');
    console.log(`✅ Cache operations work: ${cacheValue}`);
    
    // Test 2: Get pub/sub Redis connection
    console.log('📢 Testing pub/sub connection...');
    const pubsubClient = await getRedisPubSub();
    
    // Test pub/sub operations
    await pubsubClient.subscribe('test:channel');
    console.log('✅ Pub/sub subscribe works');
    
    // Test 3: Try cache operations on cache client while pub/sub is active
    console.log('🔄 Testing cache operations while pub/sub is active...');
    await cacheClient.set('test:cache2', 'cache_value2', 'EX', 60);
    const cacheValue2 = await cacheClient.get('test:cache2');
    console.log(`✅ Cache operations still work: ${cacheValue2}`);
    
    // Test 4: Check connection status
    console.log('📊 Connection status:');
    const status = getRedisStatus();
    console.log('Cache connection:', status.cache);
    console.log('PubSub connection:', status.pubsub);
    
    // Cleanup
    await pubsubClient.unsubscribe('test:channel');
    await cacheClient.del('test:cache', 'test:cache2');
    
    console.log('');
    console.log('🎉 All tests passed! Redis connections are properly separated.');
    console.log('✅ Cache operations and pub/sub can run simultaneously');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.log('');
    console.log('💡 This indicates the Redis connection separation fix is needed');
    process.exit(1);
  }
}

// Convert to async IIFE to handle top-level await
(async () => {
  await testRedisConnections();
})().catch(console.error);

module.exports = { testRedisConnections };