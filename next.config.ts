import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Railway-specific configuration
  serverExternalPackages: ['ioredis'],
  
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
  },
  
  // Production optimizations
  poweredByHeader: false,
  compress: true,
  
  // Ensure proper handling of static files
  images: {
    domains: ['localhost', '127.0.0.1'],
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
