const { createNextConfig } = require('../../packages/shared/config/next.config.base');

module.exports = {
  ...createNextConfig({
  appName: 'Shop',
  port: 3003,
  turbopack: { root: require('path').resolve(__dirname, '../..') },
  images: { unoptimized: true },
  }),
  output: undefined,
};
