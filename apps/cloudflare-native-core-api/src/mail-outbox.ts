import type { NativeSmtpEnv } from './auth';
import { sendSmtpEmail } from './smtp';

interface MailEnv extends NativeSmtpEnv { DB: D1Database; JWT_SECRET: SecretsStoreSecret }

interface OrderEmailInput {
  orderId: string;
  recipient: string;
  subject: string;
  text: string;
  html: string;
  messageType: string;
  dedupeKey: string;
}

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

async function enqueueEmail(env: MailEnv, input: OrderEmailInput): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO native_email_outbox
      (id, dedupe_key, message_type, order_id, recipient, subject, text_body, html_body,
       status, attempt_count, next_attempt_at, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'PENDING', 0, ?9, ?9, ?9)
     ON CONFLICT(dedupe_key) DO NOTHING`,
  ).bind(crypto.randomUUID(), input.dedupeKey, input.messageType, input.orderId, input.recipient, input.subject, input.text, input.html, now).run();
}

function localeOf(order: Record<string, unknown>): 'zh-CN' | 'en' {
  return typeof order.locale === 'string' && order.locale.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}

export async function enqueueOrderPaidEmail(env: MailEnv, order: Record<string, unknown>): Promise<void> {
  const orderId = typeof order.id === 'string' ? order.id : null;
  if (!orderId) return;
  const recipient = await env.DB.prepare(
    `SELECT users.email FROM native_order_metadata metadata
     JOIN native_users users ON users.id = metadata.user_id WHERE metadata.order_id = ?1`,
  ).bind(orderId).first<{ email: string }>();
  if (!recipient?.email) return;
  const locale = localeOf(order);
  const subject = locale === 'zh-CN' ? `BOKMOO 订单已支付：${orderId}` : `BOKMOO payment confirmed: ${orderId}`;
  const text = locale === 'zh-CN'
    ? `你的 BOKMOO 订单 ${orderId} 已支付成功，我们会尽快处理。`
    : `Your BOKMOO order ${orderId} has been paid successfully and is now being processed.`;
  await enqueueEmail(env, {
    orderId, recipient: recipient.email, subject, text,
    html: `<p>${escapeHtml(text)}</p>`, messageType: 'order.paid', dedupeKey: `order-paid:${orderId}`,
  });
}

export async function enqueueRefundEmail(
  env: MailEnv,
  input: { orderId: string; amount: number; currency: string; fullyRefunded: boolean; reason?: string | null },
): Promise<void> {
  const recipient = await env.DB.prepare(
    `SELECT users.email FROM native_order_metadata metadata
     JOIN native_users users ON users.id = metadata.user_id WHERE metadata.order_id = ?1`,
  ).bind(input.orderId).first<{ email: string }>();
  if (!recipient?.email) return;
  const amount = `${input.currency} ${input.amount.toFixed(2)}`;
  const subject = input.fullyRefunded ? `BOKMOO refund completed: ${input.orderId}` : `BOKMOO partial refund completed: ${input.orderId}`;
  const text = `Your BOKMOO refund for order ${input.orderId} is complete: ${amount}.${input.reason ? ` Reason: ${input.reason}` : ''}`;
  await enqueueEmail(env, {
    orderId: input.orderId, recipient: recipient.email, subject, text,
    html: `<p>${escapeHtml(text)}</p>`, messageType: 'order.refunded', dedupeKey: `order-refunded:${input.orderId}:${input.amount.toFixed(2)}`,
  });
}

export async function enqueueAffiliateCommissionEmail(
  env: MailEnv,
  input: { commissionId: string; partnerId: string; orderId: string; amount: number; currency: string },
): Promise<void> {
  const recipient = await env.DB.prepare(
    'SELECT email FROM native_affiliate_partners WHERE id = ?1 AND email IS NOT NULL',
  ).bind(input.partnerId).first<{ email: string }>();
  if (!recipient?.email) return;
  const amount = `${input.currency} ${input.amount.toFixed(2)}`;
  const subject = `BOKMOO affiliate commission recorded: ${input.orderId}`;
  const text = `A pending BOKMOO affiliate commission of ${amount} was recorded for order ${input.orderId}.`;
  await enqueueEmail(env, {
    orderId: input.orderId, recipient: recipient.email, subject, text,
    html: `<p>${escapeHtml(text)}</p>`, messageType: 'affiliate.commission', dedupeKey: `affiliate-commission:${input.commissionId}`,
  });
}

export async function enqueueOrganizationCommissionEmail(
  env: MailEnv,
  input: { commissionId: string; beneficiaryUserId: string; orderId: string; amount: number; currency: string },
): Promise<void> {
  const recipient = await env.DB.prepare(
    'SELECT email FROM native_users WHERE id = ?1',
  ).bind(input.beneficiaryUserId).first<{ email: string }>();
  if (!recipient?.email) return;
  const amount = `${input.currency} ${input.amount.toFixed(2)}`;
  const subject = `BOKMOO organization commission recorded: ${input.orderId}`;
  const text = `A pending BOKMOO organization commission of ${amount} was recorded for order ${input.orderId}.`;
  await enqueueEmail(env, {
    orderId: input.orderId, recipient: recipient.email, subject, text,
    html: `<p>${escapeHtml(text)}</p>`, messageType: 'affiliate.organization.commission', dedupeKey: `affiliate-organization-commission:${input.commissionId}`,
  });
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
  await enqueueEmail(env, {
    orderId: input.orderId, recipient: recipient.email, subject, text, html,
    messageType: `shipment.${input.status.toLowerCase()}`, dedupeKey: `shipment:${input.shipmentId}:${input.status}`,
  });
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
