#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Directories to process
const dirs = ['dist/workers', 'dist/lib', 'dist/utils'];

// Process all JS files in the specified directories
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir).filter(file => file.endsWith('.js'));
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace import paths
    content = content.replace(
      /from\s+["']@\/(.*?)["']/g, 
      (match, p1) => `from "../${p1}"`
    );
    
    // Write the modified content back
    fs.writeFileSync(filePath, content);
    //console.log(`Fixed imports in ${filePath}`);
  });
});

//console.log('Path fixing completed'); 