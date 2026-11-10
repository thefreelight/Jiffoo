import { describe, expect, it } from 'vitest';
import { matchesProcessIdentity, selectOwnedProcessTree, type ProcessRow } from '../helpers/b10-process-tree';
const row = (id: number, parent: number, time: number, command = 'node /owned/worktree/worker.ts'): ProcessRow => ({ ProcessId: id, ParentProcessId: parent, ExecutablePath: 'node', CommandLine: command, CreationDate: `/Date(${time})/` });
describe('Fault-injection process ownership', () => {
  it('excludes an older unrelated process with a stale parent PID', () => {
    const root = row(20, 1, 2000);
    const unrelated = row(30, 20, 1000, 'unrelated-service');
    const actualChild = row(40, 20, 2100);
    expect(selectOwnedProcessTree([root, unrelated, actualChild], 20, '/owned/worktree').map(value => value.ProcessId)).toEqual([20, 40]);
  });
  it('checks creation time at every ancestry edge', () => {
    const tree = selectOwnedProcessTree([row(20, 1, 2000), row(30, 20, 2100), row(40, 30, 2050)], 20, '/owned/worktree');
    expect(tree.map(value => value.ProcessId)).toEqual([20, 30]);
  });
  it('does not mistake a reused PID for a surviving recorded process', () => {
    expect(matchesProcessIdentity(row(20, 1, 2000), row(20, 1, 3000))).toBe(false);
    expect(matchesProcessIdentity(row(20, 1, 2000), row(20, 1, 2000))).toBe(true);
  });
  it('fails closed when a descendant creation time cannot be established', () => {
    expect(() => selectOwnedProcessTree([row(20, 1, 2000), { ...row(30, 20, 2100), CreationDate: '' }], 20, '/owned/worktree')).toThrow('creation time');
  });
});
