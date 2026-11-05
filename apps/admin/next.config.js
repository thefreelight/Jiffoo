const { createNextConfig } = require('../../packages/shared/config/next.config.base');

/** @type {import('next').NextConfig} */
const nextConfig = createNextConfig({
  appName: 'Admin',
  port: 3002,
  apiRouteHandler: true,
  // Production bundles support the plugin shell CSP without development eval.
  ...(['build:local', 'start:local'].includes(process.env.npm_lifecycle_event)
    ? { distDir: '.next-local-runtime', output: undefined }
    : {}),
  turbopack: {
    root: require('path').resolve(__dirname, '../..'),
  },
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
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
      },
    ],
  },
});

module.exports = nextConfig;
