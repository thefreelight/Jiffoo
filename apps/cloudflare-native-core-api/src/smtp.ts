import { connect } from 'cloudflare:sockets';
import type { NativeSmtpEnv } from './auth';
import { getNativePluginConfig } from './plugin-settings';

type SmtpEnv = NativeSmtpEnv & Pick<Cloudflare.Env, 'DB' | 'JWT_SECRET'>;

interface SmtpSession {
  socket: ReturnType<typeof connect>;
  reader: ReadableStreamDefaultReader<Uint8Array>;
  writer: WritableStreamDefaultWriter<Uint8Array>;
  buffer: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function configuration(env: SmtpEnv) {
  const stored = await getNativePluginConfig(env, 'smtp-email');
  const plugin = stored?.enabled ? stored.config : {};
  const stringValue = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
  const host = stringValue(plugin.smtpHost) || env.SMTP_HOST?.trim();
  const port = Number(plugin.smtpPort || env.SMTP_PORT || '587');
  const fromEmail = stringValue(plugin.fromEmail) || env.SMTP_FROM_EMAIL?.trim() || env.SMTP_FROM?.trim();
  if (!host || !Number.isInteger(port) || port <= 0 || !fromEmail) {
    throw new Error('Mailcow SMTP is not configured');
  }
  return {
    host,
    port,
    secure: typeof plugin.smtpSecure === 'boolean'
      ? plugin.smtpSecure
      : env.SMTP_SECURE?.trim().toLowerCase() === 'true' || port === 465,
    user: stringValue(plugin.smtpUser) || env.SMTP_USERNAME?.trim() || env.SMTP_USER?.trim() || '',
    pass: stringValue(plugin.smtpPass) || env.SMTP_PASSWORD || env.SMTP_PASS || '',
    fromEmail,
    from: stringValue(plugin.fromName) || env.SMTP_FROM_NAME?.trim()
      ? `${header(stringValue(plugin.fromName) || env.SMTP_FROM_NAME!)} <${mailbox(fromEmail)}>`
      : fromEmail,
    replyTo: stringValue(plugin.replyTo) || env.SMTP_REPLY_TO?.trim() || '',
  };
}

function session(socket: ReturnType<typeof connect>): SmtpSession {
  return {
    socket,
    reader: socket.readable.getReader(),
    writer: socket.writable.getWriter(),
    buffer: '',
  };
}

async function response(current: SmtpSession): Promise<string> {
  while (true) {
    const lines = current.buffer.split(/\r?\n/);
    let complete: string | undefined;
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      if (/^\d{3} /.test(lines[index]!)) {
        complete = lines[index];
        break;
      }
    }
    if (complete) {
      const payload = current.buffer;
      current.buffer = '';
      const code = Number(complete.slice(0, 3));
      if (code >= 400) throw new Error(`SMTP ${code}: ${complete.slice(4)}`);
      return payload.trim();
    }
    const chunk = await current.reader.read();
    if (chunk.done) throw new Error('SMTP server closed the connection');
    current.buffer += decoder.decode(chunk.value, { stream: true });
  }
}

async function command(current: SmtpSession, value: string): Promise<string> {
  await current.writer.write(encoder.encode(`${value}\r\n`));
  return response(current);
}

function base64(value: string): string {
  const bytes = encoder.encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function header(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function mailbox(value: string): string {
  return value.match(/<([^>]+)>/)?.[1]?.trim() || value.trim();
}

export async function sendSmtpEmail(
  env: SmtpEnv,
  message: { to: string; subject: string; text: string; html: string },
): Promise<void> {
  const config = await configuration(env);
  let current = session(connect(
    { hostname: config.host, port: config.port },
    { secureTransport: config.secure ? 'on' : 'starttls', allowHalfOpen: false },
  ));

  try {
    await current.socket.opened;
    await response(current);
    await command(current, `EHLO ${config.host}`);

    if (!config.secure) {
      await command(current, 'STARTTLS');
      current.reader.releaseLock();
      current.writer.releaseLock();
      current = session(current.socket.startTls());
      await current.socket.opened;
      await command(current, `EHLO ${config.host}`);
    }

    if (config.user || config.pass) {
      if (!config.user || !config.pass) throw new Error('Mailcow SMTP credentials are incomplete');
      await command(current, 'AUTH LOGIN');
      await command(current, base64(config.user));
      await command(current, base64(config.pass));
    }

    await command(current, `MAIL FROM:<${mailbox(config.fromEmail)}>`);
    await command(current, `RCPT TO:<${mailbox(message.to)}>`);
    await command(current, 'DATA');
    const boundary = `bokmoo-${crypto.randomUUID()}`;
    const raw = [
      `From: ${header(config.from)}`,
      `To: ${header(message.to)}`,
      `Subject: ${header(message.subject)}`,
      ...(config.replyTo ? [`Reply-To: ${header(config.replyTo)}`] : []),
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      message.text,
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      message.html,
      `--${boundary}--`,
    ].join('\r\n').replace(/^\./gm, '..');
    await command(current, `${raw}\r\n.`);
    await command(current, 'QUIT');
  } finally {
    current.reader.releaseLock();
    current.writer.releaseLock();
    await current.socket.close().catch(() => undefined);
  }
}
