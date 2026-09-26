import { randomUUID } from 'node:crypto';
import { prisma } from '@/config/database';
import { PasswordUtils } from '@/utils/password';
import { EmailVerificationService } from '@/services/email-verification.service';

export class StaffManagementError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

const selectAdmin = {
  id: true,
  email: true,
  username: true,
  avatar: true,
  role: true,
  isActive: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class StaffManagementService {
  static async listStaff(page = 1, limit = 20, filters?: { search?: string }) {
    const where = {
      role: 'ADMIN',
      ...(filters?.search ? {
        OR: [
          { email: { contains: filters.search, mode: 'insensitive' as const } },
          { username: { contains: filters.search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };
    const [items, total, settings] = await Promise.all([
      prisma.user.findMany({ where, select: selectAdmin, orderBy: { createdAt: 'asc' }, skip: (page - 1) * limit, take: limit }),
      prisma.user.count({ where }),
      prisma.systemSettings.findUnique({ where: { id: 'system' }, select: { installedBy: true } }),
    ]);
    return {
      items: items.map((user) => ({ ...user, isInstallAdmin: user.id === settings?.installedBy })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async getStaffByUserId(userId: string) {
    const [user, settings] = await Promise.all([
      prisma.user.findFirst({ where: { id: userId, role: 'ADMIN' }, select: selectAdmin }),
      prisma.systemSettings.findUnique({ where: { id: 'system' }, select: { installedBy: true } }),
    ]);
    return user ? { ...user, isInstallAdmin: user.id === settings?.installedBy } : null;
  }

  static async getStaffAuditLogs(userId: string, page = 1, limit = 20) {
    const where = { staffUserId: userId };
    const [items, total] = await Promise.all([
      prisma.adminStaffAuditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.adminStaffAuditLog.count({ where }),
    ]);
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  static async createStaff(actorUserId: string, input: { email: string; username: string }) {
    const email = input.email.trim().toLowerCase();
    const username = input.username.trim();
    if (!email || !username) throw new StaffManagementError('Email and username are required', 'VALIDATION_ERROR', 400);
    const password = await PasswordUtils.hash(randomUUID());
    try {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email, username, password, role: 'ADMIN', isActive: false, emailVerified: false },
          select: selectAdmin,
        });
        await EmailVerificationService.createStaffInvitation(tx, user.id, user.email, user.username);
        await tx.adminStaffAuditLog.create({
          data: { staffUserId: user.id, staffEmail: user.email, staffUsername: user.username, actorUserId, action: 'ADMIN_INVITED' },
        });
        return { ...user, isInstallAdmin: false };
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        throw new StaffManagementError('Email already exists', 'CONFLICT', 409);
      }
      throw error;
    }
  }

  static async removeStaff(actorUserId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      if (actorUserId === userId) {
        throw new StaffManagementError('Cannot remove yourself', 'SELF_REMOVAL_FORBIDDEN', 409);
      }
      const settings = await tx.systemSettings.findUnique({ where: { id: 'system' }, select: { installedBy: true } });
      if (settings?.installedBy === userId) {
        throw new StaffManagementError('Cannot remove the install admin', 'INSTALL_ADMIN_PROTECTED', 409);
      }
      const user = await tx.user.findFirst({ where: { id: userId, role: 'ADMIN' }, select: selectAdmin });
      if (!user) throw new StaffManagementError('Administrator not found', 'NOT_FOUND', 404);
      await tx.user.update({
        where: { id: userId },
        data: { isActive: false, sessionVersion: { increment: 1 } },
      });
      await tx.adminStaffAuditLog.create({
        data: { staffUserId: user.id, staffEmail: user.email, staffUsername: user.username, actorUserId, action: 'ADMIN_REMOVED' },
      });
      return { userId, removed: true };
    });
  }

  static async resendStaffInvite(userId: string) {
    const user = await prisma.user.findFirst({ where: { id: userId, role: 'ADMIN', emailVerified: false } });
    if (!user) throw new StaffManagementError('Invitation not available', 'INVITE_NOT_AVAILABLE', 409);
    const result = await EmailVerificationService.sendStaffInvitationEmail(user.id, user.email, user.username);
    if (!result.success) throw new StaffManagementError('Failed to queue invitation', 'INVITE_QUEUE_FAILED', 500);
    return { userId, queued: true };
  }
}
