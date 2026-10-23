import type { PageTransaction } from './sessions';
import type { FastifyRequest } from 'fastify';
import { authorizeShellSession, validateSession, verifyPluginPageToken } from './sessions';
import { ApiError } from '@/utils/api-errors';

/** Public owning-domain operations used inside the caller's lifecycle transaction. */
export class PluginPageService {
  static async storageAuthority(tx: PageTransaction, request: FastifyRequest, slug: string) {
    const token = request.headers.authorization?.match(/^Bearer ([^\s]+)$/)?.[1];
    if (!token || request.headers.cookie !== undefined) throw new ApiError('INVALID_TOKEN');
    const admission = await verifyPluginPageToken(token, request, slug, tx);
    if (!admission?.user) throw new ApiError('PLUGIN_TASK_PRINCIPAL_REQUIRED');
    return { installationId: admission.installationId, generation: BigInt(admission.generation),
      principal: { type: admission.user.role === 'ADMIN' ? 'admin' as const : 'customer' as const, id: admission.user.id } };
  }

  static async downloadAuthority(tx: PageTransaction, request: FastifyRequest, slug: string, id: string) {
    const initial = await authorizeShellSession(request, slug, id, false);
    await tx.$queryRaw`SELECT id FROM public.plugin_installations WHERE id = ${initial.session.installationId} FOR SHARE`;
    if (initial.session.principalId) await tx.$queryRaw`SELECT id FROM public.users WHERE id = ${initial.session.principalId} FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM public.plugin_page_sessions WHERE id = ${id} FOR SHARE`;
    const session = await tx.pluginPageSession.findUnique({ where: { id } });
    if (!session) throw new ApiError('PLUGIN_PAGE_SESSION_REVOKED');
    const live = await validateSession(tx, session);
    if (!live.user || live.user.id !== initial.user?.id) throw new ApiError('FORBIDDEN');
    return { installationId: session.installationId, generation: session.generation,
      principal: { type: session.surface === 'admin' ? 'admin' as const : 'customer' as const, id: live.user.id } };
  }

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
