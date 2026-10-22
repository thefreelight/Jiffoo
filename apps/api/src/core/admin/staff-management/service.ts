import { randomUUID } from 'node:crypto';
import { ApiError, type ErrorCode } from '@/utils/api-errors';
import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { PasswordUtils } from '@/utils/password';
import { EmailVerificationService } from '@/core/auth/email-verification.service';
import { AuthIdentityService } from '@/core/auth/identity-service';

export class StaffManagementError extends ApiError {
  constructor(_message: string, code: ErrorCode, _statusCode: number) { super(code); }
}
export interface StaffFilter { search?: string; status?: 'all' | 'active' | 'invited' | 'removed' }
const selectAdmin = {
  id: true, email: true, username: true, avatar: true, isActive: true, emailVerified: true,
  removedAt: true, createdAt: true, updatedAt: true,
  authTokens: { where: { purpose: 'STAFF_INVITE' as const, consumedAt: null }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] as Prisma.AuthTokenOrderByWithRelationInput[], take: 1, select: { expiresAt: true } },
} as const;
function statusWhere(status?: StaffFilter['status']): Prisma.UserWhereInput {
  return status === 'removed' ? { removedAt: { not: null } } : status === 'active' ? { removedAt: null, isActive: true } : status === 'invited' ? { removedAt: null, isActive: false } : {};
}
function staffWhere(filter: StaffFilter, ignoreStatus = false): Prisma.UserWhereInput {
  const search = filter.search?.trim();
  return { role: 'ADMIN', ...(ignoreStatus ? {} : statusWhere(filter.status)), ...(search ? { OR: [
    { email: { contains: search, mode: 'insensitive' } }, { username: { contains: search, mode: 'insensitive' } },
  ] } : {}) };
}
function project(user: Prisma.UserGetPayload<{ select: typeof selectAdmin }>, installedBy?: string | null) {
  const { authTokens, ...account } = user;
  return { ...account, status: user.removedAt ? 'removed' : user.isActive ? 'active' : 'invited',
    removedAt: user.removedAt?.toISOString() ?? null, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString(),
    inviteExpiresAt: authTokens[0]?.expiresAt.toISOString() ?? null, isInstallAdmin: user.id === installedBy };
}
async function audit(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], actorUserId: string, user: { id: string; email: string; username: string }, action: string, reinvite = false) {
  const actor = await tx.user.findUniqueOrThrow({ where: { id: actorUserId }, select: { email: true, username: true } });
  await tx.adminStaffAuditLog.create({ data: { staffUserId: user.id, staffEmail: user.email, staffUsername: user.username,
    actorUserId, actorEmail: actor.email, actorUsername: actor.username, action, ...(reinvite ? { metadata: { reinvite: true } } : {}) } });
}
export class StaffManagementService {
  static async listStaff(page = 1, limit = 20, filter: StaffFilter = {}) {
    const where = staffWhere(filter), base = staffWhere(filter, true);
    const [items, total, all, active, invited, removed, settings] = await prisma.$transaction([
      prisma.user.findMany({ where, select: selectAdmin, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
      prisma.user.count({ where }), prisma.user.count({ where: base }),
      prisma.user.count({ where: { ...base, ...statusWhere('active') } }), prisma.user.count({ where: { ...base, ...statusWhere('invited') } }),
      prisma.user.count({ where: { ...base, ...statusWhere('removed') } }),
      prisma.systemSettings.findUnique({ where: { id: 'system' }, select: { installedBy: true } }),
    ], { isolationLevel: 'RepeatableRead' });
    return { items: items.map(user => project(user, settings?.installedBy)), page, limit, total, totalPages: Math.ceil(total / limit), statusCounts: { all, active, invited, removed } };
  }
  static async getStaffByUserId(userId: string) {
    const [user, settings] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId, role: 'ADMIN' }, select: selectAdmin }),
      prisma.systemSettings.findUnique({ where: { id: 'system' }, select: { installedBy: true } }),
    ]);
    return user ? project(user, settings?.installedBy) : null;
  }
  static async neighbors(userId: string, filter: StaffFilter) {
    const anchor = await prisma.user.findUnique({ where: { id: userId, role: 'ADMIN' }, select: { id: true, createdAt: true } });
    if (!anchor) throw new ApiError('NOT_FOUND');
    const where = staffWhere(filter);
    const side = (before: boolean): Prisma.UserWhereInput => ({ OR: [
      { createdAt: { [before ? 'lt' : 'gt']: anchor.createdAt } },
      { createdAt: anchor.createdAt, id: { [before ? 'lt' : 'gt']: anchor.id } },
    ] });
    const [total, matched, preceding, previous, next] = await prisma.$transaction([
      prisma.user.count({ where }), prisma.user.count({ where: { AND: [where, { id: userId }] } }),
      prisma.user.count({ where: { AND: [where, side(true)] } }),
      prisma.user.findFirst({ where: { AND: [where, side(true)] }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true } }),
      prisma.user.findFirst({ where: { AND: [where, side(false)] }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true } }),
    ], { isolationLevel: 'RepeatableRead' });
    return { position: matched ? preceding + 1 : null, total, previousId: matched ? previous?.id ?? null : null, nextId: matched ? next?.id ?? null : null };
  }
  static async getStaffAuditLogs(userId: string, page = 1, limit = 20) {
    if (!await prisma.user.findUnique({ where: { id: userId, role: 'ADMIN' }, select: { id: true } })) throw new ApiError('NOT_FOUND');
    const where = { staffUserId: userId };
    const [items, total] = await Promise.all([
      prisma.adminStaffAuditLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
      prisma.adminStaffAuditLog.count({ where }),
    ]);
    const actorIds = [...new Set(items.flatMap(item => item.actorUserId ? [item.actorUserId] : []))];
    const actors = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true, username: true } });
    const byId = new Map(actors.map(actor => [actor.id, actor]));
    return { items: items.map(item => ({ ...item, actorEmail: item.actorEmail ?? byId.get(item.actorUserId ?? '')?.email ?? null,
      actorUsername: item.actorUsername ?? byId.get(item.actorUserId ?? '')?.username ?? null })), page, limit, total, totalPages: Math.ceil(total / limit) };
  }
  static async createStaff(actorUserId: string, input: { email: string; username: string }) {
    const email = input.email.trim().toLowerCase(), username = input.username.trim();
    if (!email || !username) throw new ApiError('VALIDATION_ERROR');
    const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { role: true, removedAt: true } });
    if (existing) throw new ApiError(existing.role === 'USER' ? 'STAFF_EMAIL_IS_CUSTOMER' : existing.removedAt ? 'STAFF_EMAIL_REMOVED_ADMIN' : 'EMAIL_TAKEN');
    const password = await PasswordUtils.hash(randomUUID());
    try {
      return await prisma.$transaction(async tx => {
        const user = await AuthIdentityService.createStaff(tx, { email, username, password });
        await EmailVerificationService.createStaffInvitation(tx, user.id, user.email, user.username);
        await audit(tx, actorUserId, user, 'ADMIN_INVITED');
        return project(await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: selectAdmin }));
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && String(error.meta?.target).includes('email')) throw new ApiError('EMAIL_TAKEN');
      throw error;
    }
  }
  static async removeStaff(actorUserId: string, userId: string) {
    return prisma.$transaction(async tx => {
      if (actorUserId === userId) throw new ApiError('SELF_REMOVAL_FORBIDDEN');
      const settings = await tx.systemSettings.findUnique({ where: { id: 'system' }, select: { installedBy: true } });
      if (settings?.installedBy === userId) throw new ApiError('INSTALL_ADMIN_PROTECTED');
      await tx.$queryRaw(Prisma.sql`SELECT id FROM public.users WHERE id = ${userId} FOR UPDATE`);
      const user = await tx.user.findUnique({ where: { id: userId, role: 'ADMIN' } });
      if (!user) throw new ApiError('NOT_FOUND');
      if (user.removedAt) throw new ApiError('INVITE_NOT_AVAILABLE');
      const now = new Date();
      await AuthIdentityService.removeStaff(tx, userId, now);
      await AuthIdentityService.revokeStaffInvites(tx, userId, now);
      await audit(tx, actorUserId, user, 'ADMIN_REMOVED');
      return { userId, removed: true };
    });
  }
  static async reinviteStaff(actorUserId: string, userId: string) {
    const password = await PasswordUtils.hash(randomUUID());
    return prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM public.users WHERE id = ${userId} FOR UPDATE`);
      const user = await tx.user.findUnique({ where: { id: userId, role: 'ADMIN' } });
      if (!user) throw new ApiError('NOT_FOUND');
      if (!user.removedAt) throw new ApiError('INVITE_NOT_AVAILABLE');
      await AuthIdentityService.reinviteStaff(tx, userId, password);
      await EmailVerificationService.createStaffInvitation(tx, user.id, user.email, user.username);
      await audit(tx, actorUserId, user, 'ADMIN_INVITED', true);
      return project(await tx.user.findUniqueOrThrow({ where: { id: userId }, select: selectAdmin }));
    });
  }
  static async resendStaffInvite(userId: string) {
    await prisma.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM public.users WHERE id = ${userId} FOR UPDATE`);
      const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true, username: true, role: true, removedAt: true, isActive: true } });
      if (!user || user.role !== 'ADMIN' || user.removedAt || user.isActive) throw new ApiError('INVITE_NOT_AVAILABLE');
      try {
        await EmailVerificationService.createStaffInvitation(tx, userId, user.email, user.username);
      } catch {
        throw new ApiError('INVITE_QUEUE_FAILED');
      }
    });
    return { userId, queued: true };
  }
}
