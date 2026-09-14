import React from 'react';
import { FileText } from 'lucide-react';
import type { TermsPageProps } from 'shared/src/types/theme';
import { MarketplaceFrame } from './MarketplaceFrame';
import { getNavCopy } from '../i18n';

function getTermsCopy(locale?: string) {
  const copy = getNavCopy(locale).locale;
  if (copy === 'zh-Hant') {
    return {
      title: '服務條款',
      intro: '這裡是 NavtoAI 的預設條款文案。正式營運前，請替換成你的完整法律條款。',
      sections: [
        ['提交與審核', '所有付費提交仍需通過人工審核，付款不代表一定上架。'],
        ['訂閱與取消', '提交方案為訂閱制，到期後若不續費，付費曝光將停止。'],
        ['內容責任', '提交者需確保產品資訊、商標與網址內容真實且可合法展示。'],
      ],
    };
  }
  if (copy === 'zh-Hans') {
    return {
      title: '服务条款',
      intro: '这里是 NavtoAI 的默认条款文案。正式运营前，请替换成你自己的完整法律条款。',
      sections: [
        ['提交与审核', '所有付费提交仍需通过人工审核，付款不代表一定上架。'],
        ['订阅与取消', '提交方案为订阅制，到期不续费后，付费曝光将停止。'],
        ['内容责任', '提交者需要保证产品信息、商标和网址内容真实且可合法展示。'],
      ],
    };
  }
  return {
    title: 'Terms of Service',
    intro: 'This is placeholder terms copy for NavtoAI. Replace it with your full legal terms before launch.',
    sections: [
      ['Submissions and review', 'All paid submissions still require editorial approval. Payment does not guarantee publication.'],
      ['Subscriptions and cancellation', 'Submission plans are subscription-based. If a plan expires, paid placement ends.'],
      ['Content responsibility', 'Submitters are responsible for the legality and accuracy of their product, brand, and URL content.'],
    ],
  };
}

export const TermsPage = React.memo(function TermsPage({ locale, config }: TermsPageProps) {
  const content = getTermsCopy(locale);

  return (
    <MarketplaceFrame locale={locale} config={config}>
      <article className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-8 shadow-[var(--navtoai-shadow-sm)]">
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--navtoai-primary-soft)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-primary-strong)]">
          <FileText className="h-4 w-4 text-[var(--navtoai-primary)]" />
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
