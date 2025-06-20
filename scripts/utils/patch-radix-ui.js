// This script patches the problematic @radix-ui modules
import fs from "fs";
import path from "path";

console.log("Patching @radix-ui modules...");

// Path to the problematic module
const useEffectEventPath = path.resolve(
  "./node_modules/@radix-ui/react-use-effect-event/dist/index.mjs",
);

// Check if the file exists
if (fs.existsSync(useEffectEventPath)) {
  console.log(`Patching ${useEffectEventPath}`);

  // Create a backup if it doesn't exist
  const backupPath = `${useEffectEventPath}.backup`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(useEffectEventPath, backupPath);
    console.log("Created backup of original file");
  }

  // Replace the entire file with a simplified version that doesn't use useEffectEvent
  const patchedContent = `
// Patched version of @radix-ui/react-use-effect-event
// Original file was causing build errors due to missing useEffectEvent in React

// Simple implementation that doesn't rely on useEffectEvent
export function useEffectEvent(callback) {
  return callback;
}
`;

  // Write the patched file
  fs.writeFileSync(useEffectEventPath, patchedContent, "utf8");
  console.log("Patched successfully!");
} else {
  console.log(`File not found: ${useEffectEventPath}`);
}

// Also patch the nested dependency in react-radio-group
const nestedDependencyPath = path.resolve(
  "./node_modules/@radix-ui/react-radio-group/node_modules/@radix-ui/react-use-controllable-state/dist/index.mjs",
);
if (fs.existsSync(nestedDependencyPath)) {
  console.log(`Checking ${nestedDependencyPath}`);

  // Create a backup if it doesn't exist
  const backupPath = `${nestedDependencyPath}.backup`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(nestedDependencyPath, backupPath);
    console.log("Created backup of original nested dependency file");
  }

  // Read the file content
  let content = fs.readFileSync(nestedDependencyPath, "utf8");

  // Check if it imports from react-use-effect-event
  if (content.includes("@radix-ui/react-use-effect-event")) {
    console.log("Patching nested dependency imports...");

    // Replace the import with a direct implementation
    content = content.replace(
      /import\s*\{\s*useEffectEvent\s*\}\s*from\s*['"]@radix-ui\/react-use-effect-event['"];?/,
      "// Patched import\nconst useEffectEvent = (callback) => callback;",
    );

    // Write the patched file
    fs.writeFileSync(nestedDependencyPath, content, "utf8");
    console.log("Patched nested dependency successfully!");
  } else {
    console.log("No problematic imports found in nested dependency");
  }
} else {
  console.log(`Nested dependency file not found: ${nestedDependencyPath}`);
}

// Also patch the react-radio-group module
const radioGroupPath = path.resolve(
  "./node_modules/@radix-ui/react-radio-group/dist/index.mjs",
);
if (fs.existsSync(radioGroupPath)) {
  console.log(`Checking ${radioGroupPath}`);

  // Create a backup if it doesn't exist
  const backupPath = `${radioGroupPath}.backup`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(radioGroupPath, backupPath);
    console.log("Created backup of original radio-group file");
  }

  // Read the file content
  let content = fs.readFileSync(radioGroupPath, "utf8");

  // Check if it imports from react-use-effect-event
  if (content.includes("@radix-ui/react-use-effect-event")) {
    console.log("Patching radio-group imports...");

    // Replace the import with a direct implementation
    content = content.replace(
      /import\s*\{\s*useEffectEvent\s*\}\s*from\s*['"]@radix-ui\/react-use-effect-event['"];?/,
      "// Patched import\nconst useEffectEvent = (callback) => callback;",
    );

    // Write the patched file
    fs.writeFileSync(radioGroupPath, content, "utf8");
    console.log("Patched radio-group successfully!");
  } else {
    console.log("No problematic imports found in radio-group");
  }
} else {
  console.log(`Radio group file not found: ${radioGroupPath}`);
}

console.log("Patching complete!");
