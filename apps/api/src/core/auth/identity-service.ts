import type { Prisma } from '@prisma/client';

/**
 * Auth Identity Service — the public API of the auth module for the
 * `users` and `auth_tokens` tables.
 *
 * The auth module owns identity. Every other module that has to create,
 * update or revoke an identity row goes through this service instead of
 * writing the tables itself (see the module boundary audit). A module that
 * only needs to read the identity of an account uses the read projection
 * below, so it never reads the `users` table itself.
 *
 * The transaction parameter is deliberately structural: a plain Prisma
 * transaction client satisfies `AuthIdentityTx`, so a caller never has to
 * cast the extended API client to make the call.
 */
export type AuthIdentityTx = {
  user: {
    create(args: any): Promise<any>;
    update(args: any): Promise<any>;
    delete(args: any): Promise<any>;
  };
  authToken: {
    updateMany(args: any): Promise<{ count: number }>;
  };
};

/** The profile fields an account may change. */
export type AuthProfileUpdate = {
  username?: string;
  avatar?: string | null;
  locale?: string | null;
};

/** The customer fields the admin user module may change. */
export type AuthCustomerUpdate = {
  username?: string;
  isActive?: boolean;
};

/** The credential fields of a new identity. The password is already hashed. */
export type AuthIdentityCredentials = {
  email: string;
  password: string;
  username: string;
};

/**
 * The identity fields another module may read from an account.
 *
 * This is the neutral projection of an account: it carries the fields a
 * consumer needs and never the stored user row, so the auth module keeps the
 * ownership of the `users` table.
 */
export type AuthIdentityProfile = {
  /** The address of the account. */
  email: string;
  /** The locale of the account, or null when the account has none. */
  locale: string | null;
};

/**
 * The client surface the identity projection reads through.
 *
 * The caller passes its own client or transaction client, so the read stays
 * inside the caller's transaction.
 */
export type AuthIdentityReadTx = {
  user: {
    findUnique(args: any): Promise<any>;
  };
};

/**
 * The client surface the identity projection reads through when the account
 * has to exist.
 */
export type AuthIdentityRequireTx = {
  user: {
    findUniqueOrThrow(args: any): Promise<any>;
  };
};

export class AuthIdentityService {
  /**
   * Update the profile of an account.
   */
  static async updateProfile<const S extends Prisma.UserSelect>(
    tx: AuthIdentityTx,
    userId: string,
    data: AuthProfileUpdate,
    select: S,
  ): Promise<Prisma.UserGetPayload<{ select: S }>> {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { ...data, updatedAt: new Date() },
      select,
    });
    return updated as Prisma.UserGetPayload<{ select: S }>;
  }

  /**
   * Remove the avatar of an account.
   */
  static async removeAvatar<const S extends Prisma.UserSelect>(
    tx: AuthIdentityTx,
    userId: string,
    select: S,
  ): Promise<Prisma.UserGetPayload<{ select: S }>> {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { avatar: null },
      select,
    });
    return updated as Prisma.UserGetPayload<{ select: S }>;
  }

  /**
   * Change the email of an account. The new address is unverified again.
   */
  static async changeEmail<const S extends Prisma.UserSelect>(
    tx: AuthIdentityTx,
    userId: string,
    email: string,
    select: S,
  ): Promise<Prisma.UserGetPayload<{ select: S }>> {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        email,
        emailVerified: false,
        updatedAt: new Date(),
      },
      select,
    });
    return updated as Prisma.UserGetPayload<{ select: S }>;
  }

  /**
   * Deactivate a customer account. Administrator accounts are never touched.
   */
  static async deactivateCustomer(tx: AuthIdentityTx, userId: string): Promise<void> {
    await tx.user.update({
      where: { id: userId, role: 'USER' },
      data: { isActive: false, sessionVersion: { increment: 1 } },
    });
  }

  /**
   * Create a customer account.
   */
  static async createCustomer<const S extends Prisma.UserSelect>(
    tx: AuthIdentityTx,
    data: AuthIdentityCredentials,
    select: S,
  ): Promise<Prisma.UserGetPayload<{ select: S }>> {
    const created = await tx.user.create({
      data: {
        email: data.email,
        password: data.password,
        username: data.username,
        role: 'USER',
      },
      select,
    });
    return created as Prisma.UserGetPayload<{ select: S }>;
  }

  /**
   * Update a customer account. Administrator accounts are never touched.
   */
  static async updateCustomer<const S extends Prisma.UserSelect>(
    tx: AuthIdentityTx,
    userId: string,
    data: AuthCustomerUpdate,
    select: S,
  ): Promise<Prisma.UserGetPayload<{ select: S }>> {
    const updated = await tx.user.update({
      where: { id: userId, role: 'USER' },
      data: {
        ...(data.username !== undefined ? { username: data.username } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.isActive === false ? { sessionVersion: { increment: 1 } } : {}),
      },
      select,
    });
    return updated as Prisma.UserGetPayload<{ select: S }>;
  }

  /**
   * Delete a customer account. Administrator accounts are never touched.
   */
  static async deleteCustomer(tx: AuthIdentityTx, userId: string): Promise<void> {
    await tx.user.delete({
      where: { id: userId, role: 'USER' },
    });
  }

  /**
   * Create an invited staff account. The account stays inactive until the
   * invitation is accepted.
   */
  static async createStaff(
    tx: AuthIdentityTx,
    data: AuthIdentityCredentials,
  ): Promise<Prisma.UserGetPayload<{}>> {
    const created = await tx.user.create({
      data: {
        email: data.email,
        username: data.username,
        password: data.password,
        role: 'ADMIN',
        isActive: false,
        emailVerified: false,
      },
    });
    return created as Prisma.UserGetPayload<{}>;
  }

  /**
   * Remove a staff account. The removal ends every live session of that
   * account.
   */
  static async removeStaff(tx: AuthIdentityTx, userId: string, now: Date = new Date()): Promise<void> {
    await tx.user.update({
      where: { id: userId },
      data: { removedAt: now, isActive: false, sessionVersion: { increment: 1 } },
    });
  }

  /**
   * Re-invite a removed staff account. The account stays inactive until the
   * new invitation is accepted.
   */
  static async reinviteStaff(tx: AuthIdentityTx, userId: string, password: string): Promise<void> {
    await tx.user.update({
      where: { id: userId },
      data: {
        removedAt: null,
        isActive: false,
        emailVerified: false,
        password,
        sessionVersion: { increment: 1 },
      },
    });
  }

  /**
   * Revoke every open staff invitation of an account.
   */
  static async revokeStaffInvites(tx: AuthIdentityTx, userId: string, now: Date = new Date()): Promise<void> {
    await tx.authToken.updateMany({
      where: { userId, purpose: 'STAFF_INVITE', consumedAt: null },
      data: { consumedAt: now },
    });
  }

  /**
   * Create the first administrator of a fresh installation.
   */
  static async createBootstrapAdmin(
    tx: AuthIdentityTx,
    data: AuthIdentityCredentials,
  ): Promise<Prisma.UserGetPayload<{}>> {
    const created = await tx.user.create({
      data: {
        email: data.email,
        username: data.username,
        password: data.password,
        role: 'ADMIN',
        isActive: true,
      },
    });
    return created as Prisma.UserGetPayload<{}>;
  }

  /**
   * The identity projection of an account.
   *
   * The auth module owns the `users` table, so a module that needs the
   * address or the locale of an account reads them here instead of reading
   * the table itself. The projection names the fields a consumer needs and
   * never the stored row.
   *
   * @param client the reader of the `users` table (a Prisma client or a
   *   transaction client of the caller)
   * @param userId the account to read
   * @returns the projection, or null when the account does not exist
   */
  static async readProfile(client: AuthIdentityReadTx, userId: string): Promise<AuthIdentityProfile | null> {
    const user = await client.user.findUnique({ where: { id: userId }, select: { email: true, locale: true } });
    if (!user) return null;
    return { email: user.email, locale: user.locale ?? null };
  }

  /**
   * The identity projection of an account that has to exist.
   *
   * The read fails exactly like a direct `findUniqueOrThrow` read fails, so
   * a caller that requires the account keeps its current behaviour.
   */
  static async requireProfile(client: AuthIdentityRequireTx, userId: string): Promise<AuthIdentityProfile> {
    const user = await client.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, locale: true } });
    return { email: user.email, locale: user.locale ?? null };
  }
}
