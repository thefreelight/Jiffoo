const { createNextConfig } = require('../../packages/shared/config/next.config.base');

/** @type {import('next').NextConfig} */
const nextConfig = createNextConfig({
  appName: 'Admin',
  port: 3002,
  images: {
    // Cloudflare Pages: disable _next/image optimization (limited on Workers)
    unoptimized: process.env.CF_PAGES === '1',
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
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
      },
    ],
  },
});

module.exports = nextConfig;
