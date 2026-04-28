const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

export const ADMIN_DEMO_EMAIL = 'admin@jiffoo.com';
export const ADMIN_DEMO_PASSWORD = 'admin123';

export function isDemoCredentialsEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_ENABLE_DEMO_CREDENTIALS === 'true') {
    return true;
  }

  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  if (typeof window !== 'undefined') {
    return LOCALHOST_HOSTS.has(window.location.hostname);
  }

  return false;
}
