import { Client } from 'pg';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { reclaimInvocationMarkers, MarkerReclaimError, type CompleteStopEvidence, type RecordedBoot } from '../src/core/admin/extension-installer/plugin-marker-reclaim';

const execute = promisify(execFile);
export async function verifyDockerStopped(boots: RecordedBoot[], evidence: CompleteStopEvidence): Promise<void> {
  if (!evidence.composeFile || !/^[a-z0-9][a-z0-9_-]*$/i.test(evidence.project) || !Array.isArray(evidence.coreServices) || evidence.coreServices.length < 2) throw new MarkerReclaimError('Compose inventory, API/worker services and complete boot evidence are required');
  const { stdout } = await execute('docker', ['compose', '-f', evidence.composeFile, '-p', evidence.project, 'ps', '--all', '--format', 'json'], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  const text = stdout.trim();
  const inventory = text.startsWith('[') ? JSON.parse(text) : text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  if (!inventory.length) throw new MarkerReclaimError('Compose inventory is empty');
  for (const service of evidence.coreServices) {
    const members = inventory.filter(container => container.Service === service);
    if (!members.length || members.some(container => container.State !== 'exited' && container.State !== 'dead')) throw new MarkerReclaimError('Every Core service replica in the supplied deployment must be stopped');
  }
  for (const boot of boots) {
    const proof = evidence.boots.find(item => item.bootNonce === boot.bootNonce)!;
    if (!/^[0-9a-f]{12,64}$/i.test(proof.containerId) || !inventory.some(container => evidence.coreServices.includes(container.Service) && (container.ID.startsWith(proof.containerId) || proof.containerId.startsWith(container.ID)))) throw new MarkerReclaimError('Boot container is outside the stopped Core service inventory');
    const { stdout: inspected } = await execute('docker', ['inspect', proof.containerId], { windowsHide: true });
    const container = JSON.parse(inspected)[0];
    if (container.State.Running || container.State.Restarting || container.State.Pid !== 0 || container.Config.Hostname !== boot.hostname) throw new MarkerReclaimError('Container exit evidence does not match the recorded boot');
    const { stdout: logs } = await execute('docker', ['logs', proof.containerId], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    if (!logs.split(/\r?\n/).some(line => { try { const record = JSON.parse(line); return record.event === 'core-process-started' && record.bootNonce === boot.bootNonce && record.hostname === boot.hostname; } catch { return false; } })) throw new MarkerReclaimError('Recorded boot is not bound to the stopped container');
  }
}
async function main() {
  if (process.env.JIFFOO_TEST_PLUGIN_RECOVERY_CONTROL !== undefined && process.env.NODE_ENV !== 'test') throw new MarkerReclaimError('Recovery test controls are not permitted outside NODE_ENV=test');
  if (process.argv.length !== 4 || process.argv[2] !== '--evidence') throw new MarkerReclaimError('Usage: reclaim-plugin-markers --evidence complete-stop.json');
  if (!process.env.DATABASE_URL) throw new MarkerReclaimError('DATABASE_URL is required');
  const url = new URL(process.env.DATABASE_URL);
  for (const key of ['schema', 'connection_limit', 'pool_timeout']) url.searchParams.delete(key);
  url.searchParams.set('application_name', 'jiffoo-operator-marker-reclaim');
  const evidence = JSON.parse(await readFile(process.argv[3], 'utf8')) as CompleteStopEvidence;
  const client = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 5_000 });
  try { await client.connect(); console.log(JSON.stringify(await reclaimInvocationMarkers(client, evidence, verifyDockerStopped))); }
  finally { await client.end(); }
}
if (process.argv[1]?.replaceAll('\\', '/').match(/\/reclaim-plugin-markers\.(?:ts|js)$/)) void main().catch(error => { console.error(JSON.stringify({ code: error instanceof MarkerReclaimError ? error.code : 'DATABASE_UNAVAILABLE', message: error instanceof MarkerReclaimError ? error.message : 'Recovery command failed; diagnostic values withheld' })); process.exitCode = 1; });
