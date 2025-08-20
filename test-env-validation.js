// Test script to validate environment variables
require('dotenv').config();

// Import the validator
const { EnvironmentValidator } = require('./src/lib/env-validator.ts');

console.log('🔍 Testing Environment Validation...\n');

// Get validator instance
const validator = EnvironmentValidator.getInstance();

// Clear any cached results
validator.clearCache();

// Run validation
const result = validator.validateEnvironment();

console.log('Validation Result:');
console.log('- Success:', result.success);
console.log('- Errors:', result.errors);
console.log('- Warnings:', result.warnings);

if (result.success) {
  console.log('\n✅ Environment validation passed!');
} else {
  console.log('\n❌ Environment validation failed!');
  console.log('Errors:');
  result.errors.forEach(error => console.log(`  • ${error}`));
}

if (result.warnings.length > 0) {
  console.log('\nWarnings:');
  result.warnings.forEach(warning => console.log(`  • ${warning}`));
}