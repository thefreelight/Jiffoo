import assert from 'node:assert/strict';

const oneShots = ['silo-init', 'db-init', 'silo-volume-init'];
const infrastructure = [...oneShots, 'silo', 'postgres'];
const projectLabel = 'com.docker.compose.project';
const projection = '{"Id":{{json .Id}},"Name":{{json .Name}},"Labels":{{json .Config.Labels}},"State":{{json .State}}}';
const lines = value => value.trim().split(/\r?\n/).filter(Boolean);

export function redactComposeOutput(value, secrets = []) {
  let output = String(value);
  for (const secret of secrets.filter(value => typeof value === 'string' && value.length >= 12).sort((a, b) => b.length - a.length)) output = output.replaceAll(secret, '[REDACTED]');
  return output;
}
export async function archiveComposeStartup({ project, query, logs, save, secrets = [] }) {
  // Acceptance projects use UUID v4; the final lookahead rejects trailing newlines.
  assert.match(project, /^jiffoo-(?:compose|backup|update|trial)-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?![\s\S])/);
  const ids = lines(await query(['ps', '-aq', '--filter', `label=${projectLabel}=${project}`]));
  const containers = ids.length ? lines(await query(['inspect', '--format', projection, ...ids])).map(line => JSON.parse(line)) : [];
  for (const container of containers) assert.equal(container.Labels[projectLabel], project, 'Startup diagnostics include a foreign container');
  const services = new Set(infrastructure);
  for (const container of containers) if (!container.State.Running || container.State.Health?.Status === 'unhealthy') {
    const service = container.Labels['com.docker.compose.service']; if (service) services.add(service);
  }
  const errors = [], tails = [];
  for (const service of services) {
    assert.match(service, /^[a-z0-9][a-z0-9_-]*$/);
    let output;
    try { output = redactComposeOutput(await logs(service), secrets); }
    catch (error) { output = `Could not collect ${service} logs: ${redactComposeOutput(error.message, secrets)}`; errors.push(output); }
    await save(`startup-${service}.log`, output);
    const failed = containers.filter(container => container.Labels['com.docker.compose.service'] === service
      && (container.State.ExitCode !== 0 || container.State.OOMKilled || container.State.Health?.Status === 'unhealthy' || container.State.Status === 'dead'));
    if (failed.length) tails.push(`${service}: ${failed.map(container => `state=${container.State.Status}, exit=${container.State.ExitCode}, oom=${container.State.OOMKilled}`).join('; ')}\n${output.trimEnd().split(/\r?\n/).slice(-50).join('\n') || '[no service log output]'}`);
  }
  // Preserve the complete stack output independently of health and individual services.
  try { await save('stack.log', redactComposeOutput(await logs(), secrets)); }
  catch (error) { errors.push('Could not archive stack logs: ' + redactComposeOutput(error.message, secrets)); }
  await save('startup-state.json', redactComposeOutput(JSON.stringify({ project, containers, errors }, null, 2), secrets));
  return { summary: [...tails, ...errors].join('\n\n'), containers };
}
export async function withComposeStartupDiagnostics(action, options) {
  try { return await action(); }
  catch (error) {
    let summary;
    try { summary = (await archiveComposeStartup(options)).summary; }
    catch (diagnosticError) { summary = 'Startup diagnostics failed: ' + redactComposeOutput(diagnosticError.message, options.secrets); }
    throw new Error([redactComposeOutput(error.message, options.secrets), summary].filter(Boolean).join('\n\n'));
  }
}
