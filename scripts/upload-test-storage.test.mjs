import { test } from 'node:test';
import assert from 'node:assert/strict';
import { waitForUploadBuckets } from './upload-test-storage.mjs';

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
