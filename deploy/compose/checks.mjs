export const scenarioPlans = {
  acceptance: ['Database identity', 'Concurrent builtin initialization', 'Owner installation and login', 'Customer registration and login',
    'Plugin disable and enable propagation', 'Warm theme switch across APIs', 'Shared S3 upload and read', 'Product cart and order creation',
    'Manual payment across APIs', 'Payment notification persisted exactly once', 'Shipping and delivery across APIs', 'State checker runtime',
    'Shop HTTPS frontend', 'Admin HTTPS frontend'],
  'client-a': ['Shared anonymous API budget', 'HTTPS API rejects spoofed forwarding headers', 'Shop BFF preserves IP and rejects spoofed headers'],
  'client-b': ['Second client HTTPS API budget', 'Second client Shop BFF budget'],
};

export class AcceptanceChecks {
  rows = [];
  values = new Map();

  async run(name, dependencies, action) {
    if (this.rows.some(row => row.name === name)) throw new Error(`Duplicate check: ${name}`);
    const blocked = dependencies.filter(dependency => this.rows.find(row => row.name === dependency)?.status !== 'PASS');
    if (blocked.length) {
      this.rows.push({ name, status: 'SKIPPED', duration: '0.00s', detail: `Requires successful checks: ${blocked.join(', ')}` });
      return;
    }
    const start = performance.now();
    try {
      const value = await action();
      this.values.set(name, value);
      this.rows.push({ name, status: 'PASS', duration: `${((performance.now() - start) / 1000).toFixed(2)}s`, detail: '' });
      return value;
    } catch (error) {
      this.rows.push({ name, status: 'FAIL', duration: `${((performance.now() - start) / 1000).toFixed(2)}s`, detail: error instanceof Error ? error.message : String(error) });
    }
  }

  importRows(rows) {
    if (!Array.isArray(rows) || !rows.length) throw new Error('Missing container check results');
    for (const row of rows) {
      if (!row || typeof row.name !== 'string' || !['PASS', 'FAIL', 'SKIPPED'].includes(row.status) || !/^\d+\.\d{2}s$/.test(row.duration) || typeof row.detail !== 'string' || this.rows.some(existing => existing.name === row.name)) throw new Error('Invalid or duplicate container check result');
      this.rows.push(row);
    }
  }

  value(name) { return this.values.get(name); }
  get passed() { return this.rows.length > 0 && this.rows.every(row => row.status === 'PASS'); }
  counts() {
    return Object.fromEntries(['PASS', 'FAIL', 'SKIPPED'].map(status => [status, this.rows.filter(row => row.status === status).length]));
  }
  table() {
    const cell = value => value.replace(/\s+/g, ' ').replaceAll('|', '\\|');
    return ['| Check | Result | Duration | Error or skipped reason |', '| --- | --- | --- | --- |',
      ...this.rows.map(row => `| ${cell(row.name)} | ${row.status} | ${row.duration} | ${cell(row.detail)} |`)].join('\n') + '\n';
  }
}
