import { setPluginDatabaseAuditTestLimits } from '../../src/core/admin/extension-installer/plugin-database-audit';
import { runPluginDatabaseAuditCli } from '../../scripts/audit-plugin-database';

if (process.env.NODE_ENV !== 'test' || !process.send) throw new Error('Audit child requires the test IPC transport');
process.once('message', async (message: { schema: string; limits?: Parameters<typeof setPluginDatabaseAuditTestLimits>[1]; args?: string[] }) => {
  try {
    setPluginDatabaseAuditTestLimits(true, message.limits, message.schema);
    process.exitCode = await runPluginDatabaseAuditCli(message.args ?? [], process.env.DATABASE_URL);
  } catch { process.exitCode = 2; }
  finally { process.disconnect(); }
});
process.send({ ready: true });
