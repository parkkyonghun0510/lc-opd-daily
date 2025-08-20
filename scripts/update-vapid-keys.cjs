#!/usr/bin/env node

/**
 * Script to update VAPID keys in .env.production file
 * Usage: node scripts/update-vapid-keys.js <public_key> <private_key> <contact_email>
 */

const fs = require('fs');
const path = require('path');

// Get command line arguments
const [,, publicKey, privateKey, contactEmail] = process.argv;

if (!publicKey || !privateKey || !contactEmail) {
  console.error('Usage: node scripts/update-vapid-keys.js <public_key> <private_key> <contact_email>');
  process.exit(1);
}

// Define paths for environment files
const envProductionPath = path.join(process.cwd(), '.env.production');
const envProductionTemplatePath = path.join(process.cwd(), '.env.production.template');

// Function to update or add VAPID keys to an env file
function updateEnvFile(filePath) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`Creating new file: ${filePath}`);
      fs.writeFileSync(filePath, '');
    }

    // Read the current content
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Update or add VAPID keys
    const vapidPublicKeyRegex = /^NEXT_PUBLIC_VAPID_PUBLIC_KEY=.*/m;
    const vapidPrivateKeyRegex = /^VAPID_PRIVATE_KEY=.*/m;
    const vapidContactEmailRegex = /^VAPID_CONTACT_EMAIL=.*/m;
    
    if (vapidPublicKeyRegex.test(content)) {
      content = content.replace(vapidPublicKeyRegex, `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
    } else {
      content += `\nNEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`;
    }
    
    if (vapidPrivateKeyRegex.test(content)) {
      content = content.replace(vapidPrivateKeyRegex, `VAPID_PRIVATE_KEY=${privateKey}`);
    } else {
      content += `\nVAPID_PRIVATE_KEY=${privateKey}`;
    }
    
    if (vapidContactEmailRegex.test(content)) {
      content = content.replace(vapidContactEmailRegex, `VAPID_CONTACT_EMAIL=${contactEmail}`);
    } else {
      content += `\nVAPID_CONTACT_EMAIL=${contactEmail}`;
    }
    
    // Write the updated content back to the file
    fs.writeFileSync(filePath, content);
    console.log(`Updated VAPID keys in ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error);
    return false;
  }
}

// Update both files
const productionUpdated = updateEnvFile(envProductionPath);
const templateUpdated = updateEnvFile(envProductionTemplatePath);

if (productionUpdated && templateUpdated) {
  console.log('VAPID keys successfully updated in all environment files.');
  console.log('\nRemember to restart your application for the changes to take effect.');
} else {
  console.error('Failed to update one or more environment files.');
  process.exit(1);
}