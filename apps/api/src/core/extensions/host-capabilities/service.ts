import type { Prisma } from '@prisma/client';
import type { PurchasableVariant, TaskPrincipal } from '@jiffoo/shared';
import type { prisma } from '@/config/database';

export type HostCapabilityTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type Transaction = HostCapabilityTransaction;
export interface HostCapabilityAdapters {
  requirePluginAction(tx: Transaction, installationId: string, principal: TaskPrincipal | null, action: string): Promise<void>;
  catalogue(ids: string[], locale: string): Promise<{ items: PurchasableVariant[] }>;
  assertOperation(tx: Transaction, installationId: string): Promise<unknown>;
  principal(tx: Transaction, installationId: string): Promise<TaskPrincipal>;
  validatePrincipal(tx: Transaction, installationId: string, principal: TaskPrincipal): Promise<void>;
  customers(tx: Transaction, input: { ids?: string[]; query?: string; afterId?: string; limit: number }): Promise<Array<{ id: string; username: string; email: string }>>;
  audit(tx: Transaction, event: { actorId: string; action: string; targetType: string; targetId: string; summary: Prisma.InputJsonObject }): Promise<unknown>;
}

/** Process composition only: contains public service adapters, never request state. */
let adapters: Readonly<HostCapabilityAdapters> | undefined;
export function registerHostCapabilityAdapters(value: HostCapabilityAdapters): void {
  adapters = Object.freeze({ ...value });
}
export function hostCapabilityAdapters(): Readonly<HostCapabilityAdapters> {
  if (!adapters) throw new Error('Host capability adapters are not initialized');
  return adapters;
}
