import type { PageTransaction } from './sessions';

/** Public owning-domain operations used inside the caller's lifecycle transaction. */
export class PluginPageService {
  static async revokePrincipalSessions(tx: PageTransaction, principalId: string) {
    await tx.pluginPageSession.updateMany({
      where: { principalId, revokedAt: null }, data: { revokedAt: new Date() },
    });
  }

  static async revokeInstallationSessions(tx: PageTransaction, installationId: string) {
    await tx.pluginPageSession.updateMany({
      where: { installationId, revokedAt: null }, data: { revokedAt: new Date() },
    });
  }

  static async revokePluginSessions(tx: PageTransaction, pluginSlug: string) {
    await tx.pluginPageSession.updateMany({
      where: { installation: { pluginSlug }, revokedAt: null }, data: { revokedAt: new Date() },
    });
  }
}

export { bindPurchaseOrigin, purchaseReturnTarget } from './purchase-origins';
