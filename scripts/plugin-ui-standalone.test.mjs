import test from 'node:test';
import { verifyStandaloneUi } from './plugin-ui-standalone.mjs';

test('plugin UI tarball installs outside the monorepo and its bytes are the tree build', { timeout: 600_000 }, verifyStandaloneUi);
