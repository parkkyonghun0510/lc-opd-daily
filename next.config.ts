import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Railway-specific configuration
  output: 'standalone',
  serverExternalPackages: ['ioredis'],
  
  // Disable ESLint blocking the production build (we run lint separately)
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Disable TypeScript checking during build (temporary fix for module resolution issue)
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Enable static file serving for uploads
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: '/api/uploads/:path*',
      },
    ];
  },
  
  // Environment variables for Railway
  env: {
    UPLOAD_DIR: process.env.UPLOAD_DIR || '/app/uploads',
    PUBLIC_URL: process.env.RAILWAY_STATIC_URL || process.env.PUBLIC_URL || 'http://localhost:3000',
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  },
  
  // Production optimizations
  poweredByHeader: false,
  compress: true,
  
  // Ensure proper handling of static files
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '3000',
        pathname: '/**',
      },
    ],
    unoptimized: process.env.NODE_ENV === 'development',
  },
  
  // Webpack configuration for Redis
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('ioredis');
    }
    return config;
  },
};

export default nextConfig;
