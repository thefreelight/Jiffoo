import { authenticateNativeUser, type NativeAuthEnv } from './auth';
import { decryptNativeUserSecret, encryptNativeUserSecret } from './plugin-settings';
import { sendSmtpEmail } from './smtp';

type Env = NativeAuthEnv & Pick<Cloudflare.Env, 'DB' | 'PLUGIN_CONFIG_KEY'>;
type Row = { id: string; user_id: string; host: string; port: number; secure: number; username: string; encrypted_password: string; from_email: string; from_name: string | null; reply_to: string | null; enabled: number; created_at: string; updated_at: string };
const path = '/api/v1/plugins/remoteradar-smtp/store';
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const smtpHost = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const ipv4Literal = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const text = (v: unknown) => typeof v === 'string' ? v.trim() : '';

function publicConfig(row: Row | null) {
  if (!row) return { configured: false, enabled: false, passwordConfigured: false };
  return { configured: true, enabled: row.enabled === 1, host: row.host, port: row.port, secure: row.secure === 1, username: row.username, fromEmail: row.from_email, fromName: row.from_name ?? '', replyTo: row.reply_to ?? '', passwordConfigured: true, updatedAt: row.updated_at };
}
function fail(code: string, message: string, status = 400) { return Response.json({ code, message }, { status }); }

export async function tryNativeRemoteRadarSmtp(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(path)) return null;
  const user = await authenticateNativeUser(request, env);
  if (!user) return fail('UNAUTHORIZED', 'Authentication required', 401);
  const row = await env.DB.prepare('SELECT * FROM remoteradar_user_smtp_configs WHERE user_id = ?1').bind(user.id).first<Row>();
  if (url.pathname === `${path}/config` && request.method === 'GET') return Response.json({ data: publicConfig(row) });
  if (url.pathname === `${path}/config` && request.method === 'PUT') {
    const body = await request.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
    const host = text(body.host), username = text(body.username), fromEmail = text(body.fromEmail), fromName = text(body.fromName), replyTo = text(body.replyTo);
    const port = Number(body.port), secure = body.secure === true, enabled = body.enabled !== false;
    const password = text(body.password);
    if (!smtpHost.test(host) || ipv4Literal.test(host) || !username || !fromEmail || !email.test(fromEmail)) return fail('INVALID_SMTP_CONFIG', 'A public SMTP hostname, username and valid fromEmail are required');
    if (!Number.isInteger(port) || port < 1 || port > 65535) return fail('INVALID_SMTP_CONFIG', 'Port must be between 1 and 65535');
    if (replyTo && !email.test(replyTo)) return fail('INVALID_SMTP_CONFIG', 'replyTo must be a valid email');
    if (!row && !password) return fail('INVALID_SMTP_CONFIG', 'Password is required when configuring SMTP');
    const encrypted = password ? JSON.stringify(await encryptNativeUserSecret(env, password)) : row!.encrypted_password;
    const now = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO remoteradar_user_smtp_configs (id,user_id,host,port,secure,username,encrypted_password,from_email,from_name,reply_to,enabled,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?12) ON CONFLICT(user_id) DO UPDATE SET host=excluded.host,port=excluded.port,secure=excluded.secure,username=excluded.username,encrypted_password=excluded.encrypted_password,from_email=excluded.from_email,from_name=excluded.from_name,reply_to=excluded.reply_to,enabled=excluded.enabled,updated_at=excluded.updated_at`).bind(row?.id ?? crypto.randomUUID(), user.id, host, port, secure ? 1 : 0, username, encrypted, fromEmail, fromName || null, replyTo || null, enabled ? 1 : 0, now).run();
    const saved = await env.DB.prepare('SELECT * FROM remoteradar_user_smtp_configs WHERE user_id = ?1').bind(user.id).first<Row>();
    return Response.json({ data: publicConfig(saved) });
  }
  if (url.pathname === `${path}/test` && request.method === 'POST') {
    if (!row || row.enabled !== 1) return fail('SMTP_NOT_CONFIGURED', 'Enable SMTP before testing');
    const recent = await env.DB.prepare("SELECT COUNT(*) AS count FROM remoteradar_email_events WHERE user_id = ?1 AND subject = 'RemoteRadar SMTP test' AND created_at > ?2").bind(user.id, new Date(Date.now() - 60_000).toISOString()).first<{ count: number }>();
    if ((recent?.count ?? 0) >= 3) return fail('SMTP_TEST_RATE_LIMITED', 'Wait before sending another test', 429);
    const recipient = user.email;
    let status = 'sent', errorCode: string | null = null;
    try { await sendSmtpEmail(env, { to: recipient, subject: 'RemoteRadar SMTP test', text: 'Your RemoteRadar SMTP configuration is working.', html: '<p>Your RemoteRadar SMTP configuration is working.</p>' }, user.id); }
    catch (error) { status = 'failed'; errorCode = error instanceof Error ? error.message.slice(0, 200) : 'SMTP_SEND_FAILED'; }
    await env.DB.prepare('INSERT INTO remoteradar_email_events (id,user_id,recipient,subject,status,error_code,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)').bind(crypto.randomUUID(), user.id, recipient, 'RemoteRadar SMTP test', status, errorCode, new Date().toISOString()).run();
    return status === 'sent' ? Response.json({ data: { sent: true } }) : fail('SMTP_SEND_FAILED', 'The SMTP server rejected the test message', 502);
  }
  return fail('NOT_FOUND', 'Route not found', 404);
}
