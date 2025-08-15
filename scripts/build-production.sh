#!/bin/bash

# Exit on error
set -e

echo "Starting production build process..."

# Set environment variables
export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1

# Disable linting
echo "Disabling linting for build..."
export NEXT_DISABLE_LINT=1

# Patch problematic dependencies
echo "Patching dependencies..."
node scripts/patch-radix-ui.js

# Create a backup of the next.config.cjs file
echo "Creating backup of next.config.cjs..."
cp next.config.cjs next.config.cjs.backup

# Create a simplified next.config.cjs file for the build
echo "Creating simplified next.config.cjs for build..."
cat > next.config.cjs << 'EOL'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    domains: ["bhr.vectoranet.com", "localhost", "cloudinary.com", "reports.lchelpdesk.com", "s3.amazonaws.com"],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com'
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com'
      }
    ]
  },
  webpack: (config) => {
    // Ignore specific webpack errors during build
    config.ignoreWarnings = [
      { message: /Failed to parse source map/ },
      { message: /Critical dependency: the request of a dependency is an expression/ },
    ];
    return config;
  },
  experimental: {
    outputStandalone: true,
  },
};

module.exports = nextConfig;
EOL

# Run the build
echo "Running Next.js build..."
next build --no-lint

# Restore the original next.config.cjs file
echo "Restoring original next.config.cjs..."
mv next.config.cjs.backup next.config.cjs

echo "Production build completed!"
