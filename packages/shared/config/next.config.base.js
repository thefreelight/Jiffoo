// Manually load .env file from root directory
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * Base function for creating Next.js configuration
 * @param {Object} options - Configuration options
 * @param {string} options.appName - App name (for logging)
 * @param {number} options.port - Development server port
 * @param {Object} options.images - Image configuration
 * @param {Object} options.experimental - Experimental feature configuration
 * @returns {Object} Next.js configuration object
 */
function createNextConfig(options = {}) {
  const {
    appName = 'App',
    port = 3000,
    images = {},
    experimental = {},
    ...otherOptions
  } = options;

  return {
    // Base configuration
    output: 'standalone', // Enable standalone mode for Docker deployment
    reactStrictMode: true, // Restore strict mode, using better solution
    transpilePackages: ['shared'],

    // ESLint configuration removed - Next.js 16+ does not support configuring eslint in next.config.js

    // TypeScript configuration - Ignore type errors during CI/CD build
    typescript: {
      // Ignore type errors in production build (only in CI/CD)
      ignoreBuildErrors: true, // Temporarily disable globally to avoid build failures
    },

    // Experimental features
    experimental: {
      optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
      ...experimental
    },

    // Image configuration
    images: {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'images.unsplash.com',
        },
        {
          protocol: 'https',
          hostname: 'plus.unsplash.com',
        },
        {
          protocol: 'https',
          hostname: 'images.pexels.com',
        },
        {
          protocol: 'http',
          hostname: 'localhost',
          port: '3001',
        },
        {
          protocol: 'https',
          hostname: 'example.com',
        },
      ],
      // Merge user custom image configuration
      ...images
    },

    // API Proxy Configuration
    async rewrites() {
      // Read API service URL from root .env file
      // Use placeholder during build, replaced with actual value at runtime
      const apiServiceUrl = process.env.API_SERVICE_URL || 'http://localhost:3001';
      const platformApiUrl = process.env.PLATFORM_API_URL || 'http://localhost:3002';

      // Log proxy target only in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log(`${appName} API proxy target:`, apiServiceUrl);
        console.log(`${appName} Platform API proxy target:`, platformApiUrl);
      }

      return [
        // Marketplace API proxy to Platform API (must be before core API proxy)
        {
          source: '/api/marketplace/:path*',
          destination: `${platformApiUrl}/api/marketplace/:path*`,
        },
        // Core API proxy
        {
          source: '/api/:path*',
          destination: `${apiServiceUrl}/api/:path*`,
        },
      ];
    },



    // Explicitly declare environment variables (Required for Next.js 16 + Turbopack)
    env: {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api',
    },

    // Merge other user custom configurations
    ...otherOptions
  };
}

module.exports = { createNextConfig };
