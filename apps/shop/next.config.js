const { createNextConfig } = require('../../packages/shared/config/next.config.base');
const path = require('path');
const withPWA = require('@ducanh2912/next-pwa').default;

/** @type {import('next').NextConfig} */
const nextConfig = createNextConfig({
  appName: 'Frontend',
  port: 3003,
  // The shop runtime embeds the default theme plus the official full-renderer
  // themes that can be activated through the marketplace/package flow.
  transpilePackages: [
    'shared',
    '@shop-themes/default',
    '@shop-themes/bokmoo',
    '@shop-themes/esim-mall',
    '@shop-themes/imagic-studio',
    '@shop-themes/modelsfind',
    '@shop-themes/yevbi',
    '@jiffoo/core-api-sdk',
    '@jiffoo/theme-api-sdk',
  ],
  images: {
    // Image optimization formats - prefer modern formats with fallback
    formats: ['image/avif', 'image/webp'],

    // Device sizes for responsive images (matches common breakpoints)
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],

    // Image sizes for srcset generation
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    // Minimize layout shift with strict sizing
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",

    // Custom CDN loader if CDN is configured
    ...(process.env.NEXT_PUBLIC_CDN_URL && {
      loader: 'custom',
      loaderFile: './lib/image-loader.js',
    }),

    // Remote patterns for external images
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.apple.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      // Add CDN hostname if configured
      ...(process.env.NEXT_PUBLIC_CDN_URL
        ? [
          {
            protocol: 'https',
            hostname: new URL(process.env.NEXT_PUBLIC_CDN_URL).hostname,
          },
        ]
        : []),
    ],

    // Disable static image imports optimization in favor of CDN
    disableStaticImages: false,

    // Minimize the size of images to improve performance
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
  },
  // Turbopack configuration (Next.js 16+)
  turbopack: {
    resolveAlias: {
      '@shop-themes': path.resolve(__dirname, '../../packages/shop-themes'),
    },
  },
  // Webpack configuration (Default for build)
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@shop-themes': path.resolve(__dirname, '../../packages/shop-themes'),
    };
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: http:; frame-src 'self' https://js.stripe.com https://hooks.stripe.com; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
});

// Wrap with PWA configuration
module.exports = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  // Custom worker configuration for push notifications
  customWorkerSrc: 'worker',
  customWorkerDest: 'public',
  runtimeCaching: [
    // External fonts - rarely change, long cache
    {
      urlPattern: /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-webfonts',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'google-fonts-stylesheets',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    // Local font assets - rarely change
    {
      urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-font-assets',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    // Image assets - optimize for e-commerce product images
    {
      urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-image-assets',
        expiration: {
          maxEntries: 50, // Reduced from 64 to manage cache size
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days - balance between freshness and performance
        },
      },
    },
    // Next.js optimized images - critical for shop performance
    {
      urlPattern: /\/_next\/image\?url=.+$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-image',
        expiration: {
          maxEntries: 50, // Reduced from 64 to manage cache size
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        },
      },
    },
    // Audio assets - limit cache size for large files
    {
      urlPattern: /\.(?:mp3|wav|ogg)$/i,
      handler: 'CacheFirst',
      options: {
        rangeRequests: true,
        cacheName: 'static-audio-assets',
        expiration: {
          maxEntries: 10, // Reduced from 32 - audio files can be large
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    // Video assets - strict limits for large files
    {
      urlPattern: /\.(?:mp4)$/i,
      handler: 'CacheFirst',
      options: {
        rangeRequests: true,
        cacheName: 'static-video-assets',
        expiration: {
          maxEntries: 5, // Reduced from 32 - videos are very large
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    // JavaScript bundles - version controlled by Next.js
    {
      urlPattern: /\.(?:js)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-js-assets',
        expiration: {
          maxEntries: 40, // Increased slightly for better coverage
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        },
      },
    },
    // CSS stylesheets - version controlled by Next.js
    {
      urlPattern: /\.(?:css|less)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-style-assets',
        expiration: {
          maxEntries: 20, // Reduced from 32 - fewer CSS files typically
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        },
      },
    },
    // Next.js data - SSG/ISR page data
    {
      urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'next-data',
        expiration: {
          maxEntries: 20, // Reduced from 32 for better cache efficiency
          maxAgeSeconds: 24 * 60 * 60, // 24 hours - prioritize freshness
        },
        networkTimeoutSeconds: 10, // Fallback to cache if network is slow
      },
    },
    // API data responses - prioritize freshness
    {
      urlPattern: /\.(?:json|xml|csv)$/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'static-data-assets',
        expiration: {
          maxEntries: 20, // Reduced from 32
          maxAgeSeconds: 60 * 60, // 1 hour - shorter for data freshness
        },
        networkTimeoutSeconds: 10,
      },
    },
    // Application pages - balance between freshness and offline support
    {
      urlPattern: ({ url }) => {
        const isSameOrigin = self.origin === url.origin;
        if (!isSameOrigin) return false;
        const pathname = url.pathname;
        // Exclude /api routes from being cached by default
        if (pathname.startsWith('/api/')) return false;
        return true;
      },
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages',
        expiration: {
          maxEntries: 20, // Reduced from 32 for better cache management
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
        networkTimeoutSeconds: 10, // Fallback to cache if network is slow
      },
    },
  ],
})(nextConfig);
