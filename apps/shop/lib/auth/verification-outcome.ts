/**
 * Why a verification request failed.
 *
 * The API client never rejects: a failed request resolves to
 * `{ success: false, error }` exactly like a successful one. The verification
 * page used to await the call and carry on, so a wrong code — or a dead
 * verification link — rendered the "verified" screen. Every call site reads
 * the outcome through this helper instead.
 */
export type VerificationFailureKind =
  | 'emailUnavailable'
  | 'rateLimited'
  | 'codeRejected'
  | 'alreadyVerified'
  | 'failed';

export interface VerificationFailure {
  kind: VerificationFailureKind;
}

type VerificationResponse = {
  success: boolean;
  error?: { code?: string; message?: string } | null;
};

/** Null when the request succeeded. */
export function verificationFailure<T extends VerificationResponse>(response: T): VerificationFailure | null {
  if (response.success) return null;
  const code = response.error?.code ?? '';
  const message = response.error?.message ?? '';
  if (code === 'EMAIL_UNAVAILABLE') return { kind: 'emailUnavailable' };
  if (code === 'RATE_LIMITED') return { kind: 'rateLimited' };
  // The service says so both when the code is checked and when a new one is
  // requested: either way there is nothing left to verify.
  if (/already verified/i.test(message)) return { kind: 'alreadyVerified' };
  // Wrong, expired, or used up: 'VERIFICATION_FAILED' wraps every reason the
  // service gives for a rejected code. A resend that was refused says nothing
  // about a code, so it keeps the caller's own copy.
  if (code === 'VERIFICATION_FAILED') return { kind: 'codeRejected' };
  return { kind: 'failed' };
}

export interface VerificationCall<T> {
  response: T;
  /** Null when the request succeeded. */
  failure: VerificationFailure | null;
}

/**
 * A verification request with its failure classified. A rejection (a network
 * failure surfaces as a resolved `REQUEST_FAILED`, so it is defensive) counts
 * as a failure too — nothing that did not succeed may read as verified.
 */
export async function verificationCall<T extends VerificationResponse>(
  call: Promise<T>,
): Promise<VerificationCall<T>> {
  let response: T;
  try {
    response = await call;
  } catch {
    response = { success: false } as T;
  }
  return { response, failure: verificationFailure(response) };
}
