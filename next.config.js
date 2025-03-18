/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["bhr.vectoranet.com", "localhost", "cloudinary.com"],
  },
  webpack: (config, { isServer }) => {
    // Don't bundle Prisma in client-side code
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@prisma/client": "./src/lib/prisma-client-dummy.js",
      };

      // Create a rule to redirect Prisma imports to a dummy file
      config.module.rules.push({
        test: /@prisma\/client/,
        use: "null-loader",
      });
    }

    return config;
  },
};

export default nextConfig;
