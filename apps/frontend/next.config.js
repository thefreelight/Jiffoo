/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable experimental features
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
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
        protocol: 'https',
        hostname: 'www.apple.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3001',
      },
    ],
  },
  // API proxy to backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
  // Enable standalone output for Docker
  output: 'standalone',
  // Optimize bundle
  swcMinify: true,
  // Enable React strict mode
  reactStrictMode: true,
  // Transpile shared package
  transpilePackages: ['shared'],
};

module.exports = nextConfig;
