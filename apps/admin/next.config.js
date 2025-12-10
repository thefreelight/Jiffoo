const { createNextConfig } = require('../../packages/shared/config/next.config.base');

/** @type {import('next').NextConfig} */
const nextConfig = createNextConfig({
  appName: 'Admin',
  port: 3003,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'localhost',
      },
    ],
  },
});

module.exports = nextConfig;
