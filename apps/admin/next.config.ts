const path = require('path');
const { createNextConfig } = require('../../packages/shared/config/next.config.base');
import type { NextConfig } from "next";

const nextConfig: NextConfig = createNextConfig({
  appName: 'Admin',
  port: 3002,
  outputFileTracingRoot: path.join(__dirname, '../../'),
});

export default nextConfig;
