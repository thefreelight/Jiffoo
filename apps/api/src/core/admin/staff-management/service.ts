import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { PasswordUtils } from '@/utils/password';
import { EmailVerificationService } from '@/services/email-verification.service';
import {
  ADMIN_PERMISSION_GROUPS,
  ADMIN_PERMISSIONS,
  ADMIN_ROLES,
  getDefaultPermissionsForAdminRole,
  type AdminPermission,
  type AdminRole,
} from 'shared';
import {
  normalizeAdminStatus,
  normalizePermissionList,
  resolveAdminAccess,
  resolveAdminRole,
} from '@/core/auth/admin-access';

const KNOWN_ADMIN_PERMISSIONS = Object.values(ADMIN_PERMISSIONS) as AdminPermission[];
const STAFF_MANAGEMENT_PERMISSIONS = new Set<AdminPermission>([
  ADMIN_PERMISSIONS.STAFF_READ,
  ADMIN_PERMISSIONS.STAFF_WRITE,
]);

type StaffActorContext = {
  userId: string;
  permissions: readonly string[];
  isOwner: boolean;
};

type StaffMutationInput = {
  userId?: string;
  email?: string;
  username?: string;
  password?: string;
  role: string;
  status?: string;
  isOwner?: boolean;
  extraPermissions?: unknown;
  revokedPermissions?: unknown;
};

type StaffMembershipWithUser = Awaited<ReturnType<typeof getStaffMembershipByUserId>>;
type StaffAuditLogRecord = Awaited<ReturnType<typeof getStaffAuditLogPage>>['items'][number];

function titleCaseFromKey(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function createStaffError(
  message: string,
  code: string,
  statusCode: number,
): StaffManagementError {
  return new StaffManagementError(message, code, statusCode);
}

function assertKnownAdminRole(role: string): AdminRole {
  const normalized = resolveAdminRole(role);
  if (!normalized) {
    throw createStaffError('Invalid admin role', 'VALIDATION_ERROR', 400);
  }

  return normalized;
}

function normalizePermissionOverrides(
  adminRole: AdminRole,
  extraPermissions: unknown,
  revokedPermissions: unknown,
) {
  const basePermissions = new Set(getDefaultPermissionsForAdminRole(adminRole));
  const normalizedRevoked = normalizePermissionList(revokedPermissions).filter((permission) =>
    basePermissions.has(permission as AdminPermission)
  );
  const revokedSet = new Set(normalizedRevoked);
  const normalizedExtra = normalizePermissionList(extraPermissions).filter((permission) =>
    !basePermissions.has(permission as AdminPermission) && !revokedSet.has(permission)
  );

  return {
    extraPermissions: normalizedExtra,
    revokedPermissions: normalizedRevoked,
  };
}

function assertActorCanManageResolvedAccess(
  actor: StaffActorContext,
  targetAccess: NonNullable<ReturnType<typeof resolveAdminAccess>>,
) {
  if (actor.isOwner) {
    return;
  }

  if (targetAccess.isOwner) {
    throw createStaffError('Only owners can assign owner access', 'FORBIDDEN', 403);
  }

  if (targetAccess.permissions.some((permission) => STAFF_MANAGEMENT_PERMISSIONS.has(permission))) {
    throw createStaffError('Only owners can grant staff management permissions', 'FORBIDDEN', 403);
  }

  const actorPermissions = new Set(actor.permissions);
  for (const permission of targetAccess.permissions) {
    if (!actorPermissions.has(permission)) {
      throw createStaffError(`Cannot assign permission you do not have: ${permission}`, 'FORBIDDEN', 403);
    }
  }
}

function assertActorCanManageExistingMembership(
  actor: StaffActorContext,
  membership: NonNullable<StaffMembershipWithUser>,
) {
  if (actor.isOwner) {
    return;
  }

  const existingAccess = resolveAdminAccess(membership);
  if (!existingAccess) {
    throw createStaffError('Staff membership is invalid', 'INTERNAL_SERVER_ERROR', 500);
  }

  if (existingAccess.isOwner) {
    throw createStaffError('Only owners can manage owner memberships', 'FORBIDDEN', 403);
  }

  if (existingAccess.permissions.some((permission) => STAFF_MANAGEMENT_PERMISSIONS.has(permission))) {
    throw createStaffError('Only owners can manage staff managers', 'FORBIDDEN', 403);
  }

  const actorPermissions = new Set(actor.permissions);
  for (const permission of existingAccess.permissions) {
    if (!actorPermissions.has(permission)) {
      throw createStaffError('Cannot manage staff with broader permissions than your own', 'FORBIDDEN', 403);
    }
  }
}

async function ensureNotRemovingLastOwner(userId: string) {
  const remainingOwners = await prisma.adminMembership.count({
    where: {
      userId: { not: userId },
      isOwner: true,
      status: 'ACTIVE',
    },
  });

  if (remainingOwners === 0) {
    throw createStaffError('At least one active owner must remain', 'LAST_OWNER_REQUIRED', 409);
  }
}

async function getStaffMembershipByUserId(userId: string) {
  return prisma.adminMembership.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          avatar: true,
          role: true,
          isActive: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });
}

async function writeStaffAuditLog(input: {
  staffUserId: string;
  staffEmail: string;
  staffUsername?: string | null;
  actorUserId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  const actorUser = input.actorUserId
    ? await prisma.user.findUnique({
        where: { id: input.actorUserId },
        select: {
          id: true,
          email: true,
          username: true,
        },
      })
    : null;

  await prisma.adminStaffAuditLog.create({
    data: {
      staffUserId: input.staffUserId,
      staffEmail: input.staffEmail,
      staffUsername: input.staffUsername ?? null,
      actorUserId: actorUser?.id ?? input.actorUserId ?? null,
      actorEmail: actorUser?.email ?? null,
      actorUsername: actorUser?.username ?? null,
      action: input.action,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

function serializeStaffAuditLog(log: Awaited<ReturnType<typeof getRawStaffAuditLogs>>[number]) {
  return {
    id: log.id,
    staffUserId: log.staffUserId,
    staffEmail: log.staffEmail,
    staffUsername: log.staffUsername,
    actorUserId: log.actorUserId,
    actorEmail: log.actorEmail,
    actorUsername: log.actorUsername,
    action: log.action,
    metadata: log.metadata,
    createdAt: log.createdAt.toISOString(),
  };
}

async function getRawStaffAuditLogs(staffUserId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  return prisma.adminStaffAuditLog.findMany({
    where: { staffUserId },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });
}

async function getStaffAuditLogPage(staffUserId: string, page = 1, limit = 20) {
  const [logs, total] = await Promise.all([
    getRawStaffAuditLogs(staffUserId, page, limit),
    prisma.adminStaffAuditLog.count({ where: { staffUserId } }),
  ]);

  return {
    items: logs.map(serializeStaffAuditLog),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

function serializeStaffMembership(membership: NonNullable<StaffMembershipWithUser>) {
  const resolvedAccess = resolveAdminAccess(membership);
  if (!resolvedAccess) {
    throw createStaffError('Staff membership is invalid', 'INTERNAL_SERVER_ERROR', 500);
  }

  return {
    membershipId: membership.id,
    userId: membership.user.id,
    email: membership.user.email,
    username: membership.user.username,
    avatar: membership.user.avatar,
    accountRole: membership.user.role,
    accountActive: membership.user.isActive,
    emailVerified: membership.user.emailVerified,
    adminRole: resolvedAccess.role,
    status: resolvedAccess.status,
    isOwner: resolvedAccess.isOwner,
    extraPermissions: resolvedAccess.extraPermissions,
    revokedPermissions: resolvedAccess.revokedPermissions,
    effectivePermissions: resolvedAccess.permissions,
    createdAt: membership.createdAt.toISOString(),
    updatedAt: membership.updatedAt.toISOString(),
    membershipCreatedByUserId: membership.createdByUserId,
    membershipUpdatedByUserId: membership.updatedByUserId,
    accountCreatedAt: membership.user.createdAt.toISOString(),
    accountUpdatedAt: membership.user.updatedAt.toISOString(),
  };
}

export class StaffManagementError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

export class StaffManagementService {
  static getRoleCatalog() {
    return Object.values(ADMIN_ROLES).map((role) => ({
      role,
      label: titleCaseFromKey(role.toLowerCase()),
      permissions: [...getDefaultPermissionsForAdminRole(role)],
    }));
  }

  static getPermissionCatalog() {
    return Object.entries(ADMIN_PERMISSION_GROUPS).map(([groupKey, permissions]) => ({
      group: groupKey,
      label: titleCaseFromKey(groupKey.toLowerCase()),
      permissions: permissions.map((permission) => ({
        key: permission,
        label: titleCaseFromKey(permission),
        description: `Allows ${titleCaseFromKey(permission).toLowerCase()}`,
      })),
    }));
  }

  static async listStaff(page = 1, limit = 20, filters?: {
    search?: string;
    role?: string;
    status?: string;
  }) {
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};

    if (filters?.role) {
      where.role = filters.role;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.search) {
      where.user = {
        OR: [
          { email: { contains: filters.search, mode: 'insensitive' } },
          { username: { contains: filters.search, mode: 'insensitive' } },
        ],
      };
    }

    const [memberships, total] = await Promise.all([
      prisma.adminMembership.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              avatar: true,
              role: true,
              isActive: true,
              emailVerified: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: [
          { isOwner: 'desc' },
          { updatedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      prisma.adminMembership.count({ where }),
    ]);

    return {
      items: memberships.map(serializeStaffMembership),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async getStaffByUserId(userId: string) {
    const membership = await getStaffMembershipByUserId(userId);
    if (!membership) {
      return null;
    }

    return serializeStaffMembership(membership);
  }

  static async getStaffAuditLogs(userId: string, page = 1, limit = 20) {
    return getStaffAuditLogPage(userId, page, limit);
  }

  static async createStaff(actor: StaffActorContext, input: StaffMutationInput) {
    const adminRole = assertKnownAdminRole(input.role);
    const status = normalizeAdminStatus(input.status);
    const { extraPermissions, revokedPermissions } = normalizePermissionOverrides(
      adminRole,
      input.extraPermissions,
      input.revokedPermissions,
    );
    const resolvedAccess = resolveAdminAccess({
      role: adminRole,
      status,
      isOwner: input.isOwner,
      extraPermissions,
      revokedPermissions,
    });

    if (!resolvedAccess) {
      throw createStaffError('Failed to resolve admin access', 'VALIDATION_ERROR', 400);
    }

    assertActorCanManageResolvedAccess(actor, resolvedAccess);

    const normalizedEmail = input.email?.trim().toLowerCase();
    const normalizedUsername = input.username?.trim();

    if (!input.userId && !normalizedEmail) {
      throw createStaffError('email or userId is required', 'VALIDATION_ERROR', 400);
    }

    const existingUser = input.userId
      ? await prisma.user.findUnique({ where: { id: input.userId } })
      : normalizedEmail
        ? await prisma.user.findUnique({ where: { email: normalizedEmail } })
        : null;

    let userId = existingUser?.id;

    if (!existingUser) {
      if (!normalizedEmail || !normalizedUsername) {
        throw createStaffError(
          'email and username are required when creating a new staff account',
          'VALIDATION_ERROR',
          400,
        );
      }

      const temporaryPassword = input.password || `staff-${crypto.randomUUID()}-${Date.now()}`;
      const password = await PasswordUtils.hash(temporaryPassword);
      const createdUser = await prisma.user.create({
        data: {
          email: normalizedEmail,
          username: normalizedUsername,
          password,
          role: 'USER',
          emailVerified: false,
        },
        select: { id: true },
      });
      userId = createdUser.id;
    }

    if (!userId) {
      throw createStaffError('Unable to resolve user account for staff membership', 'INTERNAL_SERVER_ERROR', 500);
    }

    const existingMembership = await prisma.adminMembership.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (existingMembership) {
      throw createStaffError('User already has staff access', 'CONFLICT', 409);
    }

    const membership = await prisma.adminMembership.create({
      data: {
        userId,
        role: resolvedAccess.role,
        status: resolvedAccess.status,
        isOwner: resolvedAccess.isOwner,
        extraPermissions: resolvedAccess.extraPermissions,
        revokedPermissions: resolvedAccess.revokedPermissions,
        createdByUserId: actor.userId,
        updatedByUserId: actor.userId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            avatar: true,
            role: true,
            isActive: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    const serialized = serializeStaffMembership(membership);
    const invitation = serialized.emailVerified
      ? { success: true, skipped: 'already_verified' }
      : await EmailVerificationService.sendStaffInvitationEmail(
          serialized.userId,
          serialized.email,
          serialized.username,
        );

    await writeStaffAuditLog({
      staffUserId: serialized.userId,
      staffEmail: serialized.email,
      staffUsername: serialized.username,
      actorUserId: actor.userId,
      action: 'STAFF_ACCESS_GRANTED',
      metadata: {
        adminRole: serialized.adminRole,
        status: serialized.status,
        isOwner: serialized.isOwner,
        effectivePermissions: serialized.effectivePermissions,
        extraPermissions: serialized.extraPermissions,
        revokedPermissions: serialized.revokedPermissions,
        invitationSent: invitation.success && !('skipped' in invitation),
        invitationSkipped: 'skipped' in invitation ? invitation.skipped : null,
        invitationError: 'error' in invitation ? invitation.error ?? null : null,
      },
    });

    return serialized;
  }

  static async updateStaff(actor: StaffActorContext, userId: string, input: Omit<StaffMutationInput, 'email' | 'username' | 'password' | 'userId'>) {
    const existingMembership = await getStaffMembershipByUserId(userId);
    if (!existingMembership) {
      throw createStaffError('Staff membership not found', 'NOT_FOUND', 404);
    }

    assertActorCanManageExistingMembership(actor, existingMembership);

    const adminRole = assertKnownAdminRole(input.role);
    const status = normalizeAdminStatus(input.status);
    const { extraPermissions, revokedPermissions } = normalizePermissionOverrides(
      adminRole,
      input.extraPermissions,
      input.revokedPermissions,
    );
    const resolvedAccess = resolveAdminAccess({
      role: adminRole,
      status,
      isOwner: input.isOwner,
      extraPermissions,
      revokedPermissions,
    });

    if (!resolvedAccess) {
      throw createStaffError('Failed to resolve admin access', 'VALIDATION_ERROR', 400);
    }

    assertActorCanManageResolvedAccess(actor, resolvedAccess);

    const currentAccess = resolveAdminAccess(existingMembership);
    if (
      currentAccess?.isOwner
      && (!resolvedAccess.isOwner || resolvedAccess.status !== 'ACTIVE')
    ) {
      await ensureNotRemovingLastOwner(userId);
    }

    const previousSerialized = serializeStaffMembership(existingMembership);

    const membership = await prisma.adminMembership.update({
      where: { userId },
      data: {
        role: resolvedAccess.role,
        status: resolvedAccess.status,
        isOwner: resolvedAccess.isOwner,
        extraPermissions: resolvedAccess.extraPermissions,
        revokedPermissions: resolvedAccess.revokedPermissions,
        updatedByUserId: actor.userId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            avatar: true,
            role: true,
            isActive: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    const serialized = serializeStaffMembership(membership);
    await writeStaffAuditLog({
      staffUserId: serialized.userId,
      staffEmail: serialized.email,
      staffUsername: serialized.username,
      actorUserId: actor.userId,
      action: 'STAFF_ACCESS_UPDATED',
      metadata: {
        previous: {
          adminRole: previousSerialized.adminRole,
          status: previousSerialized.status,
          isOwner: previousSerialized.isOwner,
          effectivePermissions: previousSerialized.effectivePermissions,
          extraPermissions: previousSerialized.extraPermissions,
          revokedPermissions: previousSerialized.revokedPermissions,
        },
        next: {
          adminRole: serialized.adminRole,
          status: serialized.status,
          isOwner: serialized.isOwner,
          effectivePermissions: serialized.effectivePermissions,
          extraPermissions: serialized.extraPermissions,
          revokedPermissions: serialized.revokedPermissions,
        },
      },
    });

    return serialized;
  }

  static async removeStaff(actor: StaffActorContext, userId: string) {
    const existingMembership = await getStaffMembershipByUserId(userId);
    if (!existingMembership) {
      throw createStaffError('Staff membership not found', 'NOT_FOUND', 404);
    }

    assertActorCanManageExistingMembership(actor, existingMembership);

    const currentAccess = resolveAdminAccess(existingMembership);
    if (currentAccess?.isOwner) {
      await ensureNotRemovingLastOwner(userId);
    }

    await prisma.adminMembership.delete({
      where: { userId },
    });

    const serialized = serializeStaffMembership(existingMembership);
    await writeStaffAuditLog({
      staffUserId: serialized.userId,
      staffEmail: serialized.email,
      staffUsername: serialized.username,
      actorUserId: actor.userId,
      action: 'STAFF_ACCESS_REMOVED',
      metadata: {
        adminRole: serialized.adminRole,
        status: serialized.status,
        isOwner: serialized.isOwner,
        effectivePermissions: serialized.effectivePermissions,
        extraPermissions: serialized.extraPermissions,
        revokedPermissions: serialized.revokedPermissions,
      },
    });

    return {
      userId,
      removed: true,
    };
  }

  static async resendStaffInvite(actor: StaffActorContext, userId: string) {
    const existingMembership = await getStaffMembershipByUserId(userId);
    if (!existingMembership) {
      throw createStaffError('Staff membership not found', 'NOT_FOUND', 404);
    }

    assertActorCanManageExistingMembership(actor, existingMembership);

    if (existingMembership.user.emailVerified) {
      throw createStaffError('Staff account email is already verified', 'ALREADY_VERIFIED', 409);
    }

    const invitation = await EmailVerificationService.sendStaffInvitationEmail(
      existingMembership.user.id,
      existingMembership.user.email,
      existingMembership.user.username,
    );

    if (!invitation.success) {
      throw createStaffError(invitation.error || 'Failed to send staff invitation', 'INVITE_SEND_FAILED', 502);
    }

    const serialized = serializeStaffMembership(existingMembership);
    await writeStaffAuditLog({
      staffUserId: serialized.userId,
      staffEmail: serialized.email,
      staffUsername: serialized.username,
      actorUserId: actor.userId,
      action: 'STAFF_INVITE_RESENT',
      metadata: {
        adminRole: serialized.adminRole,
        status: serialized.status,
      },
    });

    return {
      userId,
      invited: true,
      invitedAt: new Date().toISOString(),
    };
  }
}
