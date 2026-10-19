import type { FastifyInstance } from 'fastify';
import { listAuditRecords, auditRecordFilters } from './records';
import { prisma } from '@/config/database';
import { sendError, sendSuccess } from '@/utils/response';
import { filtersSchema, pageSchema, querySchema, responses, strictQueryValidator } from './schemas';

type Query = {
  actorId?: string; action?: string; targetType?: string; from?: string; to?: string;
  page?: number; limit?: number;
  category?: string; sort?: string;
};
const actorFields = { id: true, email: true, username: true, isActive: true } as const;
const metadata = { tags: ['admin-audit-events'], security: [{ bearerAuth: [] }] };

export async function adminAuditEventRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: Query }>('/', {
    validatorCompiler: strictQueryValidator,
    schema: { ...metadata, querystring: querySchema, response: responses(pageSchema) },
  }, async (request, reply) => {
    const { actorId, action, targetType, from, to, category, sort, page = 1, limit = 20 } = request.query;
    if (from && to && new Date(from) > new Date(to)) {
      return sendError(reply, 400, 'INVALID_TIME_RANGE', 'From must not be later than to');
    }
    const { records, total } = await listAuditRecords({ actorId, action, targetType, from, to, category, sort, page, limit });
    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(records.map((item) => item.actorId))] } }, select: actorFields,
    });
    const actors = new Map(users.map((user) => [user.id, user]));
    const ids = (type: string) => records.filter(record => record.targetType === type).map(record => record.targetId);
    const [payments, plugins, themes, accounts] = await Promise.all([
      prisma.payment.findMany({ where: { id: { in: ids('payment') } }, select: { id: true, orderId: true, amount: true, currency: true, attemptNumber: true } }),
      prisma.pluginInstall.findMany({ where: { slug: { in: ids('plugin') }, deletedAt: null }, select: { slug: true, name: true } }),
      prisma.theme.findMany({ where: { slug: { in: ids('theme') } }, select: { slug: true, name: true, target: true } }),
      prisma.user.findMany({ where: { id: { in: [...ids('customer'), ...ids('staff'), ...ids('user')] } }, select: { id: true, username: true, email: true, role: true } }),
    ]);
    const orders = await prisma.order.findMany({ where: { id: { in: [...ids('order'), ...payments.map(payment => payment.orderId)] } }, select: { id: true, orderNumber: true } });
    const existingOrders = new Map(orders.map(order => [order.id, order.orderNumber]));
    const items = records.map(({ actorId: id, actorSnapshot, targetLabel: storedTargetLabel, ...record }) => {
      const summary = record.summary && typeof record.summary === 'object' && !Array.isArray(record.summary) ? record.summary : {};
      const targetLabel = record.targetType === 'customer' && typeof summary.email === 'string'
        ? [typeof summary.username === 'string' ? summary.username : '', summary.email].filter(Boolean).join(' · ')
        : storedTargetLabel;
      const currentActor = actors.get(id);
      const payment = record.targetType === 'payment' ? payments.find(row => row.id === record.targetId) : undefined;
      const plugin = record.targetType === 'plugin' ? plugins.find(row => row.slug === record.targetId) : undefined;
      const theme = record.targetType === 'theme' ? themes.find(row => row.slug === record.targetId) : undefined;
      const account = accounts.find(row => row.id === record.targetId && (record.targetType === 'staff' ? row.role === 'ADMIN' : ['customer', 'user'].includes(record.targetType) && row.role === 'USER'));
      const orderId = payment?.orderId ?? (record.targetType === 'order' ? record.targetId : undefined);
      const context = orderId && existingOrders.has(orderId) ? { path: `/orders/${encodeURIComponent(orderId)}`, label: existingOrders.get(orderId)! }
        : plugin ? { path: `/plugins/${encodeURIComponent(plugin.slug)}`, label: plugin.name }
        : theme && ['shop', 'admin'].includes(theme.target) ? { path: `/themes/${theme.target}/${encodeURIComponent(theme.slug)}`, label: theme.name }
        : account ? { path: `/${account.role === 'ADMIN' ? 'staff' : 'customers'}/${encodeURIComponent(account.id)}`, label: targetLabel || account.username || account.email }
        : undefined;
      return { ...record, actorId: id, actor: actorSnapshot ? { ...actorSnapshot, email: actorSnapshot.email || currentActor?.email || '', username: actorSnapshot.username || currentActor?.username || '', isActive: currentActor?.isActive ?? false } : currentActor ?? null, ...(targetLabel ? { targetLabel } : {}), ...(context ? { context } : {}),
        ...(payment ? { paymentContext: { amount: payment.amount.toFixed(2), currency: payment.currency, attemptNumber: payment.attemptNumber } } : {}) };
    });
    return sendSuccess(reply, { items, page, limit, total, totalPages: Math.ceil(total / limit) });
  });

  fastify.get('/filters', {
    validatorCompiler: strictQueryValidator,
    schema: {
      ...metadata, querystring: { type: 'object', properties: {}, additionalProperties: false },
      response: responses(filtersSchema),
    },
  }, async (_request, reply) => {
    return sendSuccess(reply, await auditRecordFilters());
  });
}
