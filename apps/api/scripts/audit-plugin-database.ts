import { Client } from 'pg';
import { auditPluginDatabase, pluginDatabaseAuditExitCode } from '../src/core/admin/extension-installer/plugin-database-audit';

export async function runPluginDatabaseAuditCli(args: string[], databaseUrl: string | undefined): Promise<number> {
  let url: URL;
  try {
    if (args.length || !databaseUrl) throw new Error();
    url = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2) throw new Error();
    for (const key of ['schema', 'connection_limit', 'pool_timeout']) url.searchParams.delete(key);
    url.searchParams.set('application_name', 'jiffoo-plugin-database-auditor');
  } catch {
    console.error(JSON.stringify({ code: 'INVALID_ARGUMENTS', message: 'Provide DATABASE_URL only; no command arguments are accepted.' }));
    return 3;
  }
  const client = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 5_000 });
  client.on('error', () => undefined);
  try {
    try { await client.connect(); }
    catch {
      const report = await auditPluginDatabase({ query: () => Promise.reject(new Error('Connection unavailable')) } as unknown as Pick<Client, 'query'>);
      console.log(JSON.stringify(report));
      console.error(JSON.stringify({ code: 'DATABASE_UNAVAILABLE', message: 'Audit could not connect; diagnostic values withheld.' }));
      return 2;
    }
    const report = await auditPluginDatabase(client);
    console.log(JSON.stringify(report));
    return pluginDatabaseAuditExitCode(report);
  } finally { await client.end().catch(() => undefined); }
}
if (process.argv[1]?.replaceAll('\\', '/').match(/\/audit-plugin-database\.(?:ts|js)$/)) {
  void runPluginDatabaseAuditCli(process.argv.slice(2), process.env.DATABASE_URL).then(code => { process.exitCode = code; }).catch(() => {
    console.error(JSON.stringify({ code: 'AUDIT_UNAVAILABLE', message: 'Audit could not complete; diagnostic values withheld.' }));
    process.exitCode = 2;
  });
}
