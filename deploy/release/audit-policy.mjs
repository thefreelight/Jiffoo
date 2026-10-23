import assert from 'node:assert/strict';

export function auditDatabase(rows, project, mode) {
  assert.ok(['acceptance', 'ghcr'].includes(mode), 'Unknown release identity mode');
  assert.ok(Array.isArray(rows) && rows.every(row => row.Config?.Labels?.['com.docker.compose.project'] === project), 'Audit state includes a foreign project');
  const service = name => {
    const matches = rows.filter(row => row.Config.Labels['com.docker.compose.service'] === name && row.Config.Labels['com.docker.compose.oneoff'] !== 'True');
    assert.equal(matches.length, 1, 'Audit requires one installed ' + name);
    return matches[0];
  };
  const environment = (container, key) => {
    const entries = container.Config.Env.filter(value => value.startsWith(key + '='));
    assert.equal(entries.length, 1, 'Audit requires an unambiguous ' + key);
    return entries[0].slice(key.length + 1);
  };
  const url = new URL(environment(service('api-1'), 'DATABASE_URL'));
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol), 'Audit requires PostgreSQL');
  const database = environment(service('postgres'), 'POSTGRES_DB');
  assert.equal(decodeURIComponent(url.pathname), '/' + database, 'Audit database differs from the installed PostgreSQL database');
  // Acceptance identifies immutable local images, including real local trials.
  // Verification runners independently require exactly jiffoo_core_test before creating services.
  if (mode === 'acceptance') assert.ok(['jiffoo_core', 'jiffoo_core_test'].includes(database), 'Unsupported acceptance database');
  return { url, database };
}
