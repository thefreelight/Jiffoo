import { mkdirSync, cpSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deploymentFiles, roles, sha256, assertManifest, assertSuccessfulCi } from './identity.mjs';

export function makeRelease({ root, output, inspections, commit, version, mode, ci }) {
  const images = {};
  for (const role of roles) {
    const actual = JSON.parse(readFileSync(resolve(inspections, role + '.json'), 'utf8'))[0];
    if (actual.Os !== 'linux' || actual.Architecture !== 'amd64') throw new Error(`Unsupported release image platform: ${role}`);
    if (mode === 'acceptance') images[role] = { reference: actual.Id, digest: actual.Id, platformDigest: actual.Id };
    else {
      const reference = readFileSync(resolve(inspections, role + '.ref'), 'utf8').trim();
      const digest = reference.split('@')[1];
      const distribution = JSON.parse(readFileSync(resolve(inspections, role + '.manifest.json'), 'utf8'));
      const selected = distribution.manifests?.filter(item => item.platform?.os === 'linux' && item.platform?.architecture === 'amd64');
      if (selected && selected.length !== 1) throw new Error(`Ambiguous release platform: ${role}`);
      images[role] = { reference, digest, platformDigest: selected ? selected[0].digest : digest };
    }
  }
  mkdirSync(resolve(output, 'deploy/compose'), { recursive: true, mode: 0o755 });
  const services = ['api-1', 'api-2', 'worker-1', 'worker-2', 'silo-volume-init', 'db-init'].map(service => `  ${service}:\n    build: !reset null\n    image: ${images.backend.reference}`);
  services.push(...['admin', 'shop'].map(role => `  ${role}:\n    build: !reset null\n    image: ${images[role].reference}`));
  writeFileSync(resolve(output, 'deploy/compose/compose.release.yml'), 'services:\n' + services.join('\n') + '\n');
  for (const file of deploymentFiles.filter(path => path !== 'deploy/compose/compose.release.yml')) {
    const target = resolve(output, file); mkdirSync(dirname(target), { recursive: true, mode: 0o755 });
    cpSync(resolve(root, file), target); chmodSync(target, file === 'bin/jiffoo-host' || file.endsWith('.envsh') ? 0o755 : 0o644);
  }
  const manifest = { schemaVersion: 1, repository: 'thefreelight/Jiffoo', version, sourceCommit: commit, mode, platform: 'linux/amd64',
    verifierImage: images.backend.reference, ci: mode === 'acceptance' ? null : { runId: ci.id, sourceCommit: ci.head_sha, conclusion: ci.conclusion }, images,
    deployment: deploymentFiles.map(path => { const bytes = readFileSync(resolve(output, path)); return { path, sha256: sha256(bytes), size: bytes.length }; }) };
  assertManifest(manifest, commit, mode === 'acceptance');
  writeFileSync(resolve(output, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [output, inspections, commit, version] = process.argv.slice(2);
  const ci = JSON.parse(readFileSync(resolve(inspections, 'ci-run.json'), 'utf8'));
  const jobs = JSON.parse(readFileSync(resolve(inspections, 'ci-jobs.json'), 'utf8'));
  assertSuccessfulCi(ci, jobs, commit);
  makeRelease({ root: '/app', output, inspections, commit, version, mode: 'ghcr', ci });
}
