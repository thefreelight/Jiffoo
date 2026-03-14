// Manually load .env file from root directory
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
try {
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
} catch {
  // dotenv is optional in this repo setup; Next can run with env already provided by the shell.
}

/**
 * Generate stable build ID based on git commit or package.json version
 */
function generateStableBuildId() {
  try {
    // Try to get git commit hash
    const { execSync } = require('child_process');
    const gitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    return gitHash;
  } catch (error) {
    // Fallback: use package.json version + timestamp (daily)
    const packageJson = require(path.resolve(__dirname, '../../../package.json'));
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const content = `${packageJson.version}-${date}`;
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
  }
}

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

    // Generate stable build ID for better Turbo cache hit rate
    generateBuildId: async () => {
      return generateStableBuildId();
    },

    // ESLint configuration removed - Next.js 16+ does not support configuring eslint in next.config.js

    // TypeScript configuration - Type checking fixed, restore strict mode
    typescript: {
      // Type errors fixed, enable type checking
      ignoreBuildErrors: false,
    },

    // Experimental features
    experimental: {
      optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
      // Allow large request bodies to be proxied through Next (proxy.ts) without being truncated to 10MB
      // (Used by Admin/Shop dev server when posting ZIPs to /api/extensions/* which rewrites to Core API)
      proxyClientMaxBodySize: 500 * 1024 * 1024, // 500MB
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

      // Log proxy target only in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log(`${appName} API proxy target:`, apiServiceUrl);
      }

      return [

        // Core API proxy
        {
          source: '/api/:path*',
          destination: `${apiServiceUrl}/api/:path*`,
        },
        // Extension static files proxy
        {
          source: '/extensions/:path*',
          destination: `${apiServiceUrl}/extensions/:path*`,
        },
        // Uploads static files proxy
        {
          source: '/uploads/:path*',
          destination: `${apiServiceUrl}/uploads/:path*`,
        },
        // Theme App Gateway proxy
        // Routes requests to running Theme App instances through the API server
        // This solves the network topology problem where Theme Apps run on 127.0.0.1
        // which is only reachable from the API server, not from frontend containers
        {
          source: '/theme-app/:path*',
          destination: `${apiServiceUrl}/theme-app/:path*`,
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
