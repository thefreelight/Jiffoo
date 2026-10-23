import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { assertManifest, assertDeployment, assertImage, assertSuccessfulCi, sourceDeploymentPolicy, deploymentFiles, roles, requiredJobs, sha256 } from '../deploy/release/identity.mjs';

const commit = 'a'.repeat(40), digest = 'sha256:' + 'b'.repeat(64);
function fixture() {
  return { schemaVersion: 1, repository: 'thefreelight/Jiffoo', version: '1.0.154', sourceCommit: commit, mode: 'acceptance', platform: 'linux/amd64', verifierImage: digest, ci: null,
    images: Object.fromEntries(roles.map(role => [role, { reference: digest, digest, platformDigest: digest }])),
    deployment: deploymentFiles.map(path => ({ path, size: 1, sha256: sha256(Buffer.from('x')) })) };
}
test('release schema rejects unknown fields, mismatched source and production use of local fixtures', () => {
  assertManifest(fixture(), commit, true);
  for (const mutate of [value => { value.extra = true; }, value => { value.sourceCommit = 'c'.repeat(40); }, value => { value.images.backend.reference = 'mutable:latest'; }, value => { value.deployment.pop(); }]) {
    const value = fixture(); mutate(value); assert.throws(() => assertManifest(value, commit, true));
  }
  assert.throws(() => assertManifest(fixture(), commit, false), /Local acceptance/);
});
test('source inventory is bound to its verified image and stays exact across versions', () => {
  const manifest = fixture();
  const paths = [...deploymentFiles, 'deploy/release/source-only.json'];
  manifest.deployment.push({ path: paths.at(-1), size: 1, sha256: sha256(Buffer.from('x')) });
  const policy = { sourceCommit: commit, verifierImage: digest, deploymentFiles: paths };
  assertManifest(manifest, commit, true, sourceDeploymentPolicy(policy, manifest));
  assert.throws(() => assertManifest(manifest, commit, true), /inventory/);
  for (const changed of [{ ...policy, sourceCommit: 'c'.repeat(40) }, { ...policy, verifierImage: 'sha256:' + 'd'.repeat(64) }, ...[[], [...paths, paths[0]], ['../escape'], ['/absolute'], ['a\\b']].map(deploymentFiles => ({ ...policy, deploymentFiles }))]) assert.throws(() => sourceDeploymentPolicy(changed, manifest));
  manifest.deployment.pop();
  assert.throws(() => assertManifest(manifest, commit, true, paths), /inventory/);
  manifest.deployment.push(manifest.deployment[0]);
  assert.throws(() => assertManifest(manifest, commit, true, paths), /inventory/);
});

test('deployment checks catch modified bytes without trusting supplied checksums or unsafe paths', () => {
  const directory = mkdtempSync(join(tmpdir(), 'release-integrity-'));
  try {
    const manifest = fixture();
    for (const file of manifest.deployment) { const path = join(directory, file.path); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, 'x'); }
    assertDeployment(manifest, directory);
    writeFileSync(join(directory, deploymentFiles[0]), 'edited');
    assert.throws(() => assertDeployment(manifest, directory), /checksum mismatch/);
    manifest.deployment[0].path = '../escape'; assert.throws(() => assertDeployment(manifest, directory), /Unsafe deployment/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('actual image platform, digest, source version and role must all match', () => {
  const manifest = fixture();
  const image = { Id: digest, Os: 'linux', Architecture: 'amd64', Config: { Labels: { 'org.opencontainers.image.revision': commit, 'org.opencontainers.image.version': manifest.version, 'io.jiffoo.role': 'backend' } } };
  assertImage(manifest, 'backend', [image]);
  for (const mutate of [value => { value.Architecture = 'arm64'; }, value => { value.Id = 'sha256:' + 'd'.repeat(64); }, value => { value.Config.Labels['org.opencontainers.image.revision'] = 'e'.repeat(40); }]) {
    const value = structuredClone(image); mutate(value); assert.throws(() => assertImage(manifest, 'backend', [value]));
  }
});
test('registry index and platform identities cannot be replaced by a tag or unrelated RepoDigest', () => {
  const manifest = fixture(); manifest.mode = 'ghcr'; manifest.ci = { runId: 1, sourceCommit: commit, conclusion: 'success' };
  for (const role of roles) manifest.images[role].reference = `ghcr.io/thefreelight/jiffoo-core-${role}@${digest}`;
  manifest.verifierImage = manifest.images.backend.reference;
  const platformDigest = 'sha256:' + 'c'.repeat(64); manifest.images.backend.platformDigest = platformDigest;
  const image = { Os: 'linux', Architecture: 'amd64', RepoDigests: [manifest.verifierImage], Descriptor: { digest: platformDigest }, Config: { Labels: { 'org.opencontainers.image.revision': commit, 'org.opencontainers.image.version': manifest.version, 'io.jiffoo.role': 'backend' } } };
  const index = { manifests: [{ platform: { os: 'linux', architecture: 'amd64' }, digest: platformDigest }] };
  assertImage(manifest, 'backend', [image], index);
  const wrong = structuredClone(image); wrong.Descriptor.digest = digest;
  assert.throws(() => assertImage(manifest, 'backend', [wrong], index), /descriptor mismatch/);
  wrong.RepoDigests = ['other/repository@' + digest]; assert.throws(() => assertImage(manifest, 'backend', [wrong], index), /distribution digest mismatch/);
});
test('publishing refuses wrong commits, failed jobs, cancelled jobs and incomplete full gates', () => {
  const run = { head_sha: commit, path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success' };
  const jobs = requiredJobs.map(name => ({ name, status: 'completed', conclusion: 'success' }));
  assertSuccessfulCi(run, jobs, commit);
  assert.throws(() => assertSuccessfulCi({ ...run, head_sha: 'd'.repeat(40) }, jobs, commit));
  for (const conclusion of ['failure', 'skipped', 'cancelled']) assert.throws(() => assertSuccessfulCi(run, [{ ...jobs[0], conclusion }, ...jobs.slice(1)], commit));
  assert.throws(() => assertSuccessfulCi(run, jobs.slice(1), commit));
  const workflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  assert.match(workflow, /workflow_dispatch:/); assert.match(workflow, /packages: write/); assert.match(workflow, /persist-credentials: false/);
  assert.ok(!/uses: (?:docker\/|sigstore\/)/.test(workflow));
});
