import type { Prisma } from '@prisma/client';

/**
 * The single write outlet for audit events.
 *
 * Every module writes audit rows through {@link AuditService.write}; no module
 * calls `adminAuditEvent.create` / `adminAuditEvent.upsert` directly.
 */
export type AuditTx = {
  adminAuditEvent: {
    create(args: any): Promise<any>;
    upsert(args: any): Promise<any>;
  };
};

export type AuditEntry = {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  summary?: Prisma.InputJsonValue;
  /** Deterministic id: the row is created when absent and never updated. */
  id?: string;
  /**
   * Insert the row with `id` even when that id is already taken: a duplicate id
   * fails the write instead of being swallowed. Without it the row is created
   * only when absent.
   */
  failOnDuplicateId?: boolean;
};

/**
 * The client surface the staff-audit outlet needs.
 */
export type StaffAuditTx = {
  adminStaffAuditLog: {
    create(args: any): Promise<any>;
  };
};

/**
 * One row of the legacy staff-audit log. The staff log is a second table next
 * to `admin_audit_events`; both are written through this outlet.
 */
export type StaffAuditEntry = {
  staffUserId: string;
  staffEmail: string;
  staffUsername?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorUsername?: string | null;
  action: string;
  metadata?: Prisma.InputJsonValue;
};

export class AuditService {
  /** Write one audit event. With `id` the row is created-if-absent (upsert with an empty
   *  update); without `id` it is a plain create. */
  static async write(tx: AuditTx, entry: AuditEntry): Promise<void> {
    const { id, actorId, action, targetType, targetId, summary } = entry;
    const data = {
      actorId,
      action,
      targetType,
      targetId,
      ...(summary !== undefined ? { summary } : {}),
    };
    if (id !== undefined) {
      if (entry.failOnDuplicateId) {
        await tx.adminAuditEvent.create({ data: { id, ...data } });
        return;
      }
      await tx.adminAuditEvent.upsert({ where: { id }, update: {}, create: { id, ...data } });
      return;
    }
    await tx.adminAuditEvent.create({ data });
  }

  /** Write one legacy staff-audit row. */
  static async writeStaffAudit(tx: StaffAuditTx, entry: StaffAuditEntry): Promise<void> {
    const { staffUserId, staffEmail, staffUsername, actorUserId, actorEmail, actorUsername, action, metadata } = entry;
    await tx.adminStaffAuditLog.create({ data: {
      staffUserId, staffEmail, staffUsername, actorUserId, actorEmail, actorUsername, action, metadata,
    } });
  }
}
