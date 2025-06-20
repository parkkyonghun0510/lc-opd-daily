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
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;"
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
