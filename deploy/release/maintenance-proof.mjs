const pause = () => new Promise(resolve => setTimeout(resolve, 100));
const identity = row => ({ pid: row.pid, application_name: row.application_name, usename: row.usename, state: row.state });

/** Require a clean snapshot after bounded draining; never exempt or terminate unknown sessions. */
export async function proveDatabaseQuiescence(readSessions, executor, wait = pause) {
  const observed = new Map();
  for (let check = 1; check <= 21; check++) {
    const unexpected = (await readSessions()).filter(row => !executor || row.usename !== executor.databaseRole
      || !row.application_name.startsWith(executor.applicationPrefix));
    if (!unexpected.length) return { checks: check, observed: [...observed.values()] };
    for (const row of unexpected) observed.set(row.pid, identity(row));
    if (check === 21) throw new Error('Database sessions still hold unknown work; maintenance is not proven: ' + JSON.stringify(unexpected.map(identity)));
    await wait();
  }
}
