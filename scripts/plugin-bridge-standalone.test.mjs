import test from 'node:test';
import { verifyStandaloneBridge } from './plugin-bridge-standalone.mjs';

test('bridge tarball installs outside the monorepo and its bytes are the tree build', { timeout: 600_000 }, verifyStandaloneBridge);
