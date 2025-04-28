// This script patches problematic dependencies for the build process
import fs from 'fs';
import path from 'path';

console.log('Patching dependencies for build...');

// Path to the problematic module
const useEffectEventPath = path.resolve('./node_modules/@radix-ui/react-use-effect-event/dist/index.mjs');

// Check if the file exists
if (fs.existsSync(useEffectEventPath)) {
  console.log(`Patching ${useEffectEventPath}`);
  
  // Read the original file
  let content = fs.readFileSync(useEffectEventPath, 'utf8');
  
  // Replace the import of useEffectEvent from React with our custom shim
  content = content.replace(
    "import { useEffectEvent as React_useEffectEvent } from 'react';",
    "// Patched import for build compatibility\n// Original: import { useEffectEvent as React_useEffectEvent } from 'react';\n// Using custom shim instead\nconst React_useEffectEvent = function(callback) { return callback; };"
  );
  
  // Write the patched file
  fs.writeFileSync(useEffectEventPath, content, 'utf8');
  console.log('Patched successfully!');
} else {
  console.log(`File not found: ${useEffectEventPath}`);
}

console.log('Dependency patching complete.');
