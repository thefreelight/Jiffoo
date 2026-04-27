import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { PrivacyPageProps } from 'shared/src/types/theme';
import { MarketplaceFrame } from './MarketplaceFrame';
import { getNavCopy } from '../i18n';

function getPrivacyCopy(locale?: string) {
  const copy = getNavCopy(locale).locale;
  if (copy === 'zh-Hant') {
    return {
      title: '隱私政策',
      intro: '這裡是 NavtoAI 的預設隱私文案。正式上線前，請替換成你實際的法律內容。',
      sections: [
        ['資料收集', '我們可能收集帳戶資訊、提交資料、訂單資訊與站內互動紀錄。'],
        ['使用目的', '資料用於維護帳戶、處理提交訂閱、客服支援與站內推薦。'],
        ['第三方服務', '付款、登入與分析服務可能由第三方供應商處理。'],
      ],
    };
  }
  if (copy === 'zh-Hans') {
    return {
      title: '隐私政策',
      intro: '这里是 NavtoAI 的默认隐私文案。正式上线前，请替换成你自己的法律内容。',
      sections: [
        ['数据收集', '我们可能收集账户信息、提交资料、订单信息和站内交互记录。'],
        ['使用目的', '这些数据用于维护账户、处理提交订阅、客户支持和站内推荐。'],
        ['第三方服务', '支付、登录和分析服务可能由第三方供应商处理。'],
      ],
    };
  }
  return {
    title: 'Privacy Policy',
    intro: 'This is placeholder privacy copy for NavtoAI. Replace it with your production legal policy before launch.',
    sections: [
      ['Data collection', 'We may collect account details, submission information, order data, and on-site activity.'],
      ['Purpose', 'Data is used for account operations, paid submissions, support, and directory recommendations.'],
      ['Third-party services', 'Payments, authentication, and analytics may be handled by external vendors.'],
    ],
  };
}

export const PrivacyPage = React.memo(function PrivacyPage({ locale, config }: PrivacyPageProps) {
  const content = getPrivacyCopy(locale);

  return (
    <MarketplaceFrame locale={locale} config={config}>
      <article className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-8 shadow-[var(--navtoai-shadow-sm)]">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--navtoai-primary-soft)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-primary-strong)]">
          <ShieldCheck className="h-4 w-4 text-[var(--navtoai-primary)]" />
          {content.title}
        </div>
        <h1 className="mt-5 text-[clamp(2rem,4vw,3.4rem)] font-black tracking-[-0.06em] text-[var(--navtoai-ink)]">
          {content.title}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--navtoai-copy)]">{content.intro}</p>
        <div className="mt-8 grid gap-4">
          {content.sections.map(([title, body]) => (
            <section key={title} className="rounded-[1.2rem] bg-[var(--navtoai-bg-alt)] p-5">
              <h2 className="text-xl font-black tracking-[-0.03em] text-[var(--navtoai-ink)]">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--navtoai-copy)]">{body}</p>
            </section>
          ))}
        </div>
      </article>
    </MarketplaceFrame>
  );
});

