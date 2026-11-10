export const IDENTITY_BINDING_COOKIE = 'shop_identity_binding';
export const IDENTITY_BINDING_SECONDS = 600;
export function identityHandoffCode(hash: string): string {
  return /^#code=[A-Za-z0-9_-]{43}$/.test(hash) ? hash.slice(6) : '';
}
export type IdentityProvider = { slug: string; label: string; ready: boolean };
export type IdentityConnection = { id: string; providerSlug: string; label: string; issuer: string; subject: string; createdAt: string; available: boolean };
export function canUnlinkIdentity(hasPassword: boolean, connections: IdentityConnection[], id: string): boolean {
  return hasPassword || connections.some(connection => connection.id !== id && connection.available);
}
export function identityStartPath(path: string): boolean {
  return /^\/auth\/identity\/[a-z][a-z0-9-]{0,99}\/start$/.test(path);
}
export function identityConnectionPath(path: string): boolean {
  return /^\/auth\/identity\/connections\/[A-Za-z0-9_-]{1,200}$/.test(path);
}
