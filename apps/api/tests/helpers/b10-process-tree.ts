import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const execute = promisify(execFile);
export type ProcessRow = { ProcessId: number; ParentProcessId: number; ExecutablePath: string; CommandLine: string; CreationDate: string };
function creationTime(value: string): number {
  const windows = /^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/.exec(value);
  const time = windows ? Number(windows[1]) : Date.parse(value);
  if (!Number.isFinite(time)) throw new Error('Process creation time cannot be verified');
  return time;
}
export function matchesProcessIdentity(expected: ProcessRow, actual: ProcessRow): boolean {
  return expected.ProcessId === actual.ProcessId && creationTime(expected.CreationDate) === creationTime(actual.CreationDate);
}
export function selectOwnedProcessTree(rows: ProcessRow[], rootPid: number, workspace: string): ProcessRow[] {
  const root = rows.find(row => row.ProcessId === rootPid);
  if (!root || !(root.CommandLine?.includes(workspace) || root.ExecutablePath?.includes(workspace))) throw new Error('Fault-injection child is outside this worktree');
  creationTime(root.CreationDate);
  const owned = new Map<number, ProcessRow>([[rootPid, root]]);
  for (;;) {
    const size = owned.size;
    for (const row of rows) {
      if (owned.has(row.ProcessId)) continue;
      const parent = owned.get(row.ParentProcessId);
      if (!parent) continue;
      // Windows retains a dead parent's PID; an older process is not a child
      // of a newer process that happens to have reused that PID.
      if (creationTime(row.CreationDate) < creationTime(parent.CreationDate)) continue;
      owned.set(row.ProcessId, row);
    }
    if (owned.size === size) break;
  }
  const tree = [...owned.values()];
  for (const row of tree) {
    if (/[\\/]OpenAI[\\/]Codex[\\/]|[\\/]cua_node[\\/]|[\\/]codex-runtimes[\\/]/i.test((row.ExecutablePath || '') + (row.CommandLine || ''))) throw new Error('Excluded Codex runtime in child tree');
  }
  return tree;
}
async function processRows(): Promise<ProcessRow[]> {
  let rows: ProcessRow[];
  if (process.platform === 'win32') {
    const { stdout } = await execute('powershell.exe', ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,ExecutablePath,CommandLine,CreationDate | ConvertTo-Json -Depth 3'], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    rows = JSON.parse(stdout);
  } else {
    const { stdout } = await execute('ps', ['-eo', 'pid=,ppid=,lstart=,args=']);
    rows = stdout.trim().split('\n').map(line => {
      const fields = line.trim().match(/^(\d+)\s+(\d+)\s+(\S+\s+\S+\s+\d+\s+\S+\s+\d+)\s+(.+)$/)!;
      return { ProcessId: Number(fields[1]), ParentProcessId: Number(fields[2]), CreationDate: fields[3], CommandLine: fields[4], ExecutablePath: fields[4].split(' ')[0] };
    });
  }
  return rows;
}
/** Record and verify a fault-injection child's entire tree before sending any termination signal. */
export async function recordB10ProcessTree(rootPid: number): Promise<ProcessRow[]> {
  const tree = selectOwnedProcessTree(await processRows(), rootPid, path.resolve(process.cwd(), '../..'));
  const record = path.join(tmpdir(), `jiffoo-b10-process-${rootPid}-${Date.now()}.json`);
  await writeFile(record, JSON.stringify(tree, null, 2), 'utf8');
  console.info(JSON.stringify({ event: 'b10-process-tree-recorded', record, tree }));
  return tree;
}
export async function forceB10ProcessTree(rootPid: number, expectedStart: string): Promise<void> {
  // Recheck membership immediately before escalation; the caller already allowed ten seconds for graceful exit.
  const tree = await recordB10ProcessTree(rootPid);
  if (tree.find(row => row.ProcessId === rootPid)!.CreationDate !== expectedStart) throw new Error('Fault-injection PID was reused');
  for (const row of tree.reverse()) {
    const current = (await processRows()).find(value => value.ProcessId === row.ProcessId);
    if (!current || !matchesProcessIdentity(row, current)) continue;
    // Do not use taskkill /T: it would traverse stale PPIDs independently of
    // the creation-time ownership checks above.
    if (process.platform === 'win32') await execute('taskkill', ['/PID', String(row.ProcessId), '/F'], { windowsHide: true });
    else try { process.kill(row.ProcessId, 'SIGKILL'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  }
}
export async function confirmB10ProcessTreeExited(tree: ProcessRow[]): Promise<void> {
  const current = await processRows();
  const remaining = tree.filter(expected => current.some(actual => matchesProcessIdentity(expected, actual)));
  if (process.platform === 'win32') {
    if (remaining.length) throw new Error(`Recorded child processes remain after termination: ${JSON.stringify(remaining)}`);
  } else {
    for (const row of remaining) {
      const id = row.ProcessId;
      try { process.kill(id, 0); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') continue; throw error; }
      let stdout: string;
      try { ({ stdout } = await execute('ps', ['-p', String(id), '-o', 'stat='])); }
      catch (error) {
        const result = error as Error & { code?: number; stdout?: string; stderr?: string };
        // The process can exit between kill(0) and ps; an empty exit-one result proves absence.
        if (result.code === 1 && result.stdout === '' && result.stderr === '') continue;
        throw error;
      }
      if (!stdout.trim().startsWith('Z')) throw new Error(`Recorded child process remains after termination: ${id}`);
    }
  }
}
