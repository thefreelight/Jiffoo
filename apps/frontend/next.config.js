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
      {
        protocol: 'https',
        hostname: 'example.com',
      },
    ],
  },
  // API proxy to backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:3001/api/:path*',
      },
    ];
  },
  // Enable standalone output for Docker (disabled due to Windows symlink issues)
  // output: 'standalone',
  // swcMinify is now enabled by default in Next.js 15
  // Enable React strict mode
  reactStrictMode: true,
  // Transpile shared package
  transpilePackages: ['shared'],
};

module.exports = nextConfig;
