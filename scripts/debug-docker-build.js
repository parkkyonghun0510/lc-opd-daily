#!/usr/bin/env node

/**
 * Docker Build Debug Script
 * 
 * This script helps debug and verify the Docker build process for Railway deployment
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, existsSync } from 'fs';

const execAsync = promisify(exec);

console.log('🔍 Docker Build Debug Report\n');

// Check if dist directory exists and has worker files
const distFiles = [
  'dist/workers/dragonfly-worker.js',
  'dist/lib/dragonfly-queue.js',
  'dist/lib/notifications/dragonflyNotificationService.js'
];

console.log('📁 Checking dist files:');
for (const file of distFiles) {
  if (existsSync(file)) {
    const stats = readFileSync(file, 'utf8');
    console.log(`✅ ${file}: ${(stats.length / 1024).toFixed(1)} KB`);
  } else {
    console.log(`❌ Missing: ${file}`);
  }
}

// Check Dockerfile for dist copy command
console.log('\n🐳 Checking Dockerfile configuration:');
const dockerfile = readFileSync('Dockerfile', 'utf8');
if (dockerfile.includes('COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist')) {
  console.log('✅ Dockerfile copies dist directory');
} else {
  console.log('❌ Dockerfile missing dist copy command');
}

// Check .dockerignore
console.log('\n🚫 Checking .dockerignore:');
const dockerignore = readFileSync('.dockerignore', 'utf8');
if (dockerignore.includes('dist')) {
  console.log('⚠️  WARNING: dist directory is ignored in .dockerignore');
  console.log('   This means dist files won\'t be copied to Docker context');
} else {
  console.log('✅ dist directory not ignored');
}

// Check PM2 configuration
console.log('\n⚙️  Checking PM2 configuration:');
const pm2Config = readFileSync('ecosystem.production.config.cjs', 'utf8');
if (pm2Config.includes('dist/workers/dragonfly-worker.js')) {
  console.log('✅ PM2 configured for Dragonfly worker');
} else {
  console.log('❌ PM2 not configured for Dragonfly worker');
}

// Check build script
console.log('\n🏗️  Checking build configuration:');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
if (packageJson.scripts && packageJson.scripts['build:production']) {
  console.log('✅ build:production script found');
  console.log(`   Command: ${packageJson.scripts['build:production']}`);
} else {
  console.log('❌ build:production script not found');
}

console.log('\n🎯 Recommendations:');
console.log('1. Remove "dist" from .dockerignore to include compiled files');
console.log('2. Ensure build runs during Docker build process');
console.log('3. Verify COPY commands include dist directory');
console.log('4. Check PM2 points to correct worker file path');

console.log('\n📋 Next Steps:');
console.log('1. Run: npm run build:production');
console.log('2. Verify dist files exist');
console.log('3. Update .dockerignore if needed');
console.log('4. Test Docker build locally');
console.log('5. Deploy to Railway');