import { z } from 'zod';
import type { storefront } from 'shared/src/i18n/messages/en/storefront';

type Copy = typeof storefront.s4;
export const addressFields = ['lastName', 'firstName', 'phone', 'country', 'state', 'city', 'addressLine1', 'addressLine2', 'postalCode'] as const;
export type AddressField = typeof addressFields[number];

export function addressSchema(t: Copy, requiredCountries: readonly string[]) {
  const required = () => z.string().trim().min(1, t.required);
  return z.object({
    firstName: required(), lastName: required(), phone: required(), addressLine1: required(), city: required(), country: required(),
    state: z.string().trim(), postalCode: z.string().trim(), addressLine2: z.string().trim(),
  }).superRefine((address, context) => {
    if (requiredCountries.includes(address.country.toUpperCase())) {
      for (const key of ['state', 'postalCode'] as const) if (!address[key]) context.addIssue({ code: 'custom', path: [key], message: t.required });
    }
  });
}

export type AuthValues = { email: string; username: string; password: string; newPassword: string; confirmPassword: string; code: string };
export function authSchema(mode: string, t: Copy) {
  return z.object({
    email: mode === 'reset-password' ? z.string() : mode === 'login' ? z.string().trim().min(1, t.required) : z.string().email(t.invalidEmail),
    username: mode === 'register' ? z.string().min(3, t.usernameMin) : z.string(),
    password: mode === 'register' ? z.string().min(8, t.passwordNewMin) : mode === 'login' ? z.string().min(6, t.passwordMin) : z.string(),
    newPassword: mode === 'reset-password' ? z.string().min(6, t.passwordMin) : z.string(),
    confirmPassword: z.string(),
    code: mode === 'verify-email' ? z.string().regex(/^\d{6}$/, t.codeInvalid) : z.string(),
  }).superRefine((value, context) => {
    if (mode === 'reset-password' && value.newPassword !== value.confirmPassword) context.addIssue({ code: 'custom', path: ['confirmPassword'], message: t.passwordMismatch });
  });
}

export function serverFieldIssues(body: unknown): string[] {
  const issues = (body as { error?: { details?: { issues?: Array<{ path?: string }> } } })?.error?.details?.issues;
  return Array.isArray(issues) ? issues.flatMap(({ path }) => typeof path === 'string' ? [path.replace(/^\//, '').split(/[./]/).at(-1)!] : []) : [];
}
