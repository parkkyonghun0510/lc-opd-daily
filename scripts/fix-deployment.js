#!/usr/bin/env node

/**
 * Deployment Fix Script for Dragonfly Worker
 * Ensures the dragonfly-worker.js is properly built and available
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const WORKER_PATH = path.join(process.cwd(), 'dist', 'workers', 'dragonfly-worker.js');
const REQUIRED_FILES = [
  WORKER_PATH,
  path.join(process.cwd(), 'dist', 'lib', 'dragonfly-queue.js'),
  path.join(process.cwd(), 'dist', 'lib', 'prisma.js')
];

console.log('🔧 Deployment Fix: Verifying Dragonfly Worker Setup...\n');

// Function to check if file exists
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

// Function to get file stats
function getFileStats(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return {
      size: stats.size,
      modified: stats.mtime,
      readable: fs.accessSync(filePath, fs.constants.R_OK) === undefined
    };
  } catch (error) {
    return null;
  }
}

// Check if workers directory exists
const workersDir = path.join(process.cwd(), 'dist', 'workers');
const libDir = path.join(process.cwd(), 'dist', 'lib');

console.log('📁 Checking directory structure...');
console.log(`Workers directory: ${workersDir} - ${fs.existsSync(workersDir) ? '✅' : '❌'}`);
console.log(`Lib directory: ${libDir} - ${fs.existsSync(libDir) ? '✅' : '❌'}`);

// Check all required files
let allFilesExist = true;
console.log('\n📋 Checking required files...');

REQUIRED_FILES.forEach(filePath => {
  const exists = fileExists(filePath);
  const stats = exists ? getFileStats(filePath) : null;
  
  console.log(`${exists ? '✅' : '❌'} ${path.relative(process.cwd(), filePath)}`);
  
  if (exists && stats) {
    console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB, Modified: ${stats.modified.toLocaleString()}`);
  }
  
  if (!exists) {
    allFilesExist = false;
  }
});

// Build workers if any files are missing
if (!allFilesExist) {
  console.log('\n🔄 Building workers...');
  try {
    execSync('npm run build:worker', { stdio: 'inherit' });
    console.log('✅ Workers built successfully');
  } catch (error) {
    console.error('❌ Failed to build workers:', error.message);
    process.exit(1);
  }
} else {
  console.log('✅ All required files exist');
}

// Verify dragonfly-worker.js specifically
console.log('\n🔍 Verifying dragonfly-worker.js...');
if (fileExists(WORKER_PATH)) {
  const stats = getFileStats(WORKER_PATH);
  console.log(`✅ dragonfly-worker.js exists and is ${(stats.size / 1024).toFixed(2)} KB`);
  
  // Check file permissions
  try {
    fs.accessSync(WORKER_PATH, fs.constants.R_OK);
    console.log('✅ dragonfly-worker.js is readable');
  } catch (error) {
    console.error('❌ dragonfly-worker.js is not readable');
    process.exit(1);
  }
} else {
  console.error('❌ dragonfly-worker.js not found');
  process.exit(1);
}

// List all files in workers directory
console.log('\n📂 Files in dist/workers/:');
try {
  const files = fs.readdirSync(workersDir);
  files.forEach(file => {
    const filePath = path.join(workersDir, file);
    const stats = getFileStats(filePath);
    console.log(`  ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
  });
} catch (error) {
  console.error('❌ Could not list workers directory');
}

console.log('\n🎉 Deployment verification complete!');
console.log('The dragonfly-worker.js is ready for production deployment.');