import type { Prisma } from '@prisma/client';

/**
 * Auth Identity Service — the public write API of the auth module for the
 * `users` and `auth_tokens` tables.
 *
 * The auth module owns identity. Every other module that has to create,
 * update or revoke an identity row goes through this service instead of
 * writing the tables itself (see the module boundary audit).
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
      data: { isActive: false },
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
}
