const { createNextConfig } = require('../../packages/shared/config/next.config.base');
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = createNextConfig({
  appName: 'Frontend',
  port: 3004,
  transpilePackages: ['shared', '@shop-themes/default', '@shop-themes/yevbi'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.apple.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  // Turbopack 配置（Next.js 16+）
  turbopack: {
    resolveAlias: {
      '@shop-themes': path.resolve(__dirname, '../../packages/shop-themes'),
    },
  },
});

module.exports = nextConfig;
