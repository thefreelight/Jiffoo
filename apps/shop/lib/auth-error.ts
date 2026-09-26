export function authErrorMessage(
  status: number, code: string | undefined,
  labels: Record<string, string>, mode: string,
) {
  if (status === 429 || code === 'RATE_LIMITED') return labels.tooManyAttempts;
  return mode === 'login' ? labels.invalidLogin : labels.verificationFailed;
}
