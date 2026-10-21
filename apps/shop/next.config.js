const { createNextConfig } = require('../../packages/shared/config/next.config.base');
const { localPatterns } = require('./lib/image-policy');

const baseConfig = createNextConfig({
  appName: 'Shop',
  port: 3003,
  turbopack: { root: require('path').resolve(__dirname, '../..') },
  images: { remotePatterns: [], localPatterns, maximumRedirects: 0 },
  experimental: { globalNotFound: true },
});

module.exports = {
  ...baseConfig,
  async rewrites() {
    const rules = await baseConfig.rewrites();
    return {
      afterFiles: rules.filter(rule => rule.source !== '/api/v1/:path*'),
      // Let the stateless dynamic asset handler run before the existing API proxy.
      fallback: rules.filter(rule => rule.source === '/api/v1/:path*'),
    };
  },
  output: undefined,
};
