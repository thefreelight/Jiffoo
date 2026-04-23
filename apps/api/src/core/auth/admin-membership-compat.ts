import { prisma } from '@/config/database';
import { isMissingDatabaseObjectError } from '@/utils/prisma-errors';
import { resolveAdminAccess, type ResolvedAdminAccess } from './admin-access';

const adminMembershipSelect = {
  id: true,
  userId: true,
  role: true,
  status: true,
  isOwner: true,
  extraPermissions: true,
  revokedPermissions: true,
  createdByUserId: true,
  updatedByUserId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type AdminMembershipRecord = {
  id: string;
  userId: string;
  role: string;
  status: string;
  isOwner: boolean;
  extraPermissions: unknown;
  revokedPermissions: unknown;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

let adminMembershipTableAvailable: boolean | null = null;

function isMissingAdminMembershipTable(error: unknown): boolean {
  return isMissingDatabaseObjectError(error, ['admin_memberships', 'AdminMembership']);
}

async function withAdminMembershipCompatibility<T>(
  query: () => Promise<T>,
  fallback: () => Promise<T>
): Promise<T> {
  if (adminMembershipTableAvailable === false) {
    return fallback();
  }

  try {
    const result = await query();
    adminMembershipTableAvailable = true;
    return result;
  } catch (error) {
    if (!isMissingAdminMembershipTable(error)) {
      throw error;
    }

    adminMembershipTableAvailable = false;
    return fallback();
  }
}

export async function findAdminMembershipByUserId(userId: string): Promise<AdminMembershipRecord | null> {
  return withAdminMembershipCompatibility(
    () => prisma.adminMembership.findUnique({ where: { userId }, select: adminMembershipSelect }) as Promise<AdminMembershipRecord | null>,
    async () => null
  );
}

export async function findResolvedAdminAccessForUser(
  userId: string,
  legacyRole?: string | null
): Promise<(ResolvedAdminAccess & { membershipId: string | null }) | null> {
  const membership = await findAdminMembershipByUserId(userId);

  if (membership) {
    const resolved = resolveAdminAccess(membership);
    if (resolved) {
      return {
        membershipId: membership.id,
        ...resolved,
      };
    }
  }

  const legacy = resolveAdminAccess({ role: legacyRole });
  if (!legacy) {
    return null;
  }

  return {
    membershipId: null,
    ...legacy,
  };
}

export function resetAdminMembershipCompatibilityCache() {
  adminMembershipTableAvailable = null;
}
