import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertManifest, assertDeployment, assertImage, roles } from './identity.mjs';

const [command, directory, commit, inspections, mode] = process.argv.slice(2);
try {
  const manifest = JSON.parse(readFileSync(resolve(directory, 'release.json'), 'utf8'));
  assertManifest(manifest, commit, mode === 'acceptance');
  assertDeployment(manifest, directory);
  assertImage(manifest, 'backend', JSON.parse(readFileSync(resolve(inspections, 'backend.json'), 'utf8')),
    mode === 'acceptance' ? undefined : JSON.parse(readFileSync(resolve(inspections, 'backend.manifest.json'), 'utf8')));
  if (command === 'plan') {
    for (const role of roles) process.stdout.write(`${role}\t${manifest.images[role].reference}\n`);
  } else if (command === 'verify') {
    for (const role of roles) assertImage(manifest, role, JSON.parse(readFileSync(resolve(inspections, role + '.json'), 'utf8')),
      mode === 'acceptance' ? undefined : JSON.parse(readFileSync(resolve(inspections, role + '.manifest.json'), 'utf8')));
    console.info(`Release verification passed: ${manifest.version} ${manifest.sourceCommit} (${manifest.platform})`);
    console.info('Authenticity rests on GitHub/ghcr and the repository account.');
  } else throw new Error('Unknown verification command');
} catch (error) { console.error(`Release verification failed: ${error.message}`); process.exitCode = 1; }
