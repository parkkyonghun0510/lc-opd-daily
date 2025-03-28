#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Directories to process
const dirs = ['dist/workers', 'dist/lib', 'dist/utils', 'dist/lib/queue'];

// Process all JS files in the specified directories
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir).filter(file => file.endsWith('.js'));
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace import paths based on directory depth
    const depth = dir.split('/').length - 1;
    const prefix = '../'.repeat(depth);
    
    content = content.replace(
      /from\s+["']@\/(.*?)["']/g, 
      (match, p1) => `from "${prefix}${p1}"`
    );
    
    // Handle relative imports for nested directories
    if (depth > 1) {
      content = content.replace(
        /from\s+["']\.\.\/(.*?)["']/g,
        (match, p1) => `from "${prefix}../${p1}"`
      );
    }
    
    // Write the modified content back
    fs.writeFileSync(filePath, content);
    console.log(`Fixed imports in ${filePath}`);
  });
});

// Add index.js files to help with imports
if (!fs.existsSync('dist/index.js')) {
  fs.writeFileSync('dist/index.js', `
// This file helps with imports
export * from './lib/index.js';
export * from './utils/index.js';
  `);
  console.log('Created dist/index.js');
}

if (!fs.existsSync('dist/lib/index.js')) {
  fs.writeFileSync('dist/lib/index.js', `
// This file helps with imports
export * from './prisma.js';
export * from './queue/index.js';
  `);
  console.log('Created dist/lib/index.js');
}

if (!fs.existsSync('dist/lib/queue/index.js')) {
  fs.writeFileSync('dist/lib/queue/index.js', `
// This file helps with imports
export * from './sqs.js';
  `);
  console.log('Created dist/lib/queue/index.js');
}

if (!fs.existsSync('dist/utils/index.js')) {
  fs.writeFileSync('dist/utils/index.js', `
// This file helps with imports
export * from './notificationTemplates.js';
export * from './notificationTargeting.js';
  `);
  console.log('Created dist/utils/index.js');
}

console.log('Path fixing completed'); 