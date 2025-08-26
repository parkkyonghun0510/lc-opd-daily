#!/usr/bin/env node

/**
 * Redis Subscriber Mode Diagnostic Tool
 * 
 * Analyzes Redis connection usage patterns and identifies potential subscriber mode conflicts
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

function analyzeRedisUsage() {
  console.log('🔍 Redis Subscriber Mode Diagnostic');
  console.log('==================================');
  
  const issues = [];
  const recommendations = [];
  
  // Check for files that might be mixing Redis operations
  const filesToCheck = [
    'src/lib/cache-warmer.ts',
    'src/lib/cache-monitor.ts',
    'src/app/api/dashboard/stats/route.ts',
    'src/app/api/dashboard/charts/route.ts',
    'src/lib/sse/redisSSEHandler.ts',
    'src/lib/dragonfly/dragonflyPubSub.ts',
    'src/lib/realtime/redisEventEmitter.ts'
  ];
  
  console.log('📁 Analyzing files for Redis usage patterns...\n');
  
  filesToCheck.forEach(filePath => {
    const fullPath = path.join(PROJECT_ROOT, filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return;
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    
    console.log(`📄 ${filePath}:`);
    
    // Check for Redis import patterns
    const hasGetRedis = content.includes('getRedis');
    const hasGetRedisPubSub = content.includes('getRedisPubSub');
    const hasSubscribe = content.includes('.subscribe(') || content.includes('.psubscribe(');
    const hasCacheOps = content.includes('.set(') || content.includes('.get(') || content.includes('.del(');
    
    if (hasSubscribe && hasCacheOps && !hasGetRedisPubSub) {
      issues.push({
        file: filePath,
        type: 'mixed_operations',
        message: 'File contains both subscribe and cache operations but only uses getRedis()'
      });
      console.log('  ❌ Mixed Redis operations detected');
      console.log('     - Contains subscribe operations AND cache operations');
      console.log('     - Only imports getRedis() - should also use getRedisPubSub()');
    } else if (hasSubscribe && hasGetRedisPubSub) {
      console.log('  ✅ Properly uses getRedisPubSub() for subscriber operations');
    } else if (hasCacheOps && hasGetRedis) {
      console.log('  ✅ Uses getRedis() for cache operations');
    } else if (hasSubscribe) {
      console.log('  📢 Contains pub/sub operations');
    } else if (hasCacheOps) {
      console.log('  💾 Contains cache operations');
    } else {
      console.log('  ℹ️  No Redis operations detected');
    }
    
    console.log('');
  });
  
  // Generate recommendations
  if (issues.length > 0) {
    console.log('🚨 Issues Found:');
    console.log('===============');
    
    issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.file}`);
      console.log(`   Problem: ${issue.message}`);
      
      if (issue.type === 'mixed_operations') {
        console.log('   Solution: Update imports to include getRedisPubSub');
        console.log('   - Change: import { getRedis } from "..."');
        console.log('   - To: import { getRedis, getRedisPubSub } from "..."');
        console.log('   - Use getRedisPubSub() for subscribe/publish operations');
        console.log('   - Use getRedis() for cache operations (get/set/del)');
      }
      console.log('');
    });
    
    console.log('💡 General Recommendations:');
    console.log('==========================');
    console.log('1. Use getRedis() for cache operations (get, set, del, etc.)');
    console.log('2. Use getRedisPubSub() for pub/sub operations (subscribe, publish)');
    console.log('3. Never mix cache and pub/sub operations on the same connection');
    console.log('4. Monitor Railway logs for "Connection in subscriber mode" errors');
    console.log('');
    console.log('🔧 Quick Fix Commands:');
    console.log('======================');
    console.log('1. Update imports: npm run fix:redis-imports (if available)');
    console.log('2. Test connections: npm run test:redis');
    console.log('3. Deploy: railway up --detach');
    console.log('4. Monitor: railway logs -f');
    
  } else {
    console.log('✅ No Redis subscriber mode issues detected!');
    console.log('All files appear to be using Redis connections correctly.');
  }
  
  return issues.length === 0;
}

function checkEnvironmentVariables() {
  console.log('🌍 Environment Variables Check:');
  console.log('==============================');
  
  const requiredVars = ['DRAGONFLY_URL', 'REDIS_URL'];
  const hasRedisUrl = requiredVars.some(varName => process.env[varName]);
  
  if (hasRedisUrl) {
    console.log('✅ Redis URL configured');
  } else {
    console.log('⚠️  No Redis URL found in environment');
    console.log('   Set DRAGONFLY_URL or REDIS_URL in Railway dashboard');
  }
  
  return hasRedisUrl;
}

function generateReport(analysisResult, envResult) {
  console.log('\n📊 Diagnostic Summary:');
  console.log('======================');
  
  if (analysisResult && envResult) {
    console.log('🎉 All checks passed!');
    console.log('✅ Redis connections should work correctly on Railway');
    console.log('✅ No subscriber mode conflicts detected');
  } else {
    console.log('⚠️  Issues detected that may cause subscriber mode errors');
    console.log('');
    console.log('🚀 Next Steps:');
    console.log('1. Fix the issues listed above');
    console.log('2. Test locally: npm run test:redis');
    console.log('3. Deploy: railway up --detach');
    console.log('4. Monitor: railway logs -f');
    console.log('5. Test health: ./scripts/test-railway-health.sh');
  }
}

async function main() {
  console.log('🩺 Redis Subscriber Mode Diagnostic Tool');
  console.log('=========================================\n');
  
  const analysisResult = analyzeRedisUsage();
  const envResult = checkEnvironmentVariables();
  
  generateReport(analysisResult, envResult);
  
  process.exit(analysisResult && envResult ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { analyzeRedisUsage, checkEnvironmentVariables };