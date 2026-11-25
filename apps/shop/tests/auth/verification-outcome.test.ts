import { describe, expect, it } from 'vitest';

import { verificationCall, verificationFailure } from '@/lib/auth/verification-outcome';

// The API client resolves a failed request as the service's error body; it
// never rejects for an HTTP error.
const rejected = (code: string, message: string) => ({ success: false, error: { code, message } });

describe('verificationFailure', () => {
  it('reports success only for a request that succeeded', () => {
    expect(verificationFailure({ success: true, data: { access_token: 'a' } })).toBeNull();
  });

  it('never lets a failed request read as verified', () => {
    // Regression: the page used to show "Email verified" for these.
    expect(verificationFailure(rejected('VERIFICATION_FAILED', 'Invalid email or verification code'))).toEqual({ kind: 'codeRejected' });
    expect(verificationFailure(rejected('VERIFICATION_FAILED', 'Verification code has expired'))).toEqual({ kind: 'codeRejected' });
    expect(verificationFailure(rejected('VERIFICATION_FAILED', 'Too many attempts. Request a new verification code'))).toEqual({ kind: 'codeRejected' });
    // A resend for an address with no account is refused; that says nothing about a code.
    expect(verificationFailure(rejected('RESEND_FAILED', 'User not found'))).toEqual({ kind: 'failed' });
    expect(verificationFailure(rejected('EMAIL_UNAVAILABLE', 'SMTP is not configured for this Cloudflare deployment'))).toEqual({ kind: 'emailUnavailable' });
    expect(verificationFailure(rejected('RATE_LIMITED', 'Too many verification attempts. Try again later'))).toEqual({ kind: 'rateLimited' });
    expect(verificationFailure(rejected('INVALID_TOKEN', 'Verification link is invalid'))).toEqual({ kind: 'failed' });
    expect(verificationFailure(rejected('REQUEST_FAILED', 'Network Error'))).toEqual({ kind: 'failed' });
    expect(verificationFailure({ success: false })).toEqual({ kind: 'failed' });
  });

  it('treats an address with nothing left to verify as done', () => {
    expect(verificationFailure(rejected('VERIFICATION_FAILED', 'Email is already verified'))).toEqual({ kind: 'alreadyVerified' });
    expect(verificationFailure(rejected('RESEND_FAILED', 'Email is already verified'))).toEqual({ kind: 'alreadyVerified' });
  });
});

describe('verificationCall', () => {
  it('returns the response beside its outcome', async () => {
    const response = { success: true, data: { access_token: 'a', refresh_token: 'r' } };
    expect(await verificationCall(Promise.resolve(response))).toEqual({ response, failure: null });
  });

  it('counts a rejection as a failure', async () => {
    const hanging: Promise<{ success: boolean }> = Promise.reject(new Error('socket hang up'));
    const outcome = await verificationCall(hanging);
    expect(outcome.failure).toEqual({ kind: 'failed' });
    expect(outcome.response.success).toBe(false);
  });
});
