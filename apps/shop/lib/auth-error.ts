export function authErrorMessage(
  status: number, code: string | undefined,
  labels: Record<string, string>, mode: string,
) {
  void mode;
  if (status === 429 || code === 'RATE_LIMITED') return labels.tooManyAttempts;
  if (mode === 'login' && code === 'LOGIN_FAILED') return labels.invalidLogin;
  if (code === 'ACCOUNT_INACTIVE') return labels.accountInactive;
  if (code === 'EMAIL_NOT_VERIFIED' || code === 'INVALID_VERIFICATION_CODE') return labels.verificationFailed;
  return labels.genericError;
}
