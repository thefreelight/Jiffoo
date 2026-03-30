/** @type {import('next').NextConfig} */
const nextConfig = {
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
    ],
  },

  /**
   * API Rewrites for local development
   *
   * In production (platform integration), /api/* requests are handled by the platform
   * and proxied to Core API automatically.
   *
   * In local development, we need to explicitly proxy /api/* to the Core API server.
   * Set CORE_API_URL environment variable to point to your Core API instance.
   *
   * Example: CORE_API_URL=http://localhost:3001
   */
  async rewrites() {
    const coreApiUrl = process.env.CORE_API_URL || 'http://localhost:3001';

    return [
      {
        source: '/api/:path*',
        destination: `${coreApiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
