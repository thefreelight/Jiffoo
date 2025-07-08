/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['images.unsplash.com', 'localhost'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:3001/api/:path*',
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
}

module.exports = nextConfig
