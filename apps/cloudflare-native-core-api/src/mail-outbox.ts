import type { NativeSmtpEnv } from './auth';
import { sendSmtpEmail } from './smtp';

interface MailEnv extends NativeSmtpEnv { DB: D1Database }

interface MailRow {
  id: string;
  recipient: string;
  subject: string;
  text_body: string;
  html_body: string;
  attempt_count: number;
}

export interface MailRunResult { scanned: number; sent: number; failed: number }

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export async function enqueueShipmentEmail(
  env: MailEnv,
  input: { orderId: string; shipmentId: string; status: string; carrier: string; trackingNumber: string; trackingUrl?: string | null },
): Promise<void> {
  if (!['SHIPPED', 'DELIVERED', 'EXCEPTION'].includes(input.status)) return;
  const recipient = await env.DB.prepare(
    `SELECT users.email FROM native_order_metadata metadata
     JOIN native_users users ON users.id = metadata.user_id WHERE metadata.order_id = ?1`,
  ).bind(input.orderId).first<{ email: string }>();
  if (!recipient?.email) return;
  const label = input.status === 'SHIPPED' ? 'has shipped' : input.status === 'DELIVERED' ? 'was delivered' : 'has a delivery exception';
  const subject = `Your BOKMOO order ${label}`;
  const trackingLine = input.trackingUrl ? `Track it: ${input.trackingUrl}` : '';
  const text = `Order ${input.orderId} ${label}.\nCarrier: ${input.carrier}\nTracking number: ${input.trackingNumber}${trackingLine ? `\n${trackingLine}` : ''}`;
  const link = input.trackingUrl ? `<p><a href="${escapeHtml(input.trackingUrl)}">Track package</a></p>` : '';
  const html = `<p>Order <strong>${escapeHtml(input.orderId)}</strong> ${escapeHtml(label)}.</p><p>Carrier: ${escapeHtml(input.carrier)}<br>Tracking number: ${escapeHtml(input.trackingNumber)}</p>${link}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO native_email_outbox
      (id, dedupe_key, message_type, order_id, recipient, subject, text_body, html_body,
       status, attempt_count, next_attempt_at, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'PENDING', 0, ?9, ?9, ?9)
     ON CONFLICT(dedupe_key) DO NOTHING`,
  ).bind(crypto.randomUUID(), `shipment:${input.shipmentId}:${input.status}`, `shipment.${input.status.toLowerCase()}`, input.orderId, recipient.email, subject, text, html, now).run();
}

export async function processNativeEmailOutbox(env: MailEnv, limit = 25): Promise<MailRunResult> {
  const now = new Date().toISOString();
  const rows = await env.DB.prepare(
    `SELECT id, recipient, subject, text_body, html_body, attempt_count FROM native_email_outbox
     WHERE ((status IN ('PENDING', 'RETRY') AND next_attempt_at <= ?1)
       OR (status = 'SENDING' AND last_attempted_at < ?2)) AND attempt_count < 10
     ORDER BY created_at LIMIT ?3`,
  ).bind(now, new Date(Date.now() - 5 * 60_000).toISOString(), limit).all<MailRow>();
  const result: MailRunResult = { scanned: rows.results.length, sent: 0, failed: 0 };
  for (const row of rows.results) {
    const claimed = await env.DB.prepare(
      `UPDATE native_email_outbox SET status = 'SENDING', last_attempted_at = ?1,
       attempt_count = attempt_count + 1, updated_at = ?1
       WHERE id = ?2 AND (status IN ('PENDING', 'RETRY') OR (status = 'SENDING' AND last_attempted_at < ?3))`,
    ).bind(now, row.id, new Date(Date.now() - 5 * 60_000).toISOString()).run();
    if ((claimed.meta.changes ?? 0) !== 1) continue;
    try {
      await sendSmtpEmail(env, { to: row.recipient, subject: row.subject, text: row.text_body, html: row.html_body });
      const sentAt = new Date().toISOString();
      await env.DB.prepare(
        `UPDATE native_email_outbox SET status = 'SENT', sent_at = ?1, last_error = NULL, updated_at = ?1 WHERE id = ?2`,
      ).bind(sentAt, row.id).run();
      result.sent += 1;
    } catch (error) {
      const attempt = row.attempt_count + 1;
      const failed = attempt >= 10;
      const nextAttempt = new Date(Date.now() + Math.min(60 * 60_000, 2 ** Math.min(attempt, 10) * 60_000)).toISOString();
      await env.DB.prepare(
        `UPDATE native_email_outbox SET status = ?1, next_attempt_at = ?2, last_error = ?3, updated_at = ?4 WHERE id = ?5`,
      ).bind(failed ? 'FAILED' : 'RETRY', nextAttempt, (error instanceof Error ? error.message : String(error)).slice(0, 1000), new Date().toISOString(), row.id).run();
      result.failed += 1;
    }
  }
  return result;
}
