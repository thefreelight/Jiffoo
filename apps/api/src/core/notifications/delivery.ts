import { prisma } from '@/config/database';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { callContract } from '@/core/admin/extension-installer/plugin-runtime';

const retryMinutes = [1, 5, 15, 60, 360];
const secretPattern = /\{\{secret\.(link|code)\}\}/g;

function substitute(content: string, secrets: Record<string, unknown>): string {
  return content.replace(secretPattern, (_, key: string) =>
    typeof secrets[key] === 'string' ? secrets[key] : '');
}

export async function deliverPendingNotifications(): Promise<number> {
  const claimed = await prisma.$transaction(async (tx) => {
    const lock = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(918202) AS locked`;
    if (!lock[0]?.locked) return [];
    const now = new Date();
    await tx.notification.updateMany({
      where: { status: 'SENDING', updatedAt: { lt: new Date(now.getTime() - 5 * 60_000) } },
      data: { status: 'PENDING', nextAttemptAt: now },
    });
    const candidates = await tx.notification.findMany({
      where: { status: 'PENDING', nextAttemptAt: { lte: now } },
      orderBy: { nextAttemptAt: 'asc' },
      take: 50,
    });
    const rows = [];
    for (const candidate of candidates) {
      const updated = await tx.notification.updateMany({
        where: { id: candidate.id, status: 'PENDING', nextAttemptAt: { lte: now } },
        data: { status: 'SENDING' },
      });
      if (updated.count) rows.push(candidate);
    }
    return rows;
  });

  for (const notification of claimed) {
    let providerSlug: string | undefined;
    try {
      const provider = await PluginManagementService.resolveSingleProvider('notification');
      if (!provider) throw new Error('No enabled notification provider');
      providerSlug = provider.pluginSlug;
      const secrets = notification.secretJson && typeof notification.secretJson === 'object' && !Array.isArray(notification.secretJson)
        ? notification.secretJson as Record<string, unknown> : {};
      const result = await callContract(providerSlug, 'notification', 1, 'send', {
        channel: 'email',
        to: notification.toAddress,
        subject: notification.subject,
        html: substitute(notification.html, secrets),
        text: substitute(notification.text, secrets),
        locale: notification.locale,
        idempotencyKey: notification.id,
      }) as { accepted: boolean; providerMessageId?: string; error?: string };
      if (!result.accepted) throw new Error(result.error || 'Notification provider rejected delivery');
      await prisma.notification.updateMany({
        where: { id: notification.id, status: 'SENDING' },
        data: { status: 'SENT', providerSlug, providerMessageId: result.providerMessageId, sentAt: new Date(), secretJson: null, lastError: null },
      });
    } catch (error) {
      const attempts = notification.attempts + 1;
      await prisma.notification.updateMany({
        where: { id: notification.id, status: 'SENDING' },
        data: {
          status: attempts >= 5 ? 'FAILED' : 'PENDING',
          attempts,
          lastError: error instanceof Error ? error.message : String(error),
          providerSlug,
          nextAttemptAt: new Date(Date.now() + retryMinutes[Math.min(attempts - 1, 4)] * 60_000),
          ...(attempts >= 5 ? { secretJson: null } : {}),
        },
      });
    }
  }
  return claimed.length;
}
