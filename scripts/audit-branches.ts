#!/usr/bin/env tsx
/**
 * Branch audit (repo-hardening-2026h2 §4.1)
 *
 * Lists every local and remote branch with its last-commit date, whether it
 * is merged into main (via `git cherry` patch-equivalence), and how many
 * commits it is ahead of main. Read-only: prints a markdown table for
 * branch-audit.md; disposition decisions are made by a human.
 *
 * Usage: npx tsx scripts/audit-branches.ts [--base main]
 */

import { execFileSync } from 'child_process';

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

const baseIdx = process.argv.indexOf('--base');
const base = baseIdx > -1 ? process.argv[baseIdx + 1] : 'origin/main';

interface BranchInfo {
  ref: string;
  scope: 'local' | 'remote';
  lastCommitDate: string;
  aheadOfMain: number;
  fullyMerged: boolean;
}

function collect(pattern: string, scope: 'local' | 'remote'): BranchInfo[] {
  const lines = git(
    'for-each-ref',
    '--format=%(refname:short)\t%(committerdate:short)',
    pattern,
  )
    .split('\n')
    .filter(Boolean);

  const rows: BranchInfo[] = [];
  for (const line of lines) {
    const [ref, lastCommitDate] = line.split('\t');
    if (!ref || ref === 'origin' || ref.endsWith('/HEAD')) continue;
    if (ref === base || ref === 'main') continue;

    let aheadOfMain = 0;
    let fullyMerged = false;
    try {
      // `git cherry` marks commits missing from base with '+'
      const cherry = git('cherry', base, ref)
        .split('\n')
        .filter((l) => l.startsWith('+'));
      aheadOfMain = cherry.length;
      fullyMerged = cherry.length === 0;
    } catch {
      aheadOfMain = -1; // unrelated history or error
    }

    rows.push({ ref, scope, lastCommitDate, aheadOfMain, fullyMerged });
  }
  return rows;
}

const rows = [
  ...collect('refs/heads', 'local'),
  ...collect('refs/remotes/origin', 'remote'),
].sort((a, b) => (a.lastCommitDate < b.lastCommitDate ? 1 : -1));

console.log(`# Branch Audit — base: ${base} — generated ${new Date().toISOString().slice(0, 10)}`);
console.log('');
console.log('| Branch | Scope | Last commit | Ahead of main | Merged? | Disposition |');
console.log('|--------|-------|-------------|---------------|---------|-------------|');
for (const r of rows) {
  const merged = r.aheadOfMain === -1 ? 'error' : r.fullyMerged ? 'yes' : 'no';
  const suggestion = r.fullyMerged ? 'delete-merged' : '';
  console.log(
    `| \`${r.ref}\` | ${r.scope} | ${r.lastCommitDate} | ${r.aheadOfMain === -1 ? '?' : r.aheadOfMain} | ${merged} | ${suggestion} |`,
  );
}
console.log('');
console.log(`Total: ${rows.length} branches (fill Disposition: delete-merged / archive-then-delete / keep(reason))`);
