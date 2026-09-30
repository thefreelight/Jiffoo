import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { issuePublisherCertificate } = require('../../packages/shared/dist/shared/src/plugin-signing.js');

async function main() {
  const flags = new Map();
  for (let i = 2; i < process.argv.length; i += 2) {
    if (!['--publisher-id', '--name', '--public-key', '--root-private-key', '--output'].includes(process.argv[i]) ||
      !process.argv[i + 1] || flags.has(process.argv[i])) throw new Error('Invalid arguments');
    flags.set(process.argv[i], process.argv[i + 1]);
  }
  if (flags.size !== 5) throw new Error('Missing arguments');
  const inputPath = resolve(flags.get('--root-private-key'));
  const outputPath = resolve(flags.get('--output'));
  let pem;
  try { pem = await readFile(inputPath, 'utf8'); } catch { throw new Error(`Cannot read root private key at ${inputPath}`); }
  let certificate;
  try {
    certificate = issuePublisherCertificate(flags.get('--publisher-id'), flags.get('--name'), flags.get('--public-key'), pem);
  } catch { throw new Error('Invalid publisher identity or key'); }
  try { await writeFile(outputPath, `${JSON.stringify(certificate)}\n`, { flag: 'wx', mode: 0o600 }); }
  catch { throw new Error(`Cannot write certificate at ${outputPath}`); }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
