#!/usr/bin/env node

/**
 * Railway Health Check Validator
 * 
 * This script validates that the health check endpoints are properly configured
 * and accessible without authentication, which is critical for Railway deployments.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

function validateMiddleware() {
  console.log('🔍 Validating middleware configuration...');
  
  const middlewarePath = path.join(PROJECT_ROOT, 'src', 'middleware.ts');
  
  if (!fs.existsSync(middlewarePath)) {
    console.log('❌ middleware.ts not found');
    return false;
  }
  
  const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
  
  // Check if health endpoints are excluded from auth
  const healthExcluded = middlewareContent.includes('/api/health') && 
                        middlewareContent.includes('path === "/api/health"');
  
  if (!healthExcluded) {
    console.log('❌ Health endpoints not excluded from authentication in middleware');
    console.log('   Add: path === "/api/health" || path.startsWith("/api/health/")');
    return false;
  }
  
  // Check matcher excludes health endpoints
  const matcherExcludes = middlewareContent.includes('api/health') && 
                         middlewareContent.includes('(?!');
  
  if (!matcherExcludes) {
    console.log('❌ Health endpoints not excluded from middleware matcher');
    console.log('   Add "api/health" to the exclude pattern in matcher');
    return false;
  }
  
  console.log('✅ Middleware properly configured for health checks');
  return true;
}

function validateHealthEndpoint() {
  console.log('🔍 Validating health endpoint...');
  
  const healthPath = path.join(PROJECT_ROOT, 'src', 'app', 'api', 'health', 'route.ts');
  
  if (!fs.existsSync(healthPath)) {
    console.log('❌ Health endpoint not found at /api/health/route.ts');
    return false;
  }
  
  const healthContent = fs.readFileSync(healthPath, 'utf8');
  
  // Check for cache-control headers
  const hasCacheHeaders = healthContent.includes('Cache-Control') && 
                         healthContent.includes('no-cache');
  
  if (!hasCacheHeaders) {
    console.log('⚠️  Health endpoint missing cache-control headers');
    console.log('   Add: Cache-Control: "no-cache, no-store, must-revalidate"');
  } else {
    console.log('✅ Health endpoint has proper cache headers');
  }
  
  console.log('✅ Health endpoint exists');
  return true;
}

function validateRailwayConfig() {
  console.log('🔍 Validating Railway configuration...');
  
  const railwayPath = path.join(PROJECT_ROOT, 'railway.json');
  
  if (!fs.existsSync(railwayPath)) {
    console.log('❌ railway.json not found');
    return false;
  }
  
  const railwayConfig = JSON.parse(fs.readFileSync(railwayPath, 'utf8'));
  
  // Check health check path
  const healthcheckPath = railwayConfig.deploy?.healthcheckPath;
  
  if (healthcheckPath !== '/api/health') {
    console.log('❌ Railway health check path is not set to /api/health');
    console.log(`   Current: ${healthcheckPath || 'not set'}`);
    return false;
  }
  
  console.log('✅ Railway configuration has correct health check path');
  return true;
}

async function testHealthEndpoint() {
  console.log('🔍 Testing local health endpoint access...');
  
  try {
    // Try to import and test the health endpoint
    const healthPath = path.join(PROJECT_ROOT, 'src', 'app', 'api', 'health', 'route.ts');
    
    // Just check if the file can be parsed
    const healthContent = fs.readFileSync(healthPath, 'utf8');
    
    if (healthContent.includes('export async function GET')) {
      console.log('✅ Health endpoint has GET handler');
      return true;
    } else {
      console.log('❌ Health endpoint missing GET handler');
      return false;
    }
  } catch (error) {
    console.log('❌ Error testing health endpoint:', error.message);
    return false;
  }
}

function generateReport(results) {
  console.log('\n📊 Railway Health Check Validation Report');
  console.log('==========================================');
  
  const allPassed = results.every(result => result.passed);
  
  if (allPassed) {
    console.log('🎉 All health check validations passed!');
    console.log('✅ Your app should deploy successfully on Railway');
  } else {
    console.log('⚠️  Some validations failed. Fix these issues before deploying:');
    
    results.forEach(result => {
      if (!result.passed) {
        console.log(`❌ ${result.name}: ${result.message || 'Failed'}`);
      }
    });
    
    console.log('\n💡 Common solutions:');
    console.log('1. Update middleware.ts to exclude /api/health from authentication');
    console.log('2. Add cache-control headers to health endpoint');
    console.log('3. Ensure railway.json has correct healthcheckPath');
    console.log('4. Test health endpoint locally before deploying');
  }
  
  console.log('\n🚀 After fixing issues, deploy with:');
  console.log('   railway up --detach');
  console.log('   railway logs -f');
  
  return allPassed;
}

async function main() {
  console.log('🚂 Railway Health Check Validator');
  console.log('==================================\n');
  
  const results = [
    { name: 'Middleware Configuration', passed: validateMiddleware() },
    { name: 'Health Endpoint Exists', passed: validateHealthEndpoint() },
    { name: 'Railway Configuration', passed: validateRailwayConfig() },
    { name: 'Health Endpoint Handler', passed: await testHealthEndpoint() }
  ];
  
  const success = generateReport(results);
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { validateMiddleware, validateHealthEndpoint, validateRailwayConfig };