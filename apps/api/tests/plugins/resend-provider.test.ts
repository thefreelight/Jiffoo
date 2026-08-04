import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
}));

vi.mock('@/config/env', () => ({
  env: {
    RESEND_API_KEY: undefined,
  },
}));

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: { send: sendMock },
  })),
}));

import { ResendProvider } from '@/plugins/email-providers/resend-provider';

describe('ResendProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails explicitly when credentials are not configured', async () => {
    const provider = new ResendProvider();

    const result = await provider.send({
      to: 'buyer@example.com',
      from: 'support@example.com',
      subject: 'Verification code',
      text: '123456',
    });

    expect(result).toEqual({
      success: false,
      error: 'Email provider is not configured',
    });
    expect(sendMock).not.toHaveBeenCalled();
  });
});
