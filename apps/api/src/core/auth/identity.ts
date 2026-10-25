import { prisma } from '@/config/database';

export async function findLockedRequestAdmin(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], session: Readonly<{ userId: string; sessionVersion: number }>): Promise<string | null> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM public.users WHERE id = ${session.userId} AND role = 'ADMIN' AND "isActive" AND "removedAt" IS NULL AND "sessionVersion" = ${session.sessionVersion} FOR SHARE`;
  return rows[0]?.id ?? null;
}

export const authUserSelect = {
  id: true, email: true, username: true, password: true, role: true,
  isActive: true, removedAt: true, avatar: true, sessionVersion: true, emailVerified: true,
} as const;
const authIdentitySelect = { ...authUserSelect, password: false } as const;

export const findAuthUserByEmail = (email: string) => prisma.user.findUnique({ where: { email }, select: authUserSelect });
export const findAuthUserById = (id: string) => prisma.user.findUnique({ where: { id }, select: authUserSelect });
export const findAuthIdentityById = (id: string) => prisma.user.findUnique({ where: { id }, select: authIdentitySelect });
export async function findAuthUserByIdentifier(identifier: string, role: 'ADMIN' | 'USER') {
  const normalized = identifier.trim();
  if (normalized.includes('@')) return findAuthUserByEmail(normalized);
  const users = await prisma.user.findMany({ where: { username: normalized, role }, take: 2, select: authUserSelect });
  return users.length === 1 ? users[0] : null;
}
export const createAuthUser = (data: { email: string; username: string; password: string; role: string; emailVerified?: boolean }) =>
  prisma.user.create({ data: { ...data, emailVerified: data.emailVerified ?? false }, select: authUserSelect });
