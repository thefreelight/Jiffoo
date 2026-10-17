const { createNextConfig } = require('../../packages/shared/config/next.config.base');
const { localPatterns } = require('./lib/image-policy');

module.exports = {
  ...createNextConfig({
  appName: 'Shop',
  port: 3003,
  turbopack: { root: require('path').resolve(__dirname, '../..') },
  images: { remotePatterns: [], localPatterns, maximumRedirects: 0 },
  experimental: { globalNotFound: true },
  }),
  output: undefined,
};
