import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { localSteps, ciSteps, apiBuildStep } from './verify-steps.mjs';

export function mergeResults(reports, needs) {
  const errors = [];
  if (Object.keys(needs).length !== 6 || ['api', 'quality', 'e2e', 'compose', 'release-verify', 'backup'].some(name => needs[name]?.result !== 'success')) errors.push('Every required job must conclude success; cancelled and skipped jobs are failures.');
  const identities = reports.map(report => report.group === 'api' ? `api-${report.shard}` : report.group);
  const expected = ['api-1/4', 'api-2/4', 'api-3/4', 'api-4/4', 'quality', 'e2e', 'compose', 'release-verify', 'backup'];
  if (identities.length !== expected.length || expected.some(id => identities.filter(item => item === id).length !== 1)) errors.push('Missing or duplicate CI job reports.');
  for (const report of reports) {
    if (!report.valid || report.results.some(([, result]) => result !== 'PASS')) errors.push(`Invalid or failed report: ${report.group} ${report.shard ?? ''}`);
    try {
      const plan = ciSteps('DATABASE_URL_TEST', report.group, report.shard).map(([name]) => name);
      if (JSON.stringify(report.results.map(([name]) => name)) !== JSON.stringify(plan)) errors.push(`Incomplete job step catalogue: ${report.group}`);
      const testNames = plan.filter(name => name.startsWith('Run '));
      if (JSON.stringify(report.outputs.map(({ name }) => name)) !== JSON.stringify(testNames)) errors.push(`Incomplete job test output: ${report.group}`);
    } catch (error) { errors.push(error.message); }
  }
  const api = reports.filter(report => report.group === 'api');
  const full = api[0]?.fullApiFiles ?? [];
  if (!full.length || new Set(full).size !== full.length || api.some(report => JSON.stringify(report.fullApiFiles) !== JSON.stringify(full))) errors.push('API full file inventories disagree or are empty.');
  const actual = api.flatMap(report => report.apiFiles);
  if (new Set(actual).size !== actual.length || JSON.stringify([...actual].sort()) !== JSON.stringify([...full].sort())) errors.push('API shard union does not equal the full API file inventory exactly once.');
  const steps = [...localSteps('DATABASE_URL_TEST').map(([name]) => name), apiBuildStep[0], 'Run Docker Compose acceptance', 'Run release verification acceptance', 'Run backup and restore acceptance'];
  for (const name of steps) if (!reports.some(report => report.results.some(([step]) => step === name))) errors.push(`Missing full-gate step: ${name}`);
  const lines = ['=== Final test summary ==='];
  if (api.length === 4) {
    const totals = { files: 0, passed: 0, skipped: 0 };
    const starts = [];
    for (const report of api) {
      const output = report.outputs.find(item => item.name === 'Run API tests')?.output.replace(/\x1b\[[0-9;]*m/g, '') ?? '';
      const files = output.match(/Test Files\s+(\d+) passed \((\d+)\)/);
      const tests = output.match(/Tests\s+(\d+) passed(?: \| (\d+) skipped)? \((\d+)\)/);
      const start = output.match(/Start at\s+(\d{2}:\d{2}:\d{2})/);
      if (!files || !tests || !start || Number(files[1]) !== report.apiFiles.length || Number(files[1]) !== Number(files[2]) || Number(tests[1]) + Number(tests[2] ?? 0) !== Number(tests[3])) {
        errors.push('Invalid API shard suite counts.');
        continue;
      }
      totals.files += Number(files[1]);
      totals.passed += Number(tests[1]);
      totals.skipped += Number(tests[2] ?? 0);
      starts.push(start[1]);
    }
    lines.push('Run API tests:', `   Start at  ${starts.sort()[0] ?? 'unavailable'}`, ` Test Files  ${totals.files} passed (${totals.files})`,
      `      Tests  ${totals.passed} passed${totals.skipped ? ` | ${totals.skipped} skipped` : ''} (${totals.passed + totals.skipped})`);
  }
  for (const report of [...api.sort((a, b) => a.shard.localeCompare(b.shard)), ...reports.filter(report => report.group !== 'api')]) {
    for (const { name, kind, output } of report.outputs) {
      lines.push(`${name}${report.shard ? ` (shard ${report.shard})` : ''}:`);
      const labels = kind === 'vitest' ? ['Start at', 'Test Files', 'Tests'] : kind === 'compose' ? ['Compose start time', 'Compose results', 'Compose duration'] : kind === 'release' ? ['Release start time', 'Release results', 'Release duration'] : kind === 'backup' ? ['Backup start time', 'Backup results', 'Backup duration'] : ['Playwright start time', 'Playwright results'];
      const clean = output.replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/);
      for (const label of labels) {
        const line = clean.findLast(value => value.trimStart().startsWith(label + ' ') || value.trimStart().startsWith(label + ':'));
        if (!line) errors.push(`Missing ${label} in ${name}`);
        else lines.push(line);
      }
      if (['compose', 'release', 'backup'].includes(kind)) {
        const prefix = kind === 'compose' ? 'Compose' : kind === 'release' ? 'Release' : 'Backup';
        const start = clean.findIndex(line => line.startsWith('| Check | Result | Duration |'));
        if (start < 0) errors.push(`Missing ${prefix} per-check result table.`);
        else {
          const table = clean.slice(start).filter(line => line.startsWith('|'));
          const rows = table.slice(2);
          const counts = clean.find(line => line.startsWith(prefix + ' results: '))?.match(/^(?:Compose|Release|Backup) results: (\d+) passed, (\d+) failed, (\d+) skipped$/);
          if (!rows.length || rows.some(line => !line.includes(' | PASS |')) || !counts || Number(counts[1]) !== rows.length || Number(counts[2]) !== 0 || Number(counts[3]) !== 0) errors.push(`${prefix} per-check results are failed, skipped or inconsistent.`);
          lines.push('', ...table);
        }
      }
    }
  }
  lines.push('', '| Step | Result | Duration |', '| --- | --- | --- |');
  for (const name of steps) {
    const rows = reports.flatMap(report => report.results.filter(([step]) => step === name));
    lines.push(`| ${name} | ${rows.length && rows.every(([, result]) => result === 'PASS') ? 'PASS' : 'FAIL'} | ${rows.reduce((sum, row) => sum + Number.parseFloat(row[2]), 0).toFixed(2)}s |`);
  }
  lines.push(`| API shard file coverage (${actual.length}/${full.length}) | ${errors.length ? 'FAIL' : 'PASS'} | 0.00s |`);
  for (const error of errors) lines.push(`ERROR: ${error}`);
  return { valid: errors.length === 0, block: lines.join('\n') + '\n', errors };
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/verify-ci-summary.mjs')) {
  if (process.env.GITHUB_ACTIONS !== 'true') throw new Error('CI summary requires GitHub Actions.');
  const [directory, needsJson] = process.argv.slice(2);
  const reports = [];
  for (const entry of existsSync(directory) ? readdirSync(directory, { withFileTypes: true }) : []) {
    if (!entry.isDirectory()) continue;
    try { reports.push(JSON.parse(readFileSync(join(directory, entry.name, 'verify-result.json'), 'utf8'))); } catch (error) {
      console.error(`Report unavailable for ${entry.name}: ${error.message}`);
    }
  }
  const result = mergeResults(reports, JSON.parse(needsJson));
  writeFileSync('verify-summary.txt', result.block);
  process.stdout.write(result.block);
  process.exitCode = result.valid ? 0 : 1;
}
