import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOwnedUploadStorage, createUploadStorageCleanup, waitForUploadBuckets } from './upload-test-storage.mjs';

test('S3 readiness requires both buckets to be created and queried after real initialization errors', async () => {
  const calls = [];
  let failures = 2;
  const created = new Set();
  const client = { async send(command, options) {
    assert.equal(options.abortSignal.aborted, false);
    const kind = command.constructor.name, bucket = command.input.Bucket;
    calls.push([kind, bucket]);
    if (failures-- > 0) throw Object.assign(new Error('initializing'), { name: 'XMinioServerNotInitialized' });
    if (kind === 'CreateBucketCommand') {
      if (created.has(bucket)) throw Object.assign(new Error('owned'), { name: 'BucketAlreadyOwnedByYou' });
      created.add(bucket);
    } else if (bucket === 'second' && calls.filter(([name]) => name === 'HeadBucketCommand').length === 2) {
      throw Object.assign(new Error('temporarily unavailable'), { $metadata: { httpStatusCode: 503 } });
    }
  } };
  await waitForUploadBuckets(client, ['first', 'second'], 2000);
  assert.deepEqual(calls.slice(-4), [['CreateBucketCommand', 'first'], ['HeadBucketCommand', 'first'], ['CreateBucketCommand', 'second'], ['HeadBucketCommand', 'second']]);
});

test('a hung S3 request cannot exceed the overall deadline even when it ignores cancellation', async () => {
  let signal;
  const started = performance.now();
  await assert.rejects(waitForUploadBuckets({ send(_command, options) { signal = options.abortSignal; return new Promise(() => {}); } }, ['first'], 50), /S3 did not become ready within 50ms/);
  assert.equal(signal.aborted, true);
  assert.ok(performance.now() - started < 1000);
});

test('persistent initialization errors report the last S3 code and stop retrying after the deadline', async () => {
  let calls = 0;
  await assert.rejects(waitForUploadBuckets({ async send() {
    calls++;
    throw Object.assign(new Error('initializing'), { name: 'XMinioServerNotInitialized' });
  } }, ['first'], 50), /last error: XMinioServerNotInitialized/);
  assert.equal(calls, 1);
});

test('invalid credentials fail immediately without logging credential contents', async () => {
  let calls = 0;
  await assert.rejects(waitForUploadBuckets({ async send() {
    calls++;
    throw Object.assign(new Error('PRIVATE_CREDENTIAL_VALUE'), { name: 'AccessDenied' });
  } }, ['first'], 1000), error => {
    assert.equal(error.message, 'Upload test storage S3 provisioning failed: AccessDenied');
    assert.ok(!error.message.includes('PRIVATE_CREDENTIAL_VALUE')); return true;
  });
  assert.equal(calls, 1);
});

const containerId = 'a'.repeat(64);
const volumeName = 'jiffoo-upload-57eca411-0247-400b-9a78-a410633c1006-data';
const success = { status: 0, error: undefined, signal: null, stdout: '', stderr: '' };
const containerMissing = { ...success, status: 1, stderr: `Error response from daemon: No such container: ${containerId}\n` };
const volumeMissing = { ...success, status: 1, stderr: `Error response from daemon: get ${volumeName}: no such volume\n` };

function startupFixture(steps) {
  const name = volumeName.slice(0, -5);
  const calls = [];
  let owner;
  const start = () => createOwnedUploadStorage({ name, accessKeyId: 'test-user', secretAccessKey: 'test-secret' }, (command, args, options) => {
    assert.equal(command, 'docker');
    assert.deepEqual(options, { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
    calls.push(args);
    if (args[0] === 'volume' && args[1] === 'create') {
      owner = args[args.indexOf('--label') + 1].split('=')[1];
      assert.match(owner, /^[a-f0-9-]{36}$/);
      assert.equal(args.at(-1), volumeName);
    }
    if (args[0] === 'volume' && args[1] === 'inspect' && steps[0]?.[0] !== 'volume-inspect') {
      assert.deepEqual(args, ['volume', 'inspect', volumeName]);
      return { ...success, stdout: JSON.stringify([{ Name: volumeName, Labels: { 'jiffoo.upload-test-owner': owner } }]) };
    }
    const step = steps.shift();
    assert.ok(step, 'unexpected Docker command');
    if (step[0] === 'volume-inspect') assert.deepEqual(args, ['volume', 'inspect', volumeName]);
    else assert.equal(args[0], step[0]);
    if (args[0] === 'create') {
      assert.equal(args[args.indexOf('--name') + 1], name);
      assert.equal(args[args.indexOf('--label') + 1], `jiffoo.upload-test-owner=${owner}`);
    }
    return typeof step[1] === 'function' ? step[1]({ name, owner, args }) : step[1];
  });
  return { start, calls, steps };
}

test('a lost volume create response recovers the exact owned volume and removes it without creating a container', () => {
  const timeout = Object.assign(new Error('volume create timeout'), { code: 'ETIMEDOUT' });
  const fixture = startupFixture([['volume', { ...success, status: null, signal: 'SIGTERM', error: timeout }],
    ['volume-inspect', ({ owner }) => ({ ...success, stdout: JSON.stringify([
      { Name: volumeName, Labels: { 'jiffoo.upload-test-owner': owner } },
    ]) })], ['volume', success]]);
  assert.throws(fixture.start, error => {
    assert.equal(error.cause, timeout);
    assert.equal(error.ownedResources.volumeCreated, false);
    assert.equal(error.uncertainResources.volume, undefined);
    return true;
  });
  assert.deepEqual(fixture.calls.slice(1), [['volume', 'inspect', volumeName], ['volume', 'rm', volumeName]]);
  assert.equal(fixture.steps.length, 0);
});

test('both successful and uncertain volume creation reject foreign identity without deleting the volume', () => {
  for (const creation of [success, { ...success, status: 1, stderr: 'volume create failed' }]) {
    for (const mismatch of ['name', 'owner', 'multiple']) {
      const fixture = startupFixture([['volume', creation], ['volume-inspect', ({ owner }) => {
        const volume = { Name: mismatch === 'name' ? 'foreign' : volumeName,
          Labels: { 'jiffoo.upload-test-owner': mismatch === 'owner' ? 'foreign' : owner } };
        return { ...success, stdout: JSON.stringify(mismatch === 'multiple' ? [volume, volume] : [volume]) };
      }]]);
      assert.throws(fixture.start, error => {
        assert.match(error.message, /ownership could not be verified|startup or cleanup failed/);
        assert.equal(error.ownedResources.volumeCreated, false);
        assert.equal(error.uncertainResources.volume, volumeName);
        assert.equal(error.uncertainResources.ownerLabel, 'jiffoo.upload-test-owner');
        assert.match(error.uncertainResources.owner, /^[a-f0-9-]{36}$/);
        return true;
      });
      assert.equal(fixture.calls.length, 2);
      assert.equal(fixture.steps.length, 0);
    }
  }
});

test('volume inspect errors retain uncertain identity evidence and never authorize volume deletion', () => {
  for (const creation of [success, { ...success, status: null, error: new Error('create timeout') }]) {
    const fixture = startupFixture([['volume', creation],
      ['volume-inspect', { ...success, status: 1, stderr: 'volume inspect unavailable' }]]);
    assert.throws(fixture.start, error => {
      const inspectError = error instanceof AggregateError ? error.errors[1] : error;
      assert.equal(inspectError.stderr, 'volume inspect unavailable');
      assert.equal(error.uncertainResources.volume, volumeName);
      assert.equal(error.ownedResources.volumeCreated, false);
      return true;
    });
    assert.equal(fixture.calls.length, 2);
    assert.equal(fixture.steps.length, 0);
  }
});

test('the production construction path records the container before starting and returns idempotent cleanup', () => {
  const fixture = startupFixture([['volume', success], ['create', { ...success, stdout: containerId }],
    ['start', success], ['stop', success], ['rm', success], ['volume', success]]);
  const storage = fixture.start();
  assert.equal(storage.container, containerId);
  storage.stop();
  storage.stop();
  assert.deepEqual(fixture.calls.slice(3), [['start', containerId], ['stop', '--time', '10', containerId],
    ['rm', containerId], ['volume', 'rm', volumeName]]);
  assert.equal(fixture.steps.length, 0);
});

test('start failure and timeout clean the created container and volume through the construction path', () => {
  for (const failure of [
    { ...success, status: 1, stderr: 'start failed' },
    { ...success, status: null, signal: 'SIGTERM', error: Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }) },
  ]) {
    const fixture = startupFixture([['volume', success], ['create', { ...success, stdout: containerId }],
      ['start', failure], ['stop', success], ['rm', success], ['volume', success]]);
    assert.throws(fixture.start, error => error.stderr === failure.stderr && error.cause === failure.error);
    assert.deepEqual(fixture.calls.slice(4), [['stop', '--time', '10', containerId], ['rm', containerId], ['volume', 'rm', volumeName]]);
    assert.equal(fixture.steps.length, 0);
  }
});

test('construction preserves startup and cleanup failures and identifies remaining owned resources', () => {
  const fixture = startupFixture([['volume', success], ['create', { ...success, stdout: containerId }],
    ['start', { ...success, status: 1, stderr: 'start failed' }],
    ['stop', { ...success, status: 1, stderr: 'stop failed' }],
    ['volume', { ...success, status: 1, stderr: 'volume busy' }]]);
  assert.throws(fixture.start, error => {
    assert.ok(error instanceof AggregateError);
    assert.equal(error.errors[0].stderr, 'start failed');
    assert.deepEqual(error.errors[1].errors.map(item => item.stderr), ['stop failed', 'volume busy']);
    assert.deepEqual(error.ownedResources, { volume: volumeName, volumeCreated: true, container: containerId });
    return true;
  });
  assert.equal(fixture.steps.length, 0);
});

test('a lost create response recovers only the exact UUID name and unique owner label before cleanup by ID', () => {
  const fixture = startupFixture([['volume', success],
    ['create', { ...success, status: null, signal: 'SIGTERM', error: new Error('create timeout') }],
    ['container', ({ name, owner, args }) => {
      assert.deepEqual(args, ['container', 'inspect', name]);
      return { ...success, stdout: JSON.stringify([{ Id: containerId, Name: `/${name}`, Config: { Labels: { 'jiffoo.upload-test-owner': owner } } }]) };
    }], ['stop', success], ['rm', success], ['volume', success]]);
  assert.throws(fixture.start, /create timeout/);
  assert.deepEqual(fixture.calls.slice(4), [['stop', '--time', '10', containerId], ['rm', containerId], ['volume', 'rm', volumeName]]);
  assert.equal(fixture.steps.length, 0);
});

test('uncertain create never deletes a container with a foreign name, owner label or invalid ID', () => {
  for (const mismatch of ['name', 'owner', 'id', 'multiple']) {
    const fixture = startupFixture([['volume', success], ['create', { ...success, status: 1, stderr: 'create failed' }],
      ['container', ({ name, owner }) => {
        const container = { Id: mismatch === 'id' ? 'short-id' : containerId,
          Name: mismatch === 'name' ? '/foreign' : `/${name}`,
          Config: { Labels: { 'jiffoo.upload-test-owner': mismatch === 'owner' ? 'foreign' : owner } } };
        return { ...success, stdout: JSON.stringify(mismatch === 'multiple' ? [container, container] : [container]) };
      }], ['volume', success]]);
    assert.throws(fixture.start, error => error instanceof AggregateError && /ownership could not be verified/.test(error.errors[1].message));
    assert.deepEqual(fixture.calls.at(-1), ['volume', 'rm', volumeName]);
    assert.equal(fixture.steps.length, 0);
  }
});

test('uncertain create retains inspect errors while still attempting owned volume cleanup', () => {
  const fixture = startupFixture([['volume', success], ['create', { ...success, status: 1, stderr: 'create failed' }],
    ['container', { ...success, status: 1, stderr: 'daemon unavailable' }], ['volume', success]]);
  assert.throws(fixture.start, error => error instanceof AggregateError
    && error.errors[0].stderr === 'create failed' && error.errors[1].stderr === 'daemon unavailable');
  assert.equal(fixture.steps.length, 0);
});

function cleanupFixture(results, overrides = {}) {
  const calls = [];
  const resources = { container: containerId, volume: volumeName, volumeCreated: true, ...overrides };
  const stop = createUploadStorageCleanup(resources, (command, args, options) => {
    assert.equal(command, 'docker');
    assert.deepEqual(options, { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
    calls.push(args);
    assert.ok(results.length > 0, 'unexpected Docker command');
    return results.shift();
  });
  return { stop, calls, resources };
}

test('owned storage cleanup stops then removes the full container ID and volume exactly once', () => {
  const { stop, calls } = cleanupFixture([success, success, success]);
  stop();
  stop();
  assert.deepEqual(calls, [['stop', '--time', '10', containerId], ['rm', containerId], ['volume', 'rm', volumeName]]);
});

test('an already deleted container still releases its owned volume', () => {
  const { stop, calls } = cleanupFixture([containerMissing, success]);
  stop();
  stop();
  assert.deepEqual(calls, [['stop', '--time', '10', containerId], ['volume', 'rm', volumeName]]);
});

test('container deletion between stop and rm and volume deletion races are idempotent', () => {
  const { stop, calls } = cleanupFixture([success, containerMissing, volumeMissing]);
  stop();
  stop();
  assert.deepEqual(calls, [['stop', '--time', '10', containerId], ['rm', containerId], ['volume', 'rm', volumeName]]);
});

test('startup cleanup only removes resources whose creation succeeded', () => {
  const uncreated = cleanupFixture([], { container: undefined, volumeCreated: false });
  uncreated.stop();
  assert.deepEqual(uncreated.calls, []);
  const volumeOnly = cleanupFixture([success], { container: undefined });
  volumeOnly.stop();
  assert.deepEqual(volumeOnly.calls, [['volume', 'rm', volumeName]]);
});

test('real Docker failures propagate with all spawn result details while owned volume cleanup is attempted', () => {
  const timeout = Object.assign(new Error('spawnSync docker ETIMEDOUT'), { code: 'ETIMEDOUT' });
  for (const failure of [
    { ...success, status: 1, stderr: 'Cannot connect to the Docker daemon' },
    { ...success, status: 1, stderr: 'permission denied' },
    { ...success, status: 1, stderr: 'Error response from daemon: cannot stop container: operation failed' },
    { ...success, status: null, error: timeout, signal: 'SIGTERM', stdout: 'partial output' },
    { ...success, status: null, error: Object.assign(new Error('not found'), { code: 'ENOENT' }) },
  ]) {
    const { stop, calls } = cleanupFixture([failure, success]);
    assert.throws(stop, error => {
      for (const key of ['status', 'error', 'signal', 'stdout', 'stderr']) assert.equal(error[key], failure[key]);
      assert.equal(error.cause, failure.error);
      return true;
    });
    assert.deepEqual(calls, [['stop', '--time', '10', containerId], ['volume', 'rm', volumeName]]);
  }
});

test('missing messages for other resources or mixed diagnostics never excuse failures', () => {
  for (const failure of [
    { ...containerMissing, stderr: `Error response from daemon: No such container: ${'b'.repeat(64)}` },
    { ...containerMissing, stderr: `${containerMissing.stderr}permission denied` },
    { ...containerMissing, stdout: 'unexpected diagnostic' },
    { ...containerMissing, error: new Error('timeout') },
    { ...containerMissing, signal: 'SIGTERM' },
    { ...containerMissing, status: 125 },
  ]) {
    const { stop } = cleanupFixture([failure, success]);
    assert.throws(stop, error => error.stderr === failure.stderr && error.status === failure.status);
  }
  const { stop } = cleanupFixture([success, success, { ...volumeMissing, stderr: 'Error response from daemon: get other-volume: no such volume' }]);
  assert.throws(stop, /other-volume/);
});

test('container and volume cleanup failures are both retained and remain retryable', () => {
  const stopFailure = { ...success, status: 1, stderr: 'stop failed' };
  const volumeFailure = { ...success, status: 1, stderr: 'volume is in use' };
  const { stop, calls } = cleanupFixture([stopFailure, volumeFailure, success, success, success]);
  assert.throws(stop, error => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors.map(failure => failure.stderr), ['stop failed', 'volume is in use']);
    return true;
  });
  stop();
  stop();
  assert.equal(calls.length, 5);
});
