import React from 'react';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import type { OrderSuccessPageProps } from 'shared/src/types/theme';
import { MarketplaceFrame } from './MarketplaceFrame';
import { getNavCopy } from '../i18n';

function getSuccessCopy(locale?: string) {
  const resolved = getNavCopy(locale).locale;
  if (resolved === 'zh-Hant') {
    return {
      title: '訂單已建立。',
      body: '付款確認後，你的提交方案或購買內容會出現在訂單檔案中。',
      reference: '訂單編號',
      viewOrders: '查看訂單',
      continue: '繼續探索',
      verifying: '驗證中...',
    };
  }
  if (resolved === 'zh-Hans') {
    return {
      title: '订单已创建。',
      body: '付款确认后，你购买的提交方案或内容会出现在订单记录中。',
      reference: '订单编号',
      viewOrders: '查看订单',
      continue: '继续探索',
      verifying: '验证中...',
    };
  }
  return {
    title: 'Order created successfully.',
    body: 'Once payment is confirmed, your plan or purchased access will appear inside the order archive.',
    reference: 'Order reference',
    viewOrders: 'View orders',
    continue: 'Keep browsing',
    verifying: 'Verifying...',
  };
}

export const OrderSuccessPage = React.memo(function OrderSuccessPage({
  orderNumber,
  isVerifying,
  locale,
  config,
  onContinueShopping,
  onViewOrders,
}: OrderSuccessPageProps) {
  const copy = getSuccessCopy(locale);

  return (
    <MarketplaceFrame locale={locale} config={config}>
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="max-w-2xl rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-10 text-center shadow-[var(--navtoai-shadow-sm)]">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-[rgba(85,220,160,0.16)] text-emerald-600">
            {isVerifying ? <Loader2 className="h-10 w-10 animate-spin" /> : <CheckCircle2 className="h-10 w-10" />}
          </div>
          <h1 className="mt-6 text-[clamp(2.2rem,4vw,3.4rem)] font-black tracking-[-0.06em] text-[var(--navtoai-ink)]">
            {isVerifying ? copy.verifying : copy.title}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-[var(--navtoai-copy)]">{copy.body}</p>
          <div className="mx-auto mt-8 inline-flex items-center gap-3 rounded-full border border-[var(--navtoai-line)] bg-[var(--navtoai-bg-alt)] px-5 py-3 text-sm font-semibold text-[var(--navtoai-ink)]">
            <span className="text-[var(--navtoai-copy-soft)]">{copy.reference}</span>
            <code>{orderNumber}</code>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={onViewOrders}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--navtoai-primary),var(--navtoai-primary-strong))] px-5 py-3 text-sm font-semibold text-white"
            >
              {copy.viewOrders}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onContinueShopping}
              className="inline-flex items-center justify-center rounded-full border border-[var(--navtoai-line)] bg-white px-5 py-3 text-sm font-semibold text-[var(--navtoai-ink)]"
            >
              {copy.continue}
            </button>
          </div>
        </div>
      </div>
    </MarketplaceFrame>
  );
});
