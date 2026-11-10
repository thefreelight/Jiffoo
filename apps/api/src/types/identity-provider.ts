import type { prisma } from '@/config/database';
import type { IdentityV1Input, IdentityV1Method, IdentityV1Output } from '@jiffoo/shared';

export type IdentityProviderSnapshot = Readonly<{ pluginSlug: string; installationId: string; token: string }>;
export type IdentityTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
/** Assembly-only provider port. It is not part of the plugin context. */
export interface IdentityProviderPort {
  invoke<M extends IdentityV1Method>(slug: string, method: M, input: IdentityV1Input<M>): Promise<IdentityV1Output<M>>;
  snapshot(): Promise<IdentityProviderSnapshot[]>;
  lock(tx: IdentityTransactionClient, expected: readonly IdentityProviderSnapshot[]): Promise<boolean>;
}
