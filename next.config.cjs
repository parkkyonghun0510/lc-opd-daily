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
  output: "standalone",
};

module.exports = nextConfig;
