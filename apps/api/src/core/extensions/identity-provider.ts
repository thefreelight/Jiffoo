import type { IdentityProviderPort } from '@/types/identity-provider';
import { callContract } from './runtime/plugin-runtime';
import { snapshotIdentityProviders, lockIdentityProviderSnapshots } from './registry';
import { randomUUID } from 'node:crypto';
import type { IdentityV1Input, IdentityV1Output, IdentityV1Method } from '@jiffoo/shared';

export const identityProviderAdapter: IdentityProviderPort = {
  async invoke<M extends IdentityV1Method>(slug: string, method: M, input: IdentityV1Input<M>) {
    return await callContract(slug, 'identity', 1, method, input, { kind: 'identity', id: randomUUID() }) as IdentityV1Output<M>;
  },
  snapshot: snapshotIdentityProviders,
  lock: lockIdentityProviderSnapshots,
};
