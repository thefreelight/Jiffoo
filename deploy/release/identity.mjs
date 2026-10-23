import { createRequire } from 'node:module';
import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';

const require = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const Ajv = require('ajv');
const schema = JSON.parse(readFileSync(new URL('./release.schema.json', import.meta.url), 'utf8'));
const validate = new Ajv({ strict: true, allErrors: true }).compile(schema);
export const deploymentFiles = ['bin/jiffoo-host', 'deploy/release/release.schema.json', 'deploy/release/backup-host.sh', 'deploy/release/backup.mjs', 'deploy/release/host-lock.sh', 'deploy/release/update-host.sh', 'deploy/release/update.mjs', 'deploy/compose/compose.yml', 'deploy/compose/compose.release.yml',
  'deploy/release/maintenance-proof.mjs', 'deploy/compose/api-lb.conf', 'deploy/compose/edge.conf.template', 'deploy/compose/15-edge-hosts.envsh', 'deploy/compose/silo-init.sh', 'deploy/compose/.env.example'];
export const roles = ['backend', 'admin', 'shop', 'postgres', 'redis', 'silo', 'nginx'];
export const requiredJobs = ['api (1)', 'api (2)', 'api (3)', 'api (4)', 'quality', 'e2e', 'compose', 'release-verify', 'backup', 'update-no-migration', 'update-migration', 'summary'];
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function assertSuccessfulCi(run, jobs, commit) {
  if (run.head_sha !== commit || run.path !== '.github/workflows/ci.yml' || run.status !== 'completed' || run.conclusion !== 'success') throw new Error('Selected commit does not have a completed successful full CI run');
  if (!Array.isArray(jobs) || jobs.length !== requiredJobs.length || requiredJobs.some(name => jobs.filter(job => job.name === name && job.status === 'completed' && job.conclusion === 'success').length !== 1)) throw new Error('Every full CI job must succeed; missing, cancelled and skipped jobs block release');
}

export function assertDeploymentPolicy(paths) {
  if (!Array.isArray(paths) || !paths.length || new Set(paths).size !== paths.length || paths.some(path => typeof path !== 'string' || !/^[A-Za-z0-9_./-]+$/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..'))) throw new Error('Invalid deployment inventory policy');
  return paths;
}

export function sourceDeploymentPolicy(policy, manifest) {
  if (policy?.sourceCommit !== manifest.sourceCommit || policy?.verifierImage !== manifest.verifierImage) throw new Error('Source deployment policy identity mismatch');
  return assertDeploymentPolicy(policy.deploymentFiles);
}

export function assertManifest(manifest, commit, acceptance = false, expectedDeploymentFiles = deploymentFiles) {
  if (!validate(manifest)) throw new Error(`Invalid release manifest schema: ${JSON.stringify(validate.errors)}`);
  if (manifest.sourceCommit !== commit) throw new Error('Release source commit differs from the selected commit');
  if (manifest.mode !== (acceptance ? 'acceptance' : 'ghcr')) throw new Error('Local acceptance manifests cannot be used as production releases');
  if (manifest.verifierImage !== manifest.images.backend.reference) throw new Error('Verifier image must be the backend image');
  if (acceptance ? manifest.ci !== null : !manifest.ci || manifest.ci.sourceCommit !== commit) throw new Error('Release CI identity does not match its source commit');
  for (const [role, image] of Object.entries(manifest.images)) {
    const valid = acceptance ? image.reference === image.digest : image.reference.endsWith('@' + image.digest);
    if (!valid || acceptance && image.platformDigest !== image.digest) throw new Error(`Invalid immutable image reference: ${role}`);
    if (!acceptance && ['backend', 'admin', 'shop'].includes(role) && !image.reference.startsWith(`ghcr.io/thefreelight/jiffoo-core-${role}@`)) throw new Error(`Unexpected release image repository: ${role}`);
    if (!acceptance && !/^[a-z0-9./:-]+@sha256:[a-f0-9]{64}$/.test(image.reference)) throw new Error(`Unsafe image reference: ${role}`);
  }
  const paths = manifest.deployment.map(file => file.path);
  if (JSON.stringify([...paths].sort()) !== JSON.stringify([...assertDeploymentPolicy(expectedDeploymentFiles)].sort())) throw new Error('Release deployment file inventory is incomplete or duplicated');
}

export function assertDeployment(manifest, directory) {
  const root = realpathSync(directory);
  for (const file of manifest.deployment) {
    if (file.path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Unsafe deployment path');
    let current = root;
    for (const part of file.path.split('/')) { current = resolve(current, part); if (lstatSync(current).isSymbolicLink()) throw new Error('Deployment symlinks are not allowed'); }
    if (!realpathSync(current).startsWith(root + sep) || !lstatSync(current).isFile()) throw new Error('Deployment path escaped its release directory');
    const bytes = readFileSync(current);
    if (bytes.length !== file.size || sha256(bytes) !== file.sha256) throw new Error(`Deployment checksum mismatch: ${file.path}`);
  }
}

function repository(reference) {
  return reference.split('@')[0].replace(/:[^/:]+$/, '').replace(/^docker\.io\/(?:library\/)?/, '');
}
export function assertImage(manifest, role, inspection, distribution) {
  const image = manifest.images[role];
  if (!Array.isArray(inspection) || inspection.length !== 1) throw new Error(`Missing image inspection: ${role}`);
  const actual = inspection[0];
  if (actual.Os !== 'linux' || actual.Architecture !== 'amd64') throw new Error(`Image platform mismatch: ${role}`);
  if (manifest.mode === 'acceptance') {
    if (actual.Id !== image.digest) throw new Error(`Local image digest mismatch: ${role}`);
  } else {
    const expected = `${repository(image.reference)}@${image.digest}`;
    if (!actual.RepoDigests?.some(value => `${repository(value)}@${value.split('@')[1]}` === expected)) throw new Error(`Image distribution digest mismatch: ${role}`);
    if (Object.hasOwn(actual, 'Descriptor') && actual.Descriptor?.digest !== image.platformDigest) throw new Error(`Image platform descriptor mismatch: ${role}`);
    const selected = distribution?.manifests?.filter(item => item.platform?.os === 'linux' && item.platform?.architecture === 'amd64');
    if (distribution?.manifests ? selected.length !== 1 || selected[0].digest !== image.platformDigest : image.platformDigest !== image.digest || !distribution?.config) throw new Error(`Image index platform mismatch: ${role}`);
  }
  if (['backend', 'admin', 'shop'].includes(role)) {
    if (actual.Config?.Labels?.['org.opencontainers.image.revision'] !== manifest.sourceCommit) throw new Error(`Image source commit mismatch: ${role}`);
    if (actual.Config?.Labels?.['org.opencontainers.image.version'] !== manifest.version || actual.Config?.Labels?.['io.jiffoo.role'] !== role) throw new Error(`Image version or role mismatch: ${role}`);
  }
}
