import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const execute = promisify(execFile);
type ProcessRow = { ProcessId: number; ParentProcessId: number; ExecutablePath: string; CommandLine: string; CreationDate: string };
/** Record and verify a fault-injection child's entire tree before sending any termination signal. */
export async function recordB10ProcessTree(rootPid: number): Promise<ProcessRow[]> {
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
  const ids = new Set([rootPid]);
  for (;;) { const size = ids.size; for (const row of rows) if (ids.has(row.ParentProcessId)) ids.add(row.ProcessId); if (ids.size === size) break; }
  const tree = rows.filter(row => ids.has(row.ProcessId));
  const root = tree.find(row => row.ProcessId === rootPid);
  const workspace = path.resolve(process.cwd(), '../..');
  if (!root || !(root.CommandLine.includes(workspace) || root.ExecutablePath.includes(workspace))) throw new Error('Fault-injection child is outside this worktree');
  for (const row of tree) {
    if (/[\\/]OpenAI[\\/]Codex[\\/]|[\\/]cua_node[\\/]|[\\/]codex-runtimes[\\/]/i.test(row.ExecutablePath + row.CommandLine)) throw new Error('Excluded Codex runtime in child tree');
    let current = row;
    while (current.ProcessId !== rootPid) { const parent = tree.find(value => value.ProcessId === current.ParentProcessId); if (!parent) throw new Error('Unverified descendant in child tree'); current = parent; }
  }
  const record = path.join(tmpdir(), `jiffoo-b10-process-${rootPid}-${Date.now()}.json`);
  await writeFile(record, JSON.stringify(tree, null, 2), 'utf8');
  console.info(JSON.stringify({ event: 'b10-process-tree-recorded', record, tree }));
  return tree;
}
export async function forceB10ProcessTree(rootPid: number, expectedStart: string): Promise<void> {
  // Recheck membership immediately before escalation; the caller already allowed ten seconds for graceful exit.
  const tree = await recordB10ProcessTree(rootPid);
  if (tree.find(row => row.ProcessId === rootPid)!.CreationDate !== expectedStart) throw new Error('Fault-injection PID was reused');
  if (process.platform === 'win32') await execute('taskkill', ['/PID', String(rootPid), '/T', '/F'], { windowsHide: true });
  else for (const row of tree.reverse()) { try { process.kill(row.ProcessId, 'SIGKILL'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; } }
}
export async function confirmB10ProcessTreeExited(tree: ProcessRow[]): Promise<void> {
  const ids = tree.map(row => row.ProcessId);
  if (process.platform === 'win32') {
    const { stdout } = await execute('powershell.exe', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -in ${ids.join(',')} } | Select-Object ProcessId,ParentProcessId,ExecutablePath,CommandLine,CreationDate | ConvertTo-Json -Depth 3`], { windowsHide: true });
    if (stdout.trim()) throw new Error(`Recorded child processes remain after termination: ${stdout}`);
  } else {
    for (const id of ids) {
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
