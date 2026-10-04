import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { issuePublisherCertificate } from '../packages/shared/src/plugin-signing';
import { testPublisher, testRoot } from '../apps/api/tests/fixtures/plugin-signing-keys';

const sdk = path.resolve('packages/plugin-sdk/dist/cli.js');
const repoRequire = createRequire(path.resolve('package.json'));

export async function shippingProject(slug: string) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jiffoo-sdk-e2e with spaces-'));
  const project = path.join(directory, 'project');
  const certificate = path.join(directory, 'certificate.json'), key = path.join(directory, 'publisher.pem');
  function command(entry: string, args: string[] = []) {
    const result = spawnSync(process.execPath, [entry, ...args], { env: process.env, encoding: 'utf8', windowsHide: true, shell: false, timeout: 60_000 });
    if (result.status !== 0) throw new Error(`SDK project command failed: ${result.stdout}${result.stderr}`);
  }
  try {
    command(sdk, ['create', '--category', 'shipping', '--slug', slug, '--name', `SDK Shipping ${slug}`, '--output', project]);
    // Use the installed esbuild package and native binary offline, as in the SDK API tests.
    await fs.mkdir(path.join(project, 'node_modules'));
    await fs.symlink(path.dirname(repoRequire.resolve('esbuild/package.json')), path.join(project, 'node_modules/esbuild'), process.platform === 'win32' ? 'junction' : 'dir');
    await fs.writeFile(certificate, JSON.stringify(issuePublisherCertificate('e2e-sdk-publisher', 'E2E SDK Publisher', testPublisher.publicKey, testRoot.privateKey)));
    await fs.writeFile(key, testPublisher.privateKey);
    return {
      name: `SDK Shipping ${slug}`,
      async devSmoke(token: string) {
        const original = await fs.readFile(path.join(project, 'manifest.json'), 'utf8');
        const child = spawn(process.execPath, [sdk, 'dev'], {
          cwd: project, shell: false, windowsHide: true,
          env: { ...process.env, JIFFOO_CORE_URL: 'http://127.0.0.1:3001', JIFFOO_ADMIN_TOKEN: token, JIFFOO_DEV_CERTIFICATE: certificate, JIFFOO_DEV_PRIVATE_KEY: key },
        });
        let stdout = '', stderr = '';
        child.stderr.on('data', data => { stderr += data.toString(); });
        const closed = new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
        let timer: NodeJS.Timeout | undefined;
        try {
          await new Promise<void>((resolve, reject) => {
            timer = setTimeout(() => reject(new Error('SDK dev did not upload within 60 seconds')), 60_000);
            child.stdout.on('data', data => {
              stdout += data.toString();
              if (/^jiffoo-dev: uploaded 1\.0\.1\r?$/m.test(stdout)) resolve();
            });
            void closed.then(code => reject(new Error(`SDK dev exited early (${code}): ${stderr}`)), reject);
          });
          console.log(`SDK dev smoke: ${stdout.trim()}`);
        } finally {
          if (timer) clearTimeout(timer);
          child.stdin.end();
          const code = await closed;
          if (code !== 0) throw new Error(`SDK dev did not stop cleanly (${code}): ${stderr}`);
        }
        if (await fs.readFile(path.join(project, 'manifest.json'), 'utf8') !== original) throw new Error('SDK dev modified the source manifest');
      },
      async signedZip() {
        command(path.join(project, 'tools/build.mjs'));
        const unsigned = path.join(directory, 'unsigned.zip'), signed = path.join(directory, 'signed.zip');
        command(sdk, ['pack', '--input', path.join(project, 'dist/package'), '--output', unsigned]);
        command(sdk, ['sign', '--input', unsigned, '--certificate', certificate, '--key', key, '--output', signed]);
        return signed;
      },
      cleanup: () => fs.rm(directory, { recursive: true, force: true }),
    };
  } catch (error) { await fs.rm(directory, { recursive: true, force: true }); throw error; }
}
