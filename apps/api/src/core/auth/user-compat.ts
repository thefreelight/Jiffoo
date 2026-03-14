import { prisma } from '@/config/database';
import { isMissingDatabaseObjectError } from '@/utils/prisma-errors';

const authUserBaseSelect = {
  id: true,
  email: true,
  username: true,
  password: true,
  role: true,
  isActive: true,
  avatar: true,
} as const;

const authIdentityBaseSelect = {
  id: true,
  email: true,
  username: true,
  role: true,
  isActive: true,
  avatar: true,
} as const;

export const authUserSelect = {
  ...authUserBaseSelect,
  emailVerified: true,
} as const;

const legacyAuthUserSelect = authUserBaseSelect;

const authIdentitySelect = {
  ...authIdentityBaseSelect,
  emailVerified: true,
} as const;

const legacyAuthIdentitySelect = authIdentityBaseSelect;

type LegacyAuthUser = {
  id: string;
  email: string;
  username: string;
  password: string;
  role: string;
  isActive: boolean;
  avatar: string | null;
  emailVerified?: boolean;
};

type LegacyAuthIdentity = {
  id: string;
  email: string;
  username: string;
  role: string;
  isActive: boolean;
  avatar: string | null;
  emailVerified?: boolean;
};

type AuthUser = Omit<LegacyAuthUser, 'emailVerified'> & {
  emailVerified: boolean;
};

type AuthIdentity = Omit<LegacyAuthIdentity, 'emailVerified'> & {
  emailVerified: boolean;
};

type RegisterAuthUserInput = {
  email: string;
  username: string;
  password: string;
  role: string;
};

let emailVerifiedColumnAvailable: boolean | null = null;

function isMissingEmailVerifiedColumn(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return isMissingDatabaseObjectError(error) && message.includes('emailverified');
}

function normalizeEmailVerified<T extends { emailVerified?: boolean }>(
  user: T | null
): (Omit<T, 'emailVerified'> & { emailVerified: boolean }) | null {
  if (!user) return null;

  return {
    ...user,
    emailVerified: typeof user.emailVerified === 'boolean' ? user.emailVerified : true,
  };
}

async function withEmailVerifiedCompatibility<T>(
  primaryQuery: () => Promise<T>,
  legacyQuery: () => Promise<T>
): Promise<T> {
  if (emailVerifiedColumnAvailable === false) {
    return legacyQuery();
  }

  try {
    const result = await primaryQuery();
    emailVerifiedColumnAvailable = true;
    return result;
  } catch (error) {
    if (!isMissingEmailVerifiedColumn(error)) {
      throw error;
    }

    emailVerifiedColumnAvailable = false;
    return legacyQuery();
  }
}

export async function findAuthUserByEmail(email: string): Promise<AuthUser | null> {
  const user = await withEmailVerifiedCompatibility(
    () => prisma.user.findUnique({ where: { email }, select: authUserSelect }),
    () => prisma.user.findUnique({ where: { email }, select: legacyAuthUserSelect })
  );

  return normalizeEmailVerified(user as LegacyAuthUser | null) as AuthUser | null;
}

export async function findAuthUserById(userId: string): Promise<AuthUser | null> {
  const user = await withEmailVerifiedCompatibility(
    () => prisma.user.findUnique({ where: { id: userId }, select: authUserSelect }),
    () => prisma.user.findUnique({ where: { id: userId }, select: legacyAuthUserSelect })
  );

  return normalizeEmailVerified(user as LegacyAuthUser | null) as AuthUser | null;
}

export async function findAuthIdentityById(userId: string): Promise<AuthIdentity | null> {
  const user = await withEmailVerifiedCompatibility(
    () => prisma.user.findUnique({ where: { id: userId }, select: authIdentitySelect }),
    () => prisma.user.findUnique({ where: { id: userId }, select: legacyAuthIdentitySelect })
  );

  return normalizeEmailVerified(user as LegacyAuthIdentity | null) as AuthIdentity | null;
}

export async function createAuthUser(data: RegisterAuthUserInput): Promise<AuthUser> {
  const user = await withEmailVerifiedCompatibility(
    () =>
      prisma.user.create({
        data: {
          ...data,
          emailVerified: false,
        },
        select: authUserSelect,
      }),
    () =>
      prisma.user.create({
        data,
        select: legacyAuthUserSelect,
      })
  );

  return normalizeEmailVerified(user as LegacyAuthUser)! as AuthUser;
}

export function resetAuthCompatibilityCache() {
  emailVerifiedColumnAvailable = null;
}
