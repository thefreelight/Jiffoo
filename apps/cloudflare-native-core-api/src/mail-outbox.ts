import type { NativeSmtpEnv } from './auth';
import { sendSmtpEmail } from './smtp';
import { nativeSiteName } from './site-name';

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

type MailLocale = 'zh-CN' | 'en';

export interface MailRunResult { scanned: number; sent: number; failed: number }

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function finite(value: number | undefined | null): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function money(currency: string, amount: number): string {
  return `${currency} ${amount.toFixed(2)}`;
}

function formatUtcStamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

const BADGE_TONES = {
  success: 'background:#e8f7ee;color:#188a4f',
  info: 'background:#eef2ff;color:#3157e5',
} as const;

interface TransactionEmailBody {
  badge?: { text: string; tone: keyof typeof BADGE_TONES };
  heading: string;
  intro: string;
  bodyHtml: string;
}

function transactionEmailHtml(siteName: string, locale: MailLocale, body: TransactionEmailBody): string {
  const brand = escapeHtml(siteName);
  const badgeRow = body.badge
    ? `<tr><td style="padding:28px 40px 0;" align="left"><span style="display:inline-block;${BADGE_TONES[body.badge.tone]};font-size:13px;font-weight:700;border-radius:999px;padding:6px 14px;">${escapeHtml(body.badge.text)}</span></td></tr>`
    : '';
  const headingPadding = body.badge ? '16px 40px 8px' : '32px 40px 8px';
  const footerNote = locale === 'zh-CN'
    ? `这是来自 ${brand} 的自动通知邮件，请勿直接回复本地址。`
    : `This is an automated message from ${brand}. Replies to this address are not monitored.`;
  return `<!doctype html>
<html lang="${locale === 'zh-CN' ? 'zh-CN' : 'en'}"><body style="margin:0;padding:0;background:#f4f5fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5fa;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
  <tr><td style="text-align:center;padding-bottom:24px;">
    <span style="display:inline-block;font-size:20px;font-weight:800;color:#1d2433;letter-spacing:.02em;">${brand}</span>
  </td></tr>
  <tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e6e8f0;overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#3157e5,#5b7cf7);height:6px;font-size:0;line-height:0;">&nbsp;</td></tr>
      ${badgeRow}
      <tr><td style="padding:${headingPadding};">
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#1d2433;">${escapeHtml(body.heading)}</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#5a6172;">${escapeHtml(body.intro)}</p>
      </td></tr>
      <tr><td style="padding:24px 40px 32px;">${body.bodyHtml}</td></tr>
      <tr><td style="padding:18px 40px;border-top:1px solid #eef0f6;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#8a90a3;">${footerNote}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function detailRows(pairs: Array<{ label: string; value: string }>): string {
  if (pairs.length === 0) return '';
  const divider = (index: number) => (index === 0 ? '' : 'border-top:1px solid #eceef5;');
  const rows = pairs.map((pair, index) => `<tr>
    <td style="padding:11px 18px;font-size:13px;color:#8a90a3;white-space:nowrap;${divider(index)}">${escapeHtml(pair.label)}</td>
    <td align="right" style="padding:11px 18px;font-size:13px;color:#1d2433;${divider(index)}">${escapeHtml(pair.value)}</td>
  </tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fc;border:1px solid #eceef5;border-radius:12px;border-collapse:separate;overflow:hidden;">${rows}</table>`;
}

function summaryRow(label: string, value: string, emphasized: boolean): string {
  if (emphasized) {
    return `<tr>
      <td style="padding:12px 0 0;border-top:1px solid #eef0f6;font-size:15px;font-weight:700;color:#1d2433;">${escapeHtml(label)}</td>
      <td align="right" style="padding:12px 0 0;border-top:1px solid #eef0f6;font-size:18px;font-weight:800;color:#3157e5;">${escapeHtml(value)}</td>
    </tr>`;
  }
  return `<tr>
    <td style="padding:6px 0;font-size:13px;color:#8a90a3;">${escapeHtml(label)}</td>
    <td align="right" style="padding:6px 0;font-size:13px;color:#5a6172;">${escapeHtml(value)}</td>
  </tr>`;
}

function trackingButton(url: string, label: string): string {
  return `<div style="margin-top:20px;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#3157e5;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;padding:12px 28px;">${escapeHtml(label)}</a></div>`;
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

function localeOf(order: Record<string, unknown>): MailLocale {
  return typeof order.locale === 'string' && order.locale.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}

async function orderLocale(env: MailEnv, orderId: string): Promise<MailLocale> {
  const row = await env.DB.prepare('SELECT payload FROM native_order_snapshots WHERE id = ?1')
    .bind(orderId).first<{ payload: string }>();
  if (!row) return 'en';
  try {
    return localeOf(JSON.parse(row.payload) as Record<string, unknown>);
  } catch {
    return 'en';
  }
}

export function refundEmailCopy(
  locale: MailLocale,
  input: { siteName: string; orderId: string; amount: string; fullyRefunded: boolean; reason?: string | null },
): { subject: string; text: string; html: string } {
  const zh = locale === 'zh-CN';
  const badgeText = zh
    ? (input.fullyRefunded ? '退款已完成' : '部分退款已完成')
    : (input.fullyRefunded ? 'Refund completed' : 'Partial refund completed');
  if (zh) {
    const kind = input.fullyRefunded ? '退款已完成' : '部分退款已完成';
    const pairs = [
      { label: '订单号', value: input.orderId },
      { label: '退款金额', value: input.amount },
      ...(input.reason ? [{ label: '原因', value: input.reason }] : []),
    ];
    return {
      subject: `${input.siteName} ${kind}：${input.orderId}`,
      text: `你的 ${input.siteName} 订单 ${input.orderId} 已完成退款：${input.amount}。${input.reason ? ` 原因：${input.reason}` : ''}`,
      html: transactionEmailHtml(input.siteName, locale, {
        badge: { text: badgeText, tone: 'info' },
        heading: '退款已处理',
        intro: '你的订单退款已完成，款项将原路退回，到账时间以支付渠道为准。',
        bodyHtml: detailRows(pairs),
      }),
    };
  }
  const pairs = [
    { label: 'Order number', value: input.orderId },
    { label: 'Refund amount', value: input.amount },
    ...(input.reason ? [{ label: 'Reason', value: input.reason }] : []),
  ];
  return {
    subject: input.fullyRefunded ? `${input.siteName} refund completed: ${input.orderId}` : `${input.siteName} partial refund completed: ${input.orderId}`,
    text: `Your ${input.siteName} refund for order ${input.orderId} is complete: ${input.amount}.${input.reason ? ` Reason: ${input.reason}` : ''}`,
    html: transactionEmailHtml(input.siteName, locale, {
      badge: { text: badgeText, tone: 'info' },
      heading: 'Refund processed',
      intro: 'Your refund has been processed and will be returned via your original payment method.',
      bodyHtml: detailRows(pairs),
    }),
  };
}

export function commissionEmailCopy(
  locale: MailLocale,
  input: { siteName: string; orderId: string; amount: string; organization: boolean },
): { subject: string; text: string; html: string } {
  const pairs = [
    { label: locale === 'zh-CN' ? '订单号' : 'Order number', value: input.orderId },
    { label: locale === 'zh-CN' ? '佣金金额' : 'Commission amount', value: input.amount },
  ];
  if (locale === 'zh-CN') {
    const kind = input.organization ? '机构推广佣金' : '推广佣金';
    return {
      subject: `${input.siteName} ${kind}已记录：${input.orderId}`,
      text: `订单 ${input.orderId} 已记录一笔待结算的 ${input.siteName} ${kind}：${input.amount}。`,
      html: transactionEmailHtml(input.siteName, locale, {
        badge: { text: kind, tone: 'info' },
        heading: '佣金已记录',
        intro: '订单产生一笔待结算佣金，达到结算条件后会另行通知你。',
        bodyHtml: detailRows(pairs),
      }),
    };
  }
  const kind = input.organization ? 'organization commission' : 'affiliate commission';
  return {
    subject: `${input.siteName} ${kind} recorded: ${input.orderId}`,
    text: `A pending ${input.siteName} ${kind} of ${input.amount} was recorded for order ${input.orderId}.`,
    html: transactionEmailHtml(input.siteName, locale, {
      badge: { text: input.organization ? 'Organization commission' : 'Affiliate commission', tone: 'info' },
      heading: 'Commission recorded',
      intro: 'A pending commission was recorded for this order. You will be notified once it becomes eligible for payout.',
      bodyHtml: detailRows(pairs),
    }),
  };
}

export function shipmentEmailCopy(
  locale: MailLocale,
  input: { siteName: string; orderId: string; status: string; carrier: string; trackingNumber: string; trackingUrl?: string | null },
): { subject: string; text: string; html: string } {
  const zhLabels: Record<string, string> = { SHIPPED: '已发货', DELIVERED: '已送达', EXCEPTION: '配送异常' };
  const enBadgeLabels: Record<string, string> = { SHIPPED: 'Shipped', DELIVERED: 'Delivered', EXCEPTION: 'Delivery exception' };
  const enLabel = input.status === 'SHIPPED' ? 'has shipped' : input.status === 'DELIVERED' ? 'was delivered' : 'has a delivery exception';
  const zhLabel = zhLabels[input.status] ?? '物流状态已更新';
  const enBadge = enBadgeLabels[input.status] ?? 'Delivery update';
  const pairs = [
    { label: locale === 'zh-CN' ? '订单号' : 'Order number', value: input.orderId },
    { label: locale === 'zh-CN' ? '承运商' : 'Carrier', value: input.carrier },
    { label: locale === 'zh-CN' ? '物流单号' : 'Tracking number', value: input.trackingNumber },
  ];
  let bodyHtml = detailRows(pairs);
  if (input.trackingUrl) bodyHtml += trackingButton(input.trackingUrl, locale === 'zh-CN' ? '查看物流' : 'Track package');
  if (locale === 'zh-CN') {
    const trackingLine = input.trackingUrl ? `\n查看物流：${input.trackingUrl}` : '';
    const text = `订单 ${input.orderId} ${zhLabel}。\n承运商：${input.carrier}\n物流单号：${input.trackingNumber}${trackingLine}`;
    return {
      subject: `你的 ${input.siteName} 订单${zhLabel}`,
      text,
      html: transactionEmailHtml(input.siteName, locale, {
        badge: { text: zhLabel, tone: 'info' },
        heading: `你的订单${zhLabel}`,
        intro: '你的订单物流状态已更新，可随时跟踪配送进度。',
        bodyHtml,
      }),
    };
  }
  const trackingLine = input.trackingUrl ? `\nTrack it: ${input.trackingUrl}` : '';
  const text = `Order ${input.orderId} ${enLabel}.\nCarrier: ${input.carrier}\nTracking number: ${input.trackingNumber}${trackingLine}`;
  return {
    subject: `Your ${input.siteName} order ${enLabel}`,
    text,
    html: transactionEmailHtml(input.siteName, locale, {
      badge: { text: enBadge, tone: 'info' },
      heading: `Your order ${enLabel}`,
      intro: 'Your order has a delivery update. You can track its progress at any time.',
      bodyHtml,
    }),
  };
}

export interface OrderPaidEmailItem {
  name: string;
  variant?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderPaidEmailInput {
  siteName: string;
  orderId: string;
  currency: string;
  items: OrderPaidEmailItem[];
  subtotal?: number;
  shipping?: number;
  discount?: number;
  total?: number;
  createdAt?: string | null;
}

export function orderPaidEmailCopy(locale: MailLocale, input: OrderPaidEmailInput): { subject: string; text: string; html: string } {
  const zh = locale === 'zh-CN';
  const subject = zh ? `${input.siteName} 订单已支付：${input.orderId}` : `${input.siteName} payment confirmed: ${input.orderId}`;
  const totalText = finite(input.total) ? money(input.currency, input.total) : null;
  const text = zh
    ? `你的 ${input.siteName} 订单 ${input.orderId} 已支付成功${totalText ? `，合计 ${totalText}` : ''}，我们会尽快处理。`
    : `Your ${input.siteName} order ${input.orderId} has been paid successfully${totalText ? ` (total ${totalText})` : ''} and is now being processed.`;

  const labels = zh
    ? { orderNo: '订单号', orderTime: '下单时间', items: '商品明细', subtotal: '小计', shipping: '运费', discount: '优惠', total: '总计' }
    : { orderNo: 'Order number', orderTime: 'Order date', items: 'Items', subtotal: 'Subtotal', shipping: 'Shipping', discount: 'Discount', total: 'Total' };

  const infoPairs = [{ label: labels.orderNo, value: input.orderId }];
  const stamp = formatUtcStamp(input.createdAt);
  if (stamp) infoPairs.push({ label: labels.orderTime, value: stamp });
  const sections: string[] = [detailRows(infoPairs)];

  if (input.items.length > 0) {
    const rows = input.items.map((item) => {
      const variantLine = item.variant ? `<br><span style="font-size:12px;color:#8a90a3;">${escapeHtml(item.variant)}</span>` : '';
      const quantity = finite(item.quantity) ? Math.max(1, Math.round(item.quantity)) : 1;
      const unitPart = finite(item.unitPrice) ? `${escapeHtml(money(input.currency, item.unitPrice))} · ` : '';
      const lineTotal = finite(item.totalPrice) ? escapeHtml(money(input.currency, item.totalPrice)) : '';
      return `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #eef0f6;font-size:14px;color:#1d2433;">${escapeHtml(item.name)}${variantLine}</td>
        <td align="right" style="padding:12px 0 12px 16px;border-bottom:1px solid #eef0f6;font-size:12px;color:#8a90a3;white-space:nowrap;">${unitPart}&times; ${quantity}</td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid #eef0f6;font-size:14px;font-weight:600;color:#1d2433;white-space:nowrap;">${lineTotal}</td>
      </tr>`;
    }).join('');
    sections.push(`<div style="margin:24px 0 4px;font-size:12px;font-weight:700;color:#8a90a3;letter-spacing:.08em;">${labels.items}</div>`);
    sections.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>`);
  }

  const summaryRows: string[] = [];
  if (finite(input.subtotal)) summaryRows.push(summaryRow(labels.subtotal, money(input.currency, input.subtotal), false));
  if (finite(input.shipping) && input.shipping > 0) summaryRows.push(summaryRow(labels.shipping, money(input.currency, input.shipping), false));
  if (finite(input.discount) && input.discount > 0) summaryRows.push(summaryRow(labels.discount, `-${money(input.currency, input.discount)}`, false));
  if (totalText) summaryRows.push(summaryRow(labels.total, totalText, true));
  if (summaryRows.length > 0) {
    sections.push(`<div style="margin-top:12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${summaryRows.join('')}</table></div>`);
  }

  return {
    subject,
    text,
    html: transactionEmailHtml(input.siteName, locale, {
      badge: { text: zh ? '支付成功' : 'Payment successful', tone: 'success' },
      heading: zh ? '感谢你的购买！' : 'Thanks for your purchase!',
      intro: zh
        ? '你的订单已完成支付，我们正在尽快处理，后续进展会通过邮件通知你。'
        : 'Your payment went through and your order is being processed. We will email you as soon as there is an update.',
      bodyHtml: sections.join(''),
    }),
  };
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
  const siteName = await nativeSiteName(env);
  const items = Array.isArray(order.items)
    ? order.items
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => ({
        name: typeof item.productName === 'string' && item.productName ? item.productName : 'Item',
        variant: typeof item.variantName === 'string' && item.variantName ? item.variantName : null,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      }))
    : [];
  const currency = typeof order.currency === 'string' && order.currency ? order.currency : 'USD';
  const { subject, text, html } = orderPaidEmailCopy(locale, {
    siteName,
    orderId,
    currency,
    items,
    subtotal: Number(order.subtotalAmount),
    shipping: Number(order.shippingAmount),
    discount: Number(order.discountAmount),
    total: Number(order.totalAmount),
    createdAt: typeof order.createdAt === 'string' ? order.createdAt : null,
  });
  await enqueueEmail(env, {
    orderId, recipient: recipient.email, subject, text, html,
    messageType: 'order.paid', dedupeKey: `order-paid:${orderId}`,
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
  const siteName = await nativeSiteName(env);
  const amount = `${input.currency} ${input.amount.toFixed(2)}`;
  const { subject, text, html } = refundEmailCopy(await orderLocale(env, input.orderId), { ...input, siteName, amount });
  await enqueueEmail(env, {
    orderId: input.orderId, recipient: recipient.email, subject, text, html,
    messageType: 'order.refunded', dedupeKey: `order-refunded:${input.orderId}:${input.amount.toFixed(2)}`,
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
  const siteName = await nativeSiteName(env);
  const amount = `${input.currency} ${input.amount.toFixed(2)}`;
  const { subject, text, html } = commissionEmailCopy(await orderLocale(env, input.orderId), { siteName, orderId: input.orderId, amount, organization: false });
  await enqueueEmail(env, {
    orderId: input.orderId, recipient: recipient.email, subject, text, html,
    messageType: 'affiliate.commission', dedupeKey: `affiliate-commission:${input.commissionId}`,
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
  const siteName = await nativeSiteName(env);
  const amount = `${input.currency} ${input.amount.toFixed(2)}`;
  const { subject, text, html } = commissionEmailCopy(await orderLocale(env, input.orderId), { siteName, orderId: input.orderId, amount, organization: true });
  await enqueueEmail(env, {
    orderId: input.orderId, recipient: recipient.email, subject, text, html,
    messageType: 'affiliate.organization.commission', dedupeKey: `affiliate-organization-commission:${input.commissionId}`,
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
  const siteName = await nativeSiteName(env);
  const { subject, text, html } = shipmentEmailCopy(await orderLocale(env, input.orderId), { ...input, siteName });
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
      const messageId = await sendSmtpEmail(env, { to: row.recipient, subject: row.subject, text: row.text_body, html: row.html_body });
      const sentAt = new Date().toISOString();
      await env.DB.prepare(
        `UPDATE native_email_outbox SET status = 'SENT', sent_at = ?1, last_error = NULL, message_id = ?2, updated_at = ?1 WHERE id = ?3`,
      ).bind(sentAt, messageId, row.id).run();
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
