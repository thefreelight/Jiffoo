import { z } from 'zod';

const code = z.string().min(1).max(64);
const unavailable = z.object({ outcome: z.literal('unavailable'), code }).strict();
export const identityV1Methods = {
  describe: { input: z.object({}).strict(), output: z.object({ ready: z.boolean(), label: z.string().min(1).max(100), issuer: z.string().url().max(2048), callbackMethod: z.enum(['GET', 'POST']), pkce: z.enum(['S256', 'none']) }).strict() },
  authorize: {
    input: z.object({ redirectUri: z.string().url().max(2048), state: z.string().min(1).max(256), nonce: z.string().min(1).max(256), codeChallenge: z.string().min(1).max(256) }).strict(),
    output: z.discriminatedUnion('outcome', [z.object({ outcome: z.literal('ready'), authorizationUrl: z.string().url().max(8192) }).strict(), unavailable]),
  },
  complete: {
    input: z.object({ code: z.string().min(1).max(8192), redirectUri: z.string().url().max(2048), nonce: z.string().min(1).max(256), codeVerifier: z.string().min(1).max(256), user: z.object({ firstName: z.string().max(100).optional(), lastName: z.string().max(100).optional() }).strict().optional() }).strict(),
    output: z.discriminatedUnion('outcome', [
      z.object({ outcome: z.literal('verified'), issuer: z.string().url().max(2048), subject: z.string().min(1).max(255), email: z.string().email().max(320), emailVerified: z.boolean(), displayName: z.string().max(200).optional() }).strict(),
      z.object({ outcome: z.literal('rejected'), code }).strict(), unavailable,
    ]),
  },
} as const;
export type IdentityV1Method = keyof typeof identityV1Methods;
export type IdentityV1Input<M extends IdentityV1Method> = z.infer<(typeof identityV1Methods)[M]['input']>;
export type IdentityV1Output<M extends IdentityV1Method> = z.infer<(typeof identityV1Methods)[M]['output']>;
