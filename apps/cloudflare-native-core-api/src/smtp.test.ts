import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));
vi.mock('./plugin-settings', () => ({ getNativePluginConfig: vi.fn() }));

const { resolveSmtpSecret } = await import('./smtp');

describe('SMTP secret resolution', () => {
  it('reads SMTP passwords from a Cloudflare Secrets Store binding', async () => {
    const get = vi.fn().mockResolvedValue('mailcow-secret');

    await expect(resolveSmtpSecret({ get } as SecretsStoreSecret)).resolves.toBe('mailcow-secret');
    expect(get).toHaveBeenCalledOnce();
  });

  it('preserves string credentials for local runtime tests', async () => {
    await expect(resolveSmtpSecret('local-secret')).resolves.toBe('local-secret');
    await expect(resolveSmtpSecret(undefined)).resolves.toBe('');
  });
});
