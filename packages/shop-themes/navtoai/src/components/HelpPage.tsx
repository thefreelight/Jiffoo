import React from 'react';
import { ArrowRight, BadgeCheck, Compass, CreditCard, ShieldCheck, Sparkles } from 'lucide-react';
import type { HelpPageProps } from 'shared/src/types/theme';
import { MarketplaceFrame } from './MarketplaceFrame';
import { getNavCopy } from '../i18n';

function getHelpCopy(locale?: string) {
  const copy = getNavCopy(locale);

  if (copy.locale === 'zh-Hant') {
    return {
      eyebrow: '提交指南',
      title: '為什麼 NavtoAI 的提交是收費訂閱，而不是免費收錄。',
      body:
        '我們希望目錄保持乾淨、可信與有判斷力，所以提交流程結合付費門檻、人工審核與後續維護。',
      processTitle: '收錄流程',
      process: [
        '選擇適合的訂閱方案並提交項目資料。',
        '我們會審核產品成熟度、分類匹配度與是否值得收錄。',
        '通過後使用站點既有支付插件完成付款，再正式上架。',
      ],
      whyTitle: '付費提交包含什麼',
      whyItems: [
        '避免站內被大量低質量工具稀釋。',
        '讓首頁與分類頁保持策展感與可讀性。',
        '提供持續資料更新與人工維護。',
      ],
      faqTitle: '常見問題',
      faqs: [
        {
          question: '這是一次性上架費嗎？',
          answer: '不是。這是訂閱制，因為我們持續維護分類、內容與曝光位置。',
        },
        {
          question: '付款後一定會上架嗎？',
          answer: '不會。仍需通過審核，我們只收錄符合站內標準的項目。',
        },
        {
          question: '主題會自己處理付款嗎？',
          answer: '不會。付款流程應交給站點已安裝的支付插件，例如 Stripe。',
        },
        {
          question: '能否取消？',
          answer: '可以，取消後到期不續費，項目會從付費曝光池移除。',
        },
      ],
      sideTitle: '想要更好曝光的項目，應該透過付費提交流程申請。',
      cta: '查看提交方案',
    };
  }

  if (copy.locale === 'zh-Hans') {
    return {
      eyebrow: '提交指南',
      title: '为什么 NavtoAI 的提交是收费订阅，而不是免费收录。',
      body:
        '我们希望目录保持干净、可信和有判断力，所以提交流程结合付费门槛、人工审核与后续维护。',
      processTitle: '收录流程',
      process: [
        '选择合适的订阅方案并提交项目资料。',
        '我们会审核产品成熟度、分类匹配度以及是否值得收录。',
        '通过后使用站点现有支付插件完成付款，再正式上架。',
      ],
      whyTitle: '付费提交包含什么',
      whyItems: [
        '避免站内被大量低质量工具稀释。',
        '让首页和分类页保持策展感与可读性。',
        '提供持续资料更新与人工维护。',
      ],
      faqTitle: '常见问题',
      faqs: [
        {
          question: '这是一次性上架费吗？',
          answer: '不是。这是订阅制，因为我们持续维护分类、内容和曝光位置。',
        },
        {
          question: '付款后一定会上架吗？',
          answer: '不会。仍需通过审核，我们只收录符合站内标准的项目。',
        },
        {
          question: '主题会自己处理支付吗？',
          answer: '不会。付款流程应该交给站点已安装的支付插件，例如 Stripe。',
        },
        {
          question: '可以取消吗？',
          answer: '可以，取消后到期不续费，项目会从付费曝光池移除。',
        },
      ],
      sideTitle: '想获得更好曝光的项目，应该通过付费提交流程申请。',
      cta: '查看提交方案',
    };
  }

  return {
    eyebrow: 'Submission guide',
    title: 'Why NavtoAI uses paid subscriptions instead of free project submissions.',
    body:
      'We want the directory to stay clean, credible, and selective, so submissions combine pricing gates, editorial review, and ongoing maintenance.',
    processTitle: 'Review flow',
    process: [
      'Choose a plan and send your project details.',
      'We review product maturity, category fit, and editorial value.',
      'Once approved, payment goes through your installed plugin and we prepare the listing.',
    ],
    whyTitle: 'What paid submissions cover',
    whyItems: [
      'Prevents the directory from being diluted by low-quality listings.',
      'Keeps homepage and category surfaces feeling curated and readable.',
      'Supports ongoing updates and editorial maintenance.',
    ],
    faqTitle: 'FAQ',
    faqs: [
      {
        question: 'Is this a one-time listing fee?',
        answer: 'No. It is a subscription because we continuously maintain categories, copy, and placement.',
      },
      {
        question: 'Does payment guarantee publication?',
        answer: 'No. Projects still need to pass editorial review before they go live.',
      },
      {
        question: 'Does the theme process payments directly?',
        answer: 'No. Payments should stay with installed payment plugins, such as Stripe.',
      },
      {
        question: 'Can I cancel later?',
        answer: 'Yes. When a subscription ends, the project leaves the paid placement pool.',
      },
    ],
    sideTitle: 'Projects that want better placement should apply through the paid submission flow.',
    cta: 'See submission plans',
  };
}

export const HelpPage = React.memo(function HelpPage({ locale, config, onNavigateToContact }: HelpPageProps) {
  const content = getHelpCopy(locale);
  const navigateToContact = React.useCallback(() => {
    if (onNavigateToContact) {
      onNavigateToContact();
      return;
    }

    if (typeof window !== 'undefined') {
      window.location.assign('/contact');
    }
  }, [onNavigateToContact]);

  return (
    <MarketplaceFrame activeItem="resources" locale={locale} config={config}>
      <div className="space-y-6">
        <section className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(244,246,255,0.96))] p-6 shadow-[var(--navtoai-shadow-sm)] sm:p-8">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--navtoai-primary-soft)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-primary-strong)]">
              <Compass className="h-4 w-4 text-[var(--navtoai-primary)]" />
              {content.eyebrow}
            </div>
            <h1 className="mt-4 text-[clamp(2.1rem,4.4vw,3.8rem)] font-black leading-[0.97] tracking-[-0.06em] text-[var(--navtoai-ink)]">
              {content.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--navtoai-copy)]">{content.body}</p>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <article className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-6 shadow-[var(--navtoai-shadow-sm)]">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-primary-strong)]">
              <Sparkles className="h-4 w-4 text-[var(--navtoai-primary)]" />
              {content.processTitle}
            </div>
            <div className="mt-5 grid gap-4">
              {content.process.map((item, index) => (
                <div key={item} className="rounded-[1.1rem] bg-[var(--navtoai-bg-alt)] p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--navtoai-primary-strong)]">
                    0{index + 1}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--navtoai-copy)]">{item}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-6 shadow-[var(--navtoai-shadow-sm)]">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-primary-strong)]">
              <CreditCard className="h-4 w-4 text-[var(--navtoai-primary)]" />
              {content.whyTitle}
            </div>
            <div className="mt-5 grid gap-3">
              {content.whyItems.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-[1.1rem] bg-[var(--navtoai-bg-alt)] p-4">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-[var(--navtoai-primary)]" />
                  <p className="text-sm leading-6 text-[var(--navtoai-copy)]">{item}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <article className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-6 shadow-[var(--navtoai-shadow-sm)]">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-primary-strong)]">
              <BadgeCheck className="h-4 w-4 text-[var(--navtoai-primary)]" />
              {content.faqTitle}
            </div>
            <div className="mt-5 grid gap-4">
              {content.faqs.map((faq) => (
                <div key={faq.question} className="rounded-[1.15rem] bg-[var(--navtoai-bg-alt)] p-4">
                  <h3 className="text-lg font-black tracking-[-0.03em] text-[var(--navtoai-ink)]">
                    {faq.question}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--navtoai-copy)]">{faq.answer}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[linear-gradient(155deg,rgba(106,108,255,0.96),rgba(123,201,255,0.82))] p-6 text-white shadow-[var(--navtoai-shadow)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/76">NavtoAI</p>
            <h2 className="mt-4 text-2xl font-black leading-8 tracking-[-0.04em]">
              {content.sideTitle}
            </h2>
            <button
              type="button"
              onClick={navigateToContact}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/16 px-4 py-3 text-sm font-semibold text-white backdrop-blur"
            >
              {content.cta}
              <ArrowRight className="h-4 w-4" />
            </button>
          </article>
        </section>
      </div>
    </MarketplaceFrame>
  );
});
