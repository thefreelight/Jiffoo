import test from 'node:test';
import { verifyStandaloneSdk } from './plugin-sdk-standalone.mjs';

test('SDK tarball installs and works outside the monorepo without database or containers', { timeout: 600_000 }, verifyStandaloneSdk);
