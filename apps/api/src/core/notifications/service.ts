import { Prisma } from '@prisma/client';
import { env } from '@/config/env';
import { prisma } from '@/config/database';

export type NotificationTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const notificationLocales = ['en', 'zh-Hans', 'zh-Hant'] as const;
export type NotificationLocale = typeof notificationLocales[number];
export type NotificationType =
  | 'email_verification'
  | 'password_reset'
  | 'staff_invite'
  | 'order_confirmation'
  | 'payment_received'
  | 'shipped'
  | 'cancelled';

type Copy = { subject: string; body: string; linkLabel?: string };
type LocaleCopy = Record<NotificationType, Copy>;

const translations: Record<NotificationLocale, LocaleCopy> = {
  en: {
    email_verification: { subject: 'Verify your email', body: 'Hello {name}, verify your email with code {code}.', linkLabel: 'Verify email' },
    password_reset: { subject: 'Reset your password', body: 'Hello {name}, use this link to reset your password.', linkLabel: 'Reset password' },
    staff_invite: { subject: 'Staff invitation', body: 'Hello {name}, you have been invited to the staff team.', linkLabel: 'Activate account' },
    order_confirmation: { subject: 'Order confirmation', body: 'Order {orderId} is confirmed. {instructions}' },
    payment_received: { subject: 'Payment received', body: 'We received payment for order {orderId}.' },
    shipped: { subject: 'Order shipped', body: 'Order {orderId} has shipped.' },
    cancelled: { subject: 'Order cancelled', body: 'Order {orderId} was cancelled. {reason}' },
  },
  'zh-Hans': {
    email_verification: { subject: '验证邮箱', body: '{name}，请使用验证码 {code} 验证邮箱。', linkLabel: '验证邮箱' },
    password_reset: { subject: '重置密码', body: '{name}，请使用此链接重置密码。', linkLabel: '重置密码' },
    staff_invite: { subject: '员工邀请', body: '{name}，您已获邀加入管理团队。', linkLabel: '激活账户' },
    order_confirmation: { subject: '订单确认', body: '订单 {orderId} 已确认。{instructions}' },
    payment_received: { subject: '已收到付款', body: '我们已收到订单 {orderId} 的付款。' },
    shipped: { subject: '订单已发货', body: '订单 {orderId} 已发货。' },
    cancelled: { subject: '订单已取消', body: '订单 {orderId} 已取消。{reason}' },
  },
  'zh-Hant': {
    email_verification: { subject: '驗證電子郵件', body: '{name}，請使用驗證碼 {code} 驗證電子郵件。', linkLabel: '驗證電子郵件' },
    password_reset: { subject: '重設密碼', body: '{name}，請使用此連結重設密碼。', linkLabel: '重設密碼' },
    staff_invite: { subject: '員工邀請', body: '{name}，您已獲邀加入管理團隊。', linkLabel: '啟用帳戶' },
    order_confirmation: { subject: '訂單確認', body: '訂單 {orderId} 已確認。{instructions}' },
    payment_received: { subject: '已收到付款', body: '我們已收到訂單 {orderId} 的付款。' },
    shipped: { subject: '訂單已出貨', body: '訂單 {orderId} 已出貨。' },
    cancelled: { subject: '訂單已取消', body: '訂單 {orderId} 已取消。{reason}' },
  },
};

export function normalizeNotificationLocale(value: unknown): NotificationLocale | null {
  if (typeof value !== 'string') return null;
  if (notificationLocales.includes(value as NotificationLocale)) return value as NotificationLocale;
  if (/^zh-(TW|HK|MO|Hant)/i.test(value)) return 'zh-Hant';
  if (/^zh/i.test(value)) return 'zh-Hans';
  if (/^en/i.test(value)) return 'en';
  return null;
}

export function negotiateNotificationLocale(header: string | undefined): NotificationLocale | null {
  if (!header) return null;
  const ranges = header.split(',').map((part) => {
    const [tag, quality] = part.trim().split(';q=');
    return { tag, quality: quality === undefined ? 1 : Number(quality) };
  }).sort((a, b) => b.quality - a.quality);
  for (const range of ranges) {
    if (range.quality > 0) {
      const locale = normalizeNotificationLocale(range.tag);
      if (locale) return locale;
    }
  }
  return null;
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] || character);

function absoluteLogoUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname ? value : null;
  } catch {
    return null;
  }
}

export function renderNotification(
  type: NotificationType,
  locale: NotificationLocale,
  storeName: string,
  logo: string | null,
  values: { name?: string; orderId?: string; instructions?: string; reason?: string },
  hasLink = false,
  hasCode = false,
): { subject: string; html: string; text: string } {
  const copy = translations[locale][type];
  const replacements: Record<string, string> = {
    name: values.name || '',
    orderId: values.orderId || '',
    instructions: values.instructions || '',
    reason: values.reason || '',
    code: hasCode ? '{{secret.code}}' : '',
  };
  const body = copy.body.replace(/\{(\w+)\}/g, (_, key: string) => replacements[key] || '');
  const link = hasLink ? `\n${copy.linkLabel}: {{secret.link}}` : '';
  const text = `${storeName}\n\n${body}${link}`;
  const logoUrl = absoluteLogoUrl(logo);
  const html = `<html><body>${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(storeName)}">` : ''}<h1>${escapeHtml(storeName)}</h1><p>${escapeHtml(body).replace(/\n/g, '<br>')}</p>${hasLink ? `<a href="{{secret.link}}">${escapeHtml(copy.linkLabel || '')}</a>` : ''}</body></html>`;
  return { subject: `${storeName}: ${copy.subject}`, html, text };
}

export async function createNotification(
  tx: NotificationTransaction,
  type: NotificationType,
  recipientUserId: string,
  toAddress: string,
  values: { name?: string; orderId?: string; instructions?: string; reason?: string },
  options: { secret?: { link?: string; code?: string }; relatedType?: string; relatedId?: string; resentFromId?: string } = {},
) {
  const [user, system] = await Promise.all([
    tx.user.findUniqueOrThrow({ where: { id: recipientUserId }, select: { locale: true } }),
    tx.systemSettings.findUnique({ where: { id: 'system' }, select: { settings: true } }),
  ]);
  const settings = system?.settings && typeof system.settings === 'object' && !Array.isArray(system.settings)
    ? system.settings as Record<string, unknown> : {};
  const locale = normalizeNotificationLocale(user.locale)
    || normalizeNotificationLocale(settings['localization.locale']) || 'en';
  const storeName = typeof settings['branding.platform_name'] === 'string' && settings['branding.platform_name'].trim()
    ? settings['branding.platform_name'] : 'Jiffoo Mall';
  const logo = typeof settings['branding.logo'] === 'string' ? settings['branding.logo'] : null;
  const rendered = renderNotification(type, locale, storeName, logo, values, Boolean(options.secret?.link), Boolean(options.secret?.code));
  return tx.notification.create({
    data: {
      type, recipientUserId, toAddress, locale, ...rendered,
      secretJson: options.secret || Prisma.JsonNull,
      relatedType: options.relatedType, relatedId: options.relatedId, resentFromId: options.resentFromId,
    },
  });
}

export async function createOrderNotification(
  tx: NotificationTransaction,
  type: Extract<NotificationType, 'order_confirmation' | 'payment_received' | 'shipped' | 'cancelled'>,
  orderId: string,
  values: { instructions?: string; reason?: string } = {},
): Promise<void> {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { userId: true, customerEmail: true, user: { select: { email: true } } },
  });
  await createNotification(tx, type, order.userId, order.customerEmail || order.user.email, {
    orderId, ...values,
  }, { relatedType: 'order', relatedId: orderId });
}

export function verificationLink(token: string): string {
  return `${env.STOREFRONT_URL.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
}
