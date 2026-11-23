import React from 'react';
import { AlertTriangle, CheckCircle2, Copy, Loader2, Package, RefreshCw } from 'lucide-react';
import type { OrderSuccessPageProps } from 'shared/src/types/theme';
import { EsimApiError, getEsimInstallSession, getEsimOrder, getOrderIdFromLocation, type EsimInstallSession } from '../lib/api';
import { formatOrderDate } from '../lib/esim/order-copy';
import { InstallSessionPanel } from './InstallSessionPanel';
import { pickCopy, resolveEsimSiteConfig } from '../site';

function copyToClipboard(value: string) {
  if (!value || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
  navigator.clipboard.writeText(value).catch(() => undefined);
}

function getPollDelay(attempt: number): number {
  if (attempt < 10) return 3000;
  if (attempt < 22) return 10000;
  // Keep polling at a slow cadence — fulfilment can finish minutes later
  // (stock imports, admin redeliver) and the customer is already staring
  // at this page.
  return 30000;
}

export const OrderSuccessPage = React.memo(function OrderSuccessPage({
  orderNumber,
  isVerifying,
  onContinueShopping,
  onViewOrders,
  config,
  order,
  locale,
}: OrderSuccessPageProps & { order?: { id?: string } | null }) {
  const site = resolveEsimSiteConfig(config);
  const t = (copy: { en: string; hans: string; hant: string }) => pickCopy(locale, copy);
  const orderId = order?.id || getOrderIdFromLocation() || '';

  const [installSession, setInstallSession] = React.useState<EsimInstallSession | null>(null);
  const [status, setStatus] = React.useState<EsimInstallSession['status'] | 'idle'>(
    isVerifying ? 'processing' : 'idle'
  );
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  const [attempt, setAttempt] = React.useState(0);
  // Physical-goods orders (e.g. the Bokmoo Card) ship by courier and have no
  // install session; only eSIM orders enter the activation flow below.
  const [orderKind, setOrderKind] = React.useState<'checking' | 'esim' | 'physical'>(
    orderId ? 'checking' : 'esim'
  );

  React.useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    void (async () => {
      try {
        const detail = await getEsimOrder({ baseUrl: site.apiBaseUrl }, orderId);
        if (cancelled) return;
        const items = detail.items || [];
        // BOSS eSIM products carry productKind 'digital' with a boss-* productId;
        // productKind 'esim' does not exist in the catalog.
        const hasEsim = items.some((item) =>
          String((item as { productId?: string }).productId || '').startsWith('boss-')
          || item.productKind === 'esim'
        );
        setOrderKind(hasEsim || items.length === 0 ? 'esim' : 'physical');
      } catch {
        if (!cancelled) setOrderKind('esim');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, site.apiBaseUrl]);

  const loadInstallSession = React.useCallback(async () => {
    if (!orderId || orderKind !== 'esim') return;

    try {
      const session = await getEsimInstallSession(
        {
          baseUrl: site.apiBaseUrl,
        },
        orderId
      );
      setInstallSession(session);
      setStatus(session.status);
      setErrorMessage('');
    } catch (error) {
      // Keep a reason the server actually gave; anything else (network
      // blip, unknown response) falls back to the localized copy below
      // instead of an English developer message on a localized page.
      setErrorMessage(error instanceof EsimApiError ? error.message : '');
      setStatus('failed');
    }
  }, [orderId, site.apiBaseUrl]);

  React.useEffect(() => {
    if (!orderId) return;
    void loadInstallSession();
  }, [loadInstallSession, orderId]);

  React.useEffect(() => {
    if (!orderId || orderKind !== 'esim') return;
    if (status !== 'processing' && status !== 'idle') return;

    const delay = getPollDelay(attempt);

    const timer = window.setTimeout(() => {
      setAttempt((current) => current + 1);
      void loadInstallSession();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [attempt, loadInstallSession, orderId, orderKind, status]);

  const isReady = status === 'ready' || status === 'installed';
  const isPendingPayment = status === 'pending_payment';
  const supportEmail = installSession?.support?.email || site.supportEmail;
  const isPhysical = orderKind === 'physical';
  const isWorking = status === 'processing' || isVerifying;
  // Headline and body per (order kind × session state). Heading and message
  // branch on the same conditions so the two never disagree.
  const heading =
    status === 'failed'
      ? isPhysical
        ? t({ en: 'Shipping needs attention', hans: '发货遇到问题', hant: '出貨遇到問題' })
        : t({ en: 'Provisioning needs attention', hans: '开通遇到问题', hant: '開通遇到問題' })
      : isPendingPayment
        ? t({ en: 'Payment pending', hans: '待支付', hant: '待付款' })
        : status === 'expired'
          ? t({ en: 'Activation expired', hans: '激活码已过期', hant: '啟用碼已過期' })
          : isPhysical
            ? t({ en: 'Your card is being prepared for shipment', hans: '你的 Bokmoo 卡正在备货', hant: '你的 Bokmoo 卡正在備貨' })
            : isWorking
              ? t({ en: 'Preparing your eSIM…', hans: '正在准备你的 eSIM…', hant: '正在準備你的 eSIM…' })
              : t({ en: 'Payment successful!', hans: '支付成功！', hant: '付款成功！' });
  const message =
    status === 'failed'
      ? errorMessage || (isPhysical
        ? t({ en: 'We could not prepare your shipment yet.', hans: '暂时无法为你发货，请稍后重试或联系客服。', hant: '暫時無法為你出貨，請稍後重試或聯繫客服。' })
        : t({ en: 'We could not prepare your install session yet.', hans: '暂时无法生成你的 eSIM 安装信息，请稍后重试或联系客服。', hant: '暫時無法產生你的 eSIM 安裝資訊，請稍後重試或聯繫客服。' }))
      : isPendingPayment
        ? (isPhysical
          ? t({ en: 'Complete payment and we will start preparing your card for delivery.', hans: '完成支付后，我们就开始为你备货发货。', hant: '完成付款後，我們就開始為你備貨出貨。' })
          : t({ en: 'Complete payment to unlock your eSIM install details.', hans: '完成支付后即可查看 eSIM 安装信息。', hant: '完成付款後即可查看 eSIM 安裝資訊。' }))
        : isPhysical
          ? t({
              en: 'Your order is paid. We are packing your Bokmoo Card now — you will get a shipping confirmation with tracking, and it should arrive within a few business days.',
              hans: '订单已支付，我们正在打包你的 Bokmoo 卡——发货后你会收到带运单号的通知，一般几个工作日内送达。',
              hant: '訂單已付款，我們正在打包你的 Bokmoo 卡——出貨後你會收到帶運單號的通知，一般幾個工作日內送達。',
            })
          : status === 'expired'
            ? t({ en: 'Your activation session expired before installation completed.', hans: '安装码在安装完成前已过期。', hant: '安裝碼在安裝完成前已過期。' })
            : isWorking
              ? t({ en: 'Your order is paid. We are preparing the install session now.', hans: '订单已支付，正在为你准备安装信息。', hant: '訂單已付款，正在為你準備安裝資訊。' })
              : status === 'installed'
                ? t({ en: 'Your package has been added to your eSIM.', hans: '套餐已加到你的 eSIM 上。', hant: '方案已加到你的 eSIM 上。' })
                : t({ en: 'Your eSIM is ready to install.', hans: '你的 eSIM 已就绪，可以安装了。', hant: '你的 eSIM 已就緒，可以安裝了。' });
  return (
    <div className="min-h-screen bg-[var(--esim-bg)] px-4 pb-24 pt-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[520px]">
        <div className="rounded-[1.6rem] border border-[var(--esim-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--esim-bg-elevated)_96%,white),var(--esim-bg-elevated))] p-6 text-center shadow-[var(--esim-shadow)] sm:p-8">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-[color:color-mix(in_oklab,var(--esim-gold)_36%,transparent)] bg-[color:color-mix(in_oklab,var(--esim-gold)_10%,transparent)] text-[var(--esim-gold)]">
            {orderKind === 'physical'
              ? status === 'failed'
                ? <AlertTriangle className="h-11 w-11" />
                : <Package className="h-10 w-10" />
              : status === 'failed' || status === 'expired' || isPendingPayment
                ? <AlertTriangle className="h-11 w-11" />
                : status === 'processing' || isVerifying
                  ? <Loader2 className="h-11 w-11 animate-spin" />
                  : <CheckCircle2 className="h-11 w-11" />}
          </div>

          <h1 className="mt-8 text-[clamp(2.2rem,4vw,3.6rem)] font-semibold tracking-[-0.05em] text-[var(--esim-ink)]">
            {heading}
          </h1>

          <p className="mt-4 text-base leading-8 text-[var(--esim-copy)]">
            {message}
          </p>

          {installSession?.packageTitle ? (
            <div className="mx-auto mt-8 max-w-[320px] rounded-[1rem] border border-[var(--esim-line)] bg-[var(--esim-bg)] p-4 text-left">
              <div className="flex gap-3">
                <div className="h-16 w-20 overflow-hidden rounded-[0.8rem] bg-[linear-gradient(160deg,#924a57_0%,#261922_44%,#0f1115_100%)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--esim-ink)]">{installSession.packageTitle}</p>
                  <p className="mt-1 text-xs text-[var(--esim-copy-soft)]">{installSession.smdpAddress || t({ en: 'eSIM activation', hans: 'eSIM 激活', hant: 'eSIM 啟用' })}</p>
                  <p className="mt-1 text-xs text-[var(--esim-copy-soft)]">
                    {installSession.expiresAt
                      ? t({ en: 'Expires', hans: '有效期至', hant: '有效期至' }) + ' ' + formatOrderDate(installSession.expiresAt, locale, false)
                      : t({ en: 'Ready to install', hans: '可立即安装', hant: '可立即安裝' })}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {isReady && installSession ? (
            <InstallSessionPanel className="mt-8" session={installSession} locale={locale} />
          ) : null}

          <div className="mt-8 space-y-3">
            {orderKind === 'physical' ? (
              <button
                onClick={onViewOrders}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.95rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--esim-gold)_82%,white),color-mix(in_oklab,var(--esim-gold)_68%,black))] px-5 text-sm font-semibold text-[var(--esim-bg)]"
                type="button"
              >
                {t({ en: 'Track your order', hans: '查看物流', hant: '查看物流' })}
              </button>
            ) : (
              <button
                onClick={isReady ? onViewOrders : () => void loadInstallSession()}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.95rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--esim-gold)_82%,white),color-mix(in_oklab,var(--esim-gold)_68%,black))] px-5 text-sm font-semibold text-[var(--esim-bg)]"
                type="button"
              >
                {isReady
                  ? t({ en: 'View eSIM details', hans: '查看 eSIM 详情', hant: '查看 eSIM 詳情' })
                  : t({ en: 'Refresh status', hans: '刷新状态', hant: '重新整理狀態' })}
                {!isReady ? <RefreshCw className="h-4 w-4" /> : null}
              </button>
            )}
            <button
              onClick={onContinueShopping}
              className="flex min-h-12 w-full items-center justify-center rounded-[0.95rem] border border-[var(--esim-line)] bg-[var(--esim-bg)] px-5 text-sm font-medium text-[var(--esim-ink)]"
              type="button"
            >
              {t({ en: 'Back to store', hans: '返回商店', hant: '返回商店' })}
            </button>
          </div>

          <div className="mt-6 space-y-2 text-sm text-[var(--esim-copy-soft)]">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--esim-line)] px-4 py-2">
              {t({ en: 'Order reference', hans: '订单编号', hant: '訂單編號' })}
              <code className="font-semibold text-[var(--esim-ink)]">{orderNumber}</code>
              <button
                onClick={() => copyToClipboard(orderNumber)}
                className="text-[var(--esim-gold)]"
                type="button"
                aria-label={t({ en: 'Copy order reference', hans: '复制订单编号', hant: '複製訂單編號' })}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>

            <p>
              {t({ en: 'Support:', hans: '客服：', hant: '客服：' })} <a className="text-[var(--esim-ink)] underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});
