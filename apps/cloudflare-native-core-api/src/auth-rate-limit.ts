interface RateLimitEnv { DB: D1Database }

type VerificationAction = 'register' | 'resend' | 'verify';

const limits: Record<VerificationAction, { windowSeconds: number; email: number; ip: number }> = {
  register: { windowSeconds: 3600, email: 3, ip: 10 },
  resend: { windowSeconds: 900, email: 3, ip: 20 },
  verify: { windowSeconds: 900, email: 20, ip: 40 },
};

async function digest(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function requestIp(request: Request): string {
  return request.headers.get('cf-connecting-ip')?.trim()
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

async function increment(
  env: RateLimitEnv,
  action: string,
  subject: string,
  windowStart: number,
  expiresAt: number,
): Promise<number> {
  const row = await env.DB.prepare(
    `INSERT INTO native_auth_rate_limits (action, subject_key, window_start, request_count, expires_at)
     VALUES (?1, ?2, ?3, 1, ?4)
     ON CONFLICT(action, subject_key, window_start) DO UPDATE SET
       request_count = native_auth_rate_limits.request_count + 1
     RETURNING request_count`,
  ).bind(action, await digest(subject), windowStart, expiresAt).first<{ request_count: number }>();
  return Number(row?.request_count ?? 1);
}

export async function consumeVerificationRateLimit(
  request: Request,
  env: RateLimitEnv,
  action: VerificationAction,
  email: string,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const rule = limits[action];
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / rule.windowSeconds) * rule.windowSeconds;
  const expiresAt = windowStart + rule.windowSeconds * 2;
  const normalizedEmail = email.trim().toLowerCase();
  const [emailCount, ipCount] = await Promise.all([
    increment(env, `${action}:email`, normalizedEmail || 'invalid', windowStart, expiresAt),
    increment(env, `${action}:ip`, requestIp(request), windowStart, expiresAt),
  ]);
  if (crypto.getRandomValues(new Uint8Array(1))[0]! < 4) {
    await env.DB.prepare('DELETE FROM native_auth_rate_limits WHERE expires_at < ?1').bind(now).run();
  }
  return {
    allowed: emailCount <= rule.email && ipCount <= rule.ip,
    retryAfter: Math.max(1, windowStart + rule.windowSeconds - now),
  };
}
