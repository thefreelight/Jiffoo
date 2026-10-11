import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyUploadImageIdentity } from './upload-test-image-identity.mjs';

const approved = 'sha256:39aab3c365848e32aca7b76c5b57f86d1cbca02d7b8f24e1fd1feff9fedddae5';
const containerd = JSON.parse(readFileSync(new URL('./fixtures/upload-test-image-containerd.json', import.meta.url), 'utf8'));
// Docker's classic ImageInspect shape has RepoDigests and GraphDriver, but no Descriptor.
// The next CI run records the real runner JSON beside this documented-shape fixture.
const classic = [{
  Id: 'sha256:' + 'a'.repeat(64),
  RepoTags: ['pgsty/silo:RELEASE.2026-09-16T00-00-00Z'],
  RepoDigests: ['pgsty/silo@' + approved],
  Created: '2026-08-04T23:51:54.553415482Z',
  Config: { ExposedPorts: { '9000/tcp': {} }, Entrypoint: ['/usr/bin/docker-entrypoint.sh'], Cmd: ['minio'], WorkingDir: '/' },
  Architecture: 'amd64', Os: 'linux', Size: 216420701,
  GraphDriver: { Name: 'overlay2', Data: {} },
  RootFS: { Type: 'layers', Layers: containerd[0].RootFS.Layers },
}];
const copy = value => structuredClone(value);
const reject = (platform, regular) => assert.throws(() => verifyUploadImageIdentity(platform, regular, approved), error => error.message.includes(approved));

test('real Docker Desktop containerd inspection matches Descriptor even with an index RepoDigest', () => {
  assert.equal(verifyUploadImageIdentity(containerd, undefined, approved), 'Descriptor');
  assert.ok(!containerd[0].RepoDigests.includes('pgsty/silo@' + approved));
});
test('classic inspection after an unsupported platform flag matches the exact platform RepoDigest', () => {
  assert.equal(verifyUploadImageIdentity(undefined, classic, approved), 'RepoDigests');
});
test('successful platform inspection without Descriptor requires a separate regular inspection', () => {
  assert.equal(verifyUploadImageIdentity(classic, classic, approved), 'RepoDigests');
  reject(classic, undefined);
});
test('wrong containerd Descriptor cannot downgrade to matching RepoDigests', () => {
  const wrong = copy(containerd); wrong[0].Descriptor.digest = 'sha256:' + 'b'.repeat(64);
  wrong[0].RepoDigests = classic[0].RepoDigests;
  reject(wrong, classic);
});
test('wrong classic digest is rejected', () => {
  const wrong = copy(classic); wrong[0].RepoDigests = ['pgsty/silo@sha256:' + 'b'.repeat(64)];
  reject(undefined, wrong);
});
for (const [field, wrong] of [['Os', 'windows'], ['Architecture', 'arm64']]) {
  test('containerd rejects wrong ' + field, () => {
    const value = copy(containerd); value[0][field] = wrong; reject(value, classic);
  });
  test('classic rejects wrong ' + field, () => {
    const value = copy(classic); value[0][field] = wrong; reject(undefined, value);
  });
}
test('classic tag-only pull with the index digest cannot authenticate the platform image', () => {
  const value = copy(classic); value[0].RepoDigests = containerd[0].RepoDigests;
  reject(undefined, value);
});
test('RepoDigest must match the repository and digest exactly', () => {
  for (const digest of ['other/minio@' + approved, 'pgsty/silo@' + approved + '-suffix', approved]) {
    const value = copy(classic); value[0].RepoDigests = [digest]; reject(undefined, value);
  }
});
test('missing or malformed inspection fields are rejected', () => {
  for (const value of [undefined, null, {}, [], [null], [containerd[0], containerd[0]]]) reject(value, undefined);
  for (const field of ['Os', 'Architecture']) {
    const value = copy(containerd); delete value[0][field]; reject(value, classic);
    const regular = copy(classic); delete regular[0][field]; reject(undefined, regular);
  }
  for (const Descriptor of [null, {}, [], approved]) {
    const value = copy(containerd); value[0].Descriptor = Descriptor; reject(value, classic);
  }
  for (const RepoDigests of [undefined, null, [], approved, [null, 'pgsty/silo@' + approved]]) {
    const value = copy(classic); value[0].RepoDigests = RepoDigests; reject(undefined, value);
  }
});
