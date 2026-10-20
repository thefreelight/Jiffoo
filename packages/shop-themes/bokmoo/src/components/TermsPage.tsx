import React from 'react';
import type { TermsPageProps } from 'shared/src/types/theme';
import { pickCopy } from '../site';

const sections = [
  {
    en: { title: 'Acceptance of Terms', body: 'By accessing or using the BOKMOO website and services, you agree to be bound by these Terms of Service.' },
    hans: { title: '接受条款', body: '访问或使用 BOKMOO 网站与服务，即表示你同意本服务条款。' },
    hant: { title: '接受條款', body: '訪問或使用 BOKMOO 網站與服務，即表示你同意本服務條款。' },
  },
  {
    en: { title: 'Use of Services', body: 'You agree to use our services only for lawful purposes and in accordance with these Terms.' },
    hans: { title: '使用服务', body: '你同意仅出于合法目的使用我们的服务，并遵守本条款。' },
    hant: { title: '使用服務', body: '你同意僅出於合法目的使用我們的服務，並遵守本條款。' },
  },
  {
    en: { title: 'Purchases and Payments', body: 'All payments are final and non-refundable unless required by law.' },
    hans: { title: '购买与支付', body: '除非法律要求，所有付款均为最终付款，不予退款。' },
    hant: { title: '購買與支付', body: '除非法律要求，所有付款均為最終付款，不予退款。' },
  },
  {
    en: { title: 'Limitation of Liability', body: 'BOKMOO is not liable for any indirect, incidental, or consequential damages.' },
    hans: { title: '责任限制', body: 'BOKMOO 对任何间接、附带或后果性损害不承担责任。' },
    hant: { title: '責任限制', body: 'BOKMOO 對任何間接、附帶或後果性損害不承擔責任。' },
  },
];

export const TermsPage = React.memo(function TermsPage({ locale }: TermsPageProps) {
  const t = (copy: { en: string; hans: string; hant: string }) => pickCopy(locale, copy);
  return (
    <div className="min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-24 pt-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[980px] rounded-[1.6rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8">
        <h1 className="text-[clamp(2.2rem,4vw,3.5rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]">
          {t({ en: 'Terms of Service', hans: '服务条款', hant: '服務條款' })}
        </h1>
        <p className="mt-3 text-sm text-[var(--bokmoo-copy-soft)]">Last updated: April 15, 2024</p>

        <div className="mt-8 space-y-5">
          {sections.map((section, index) => {
            const copy = locale === 'zh-Hans' ? section.hans : locale === 'zh-Hant' ? section.hant : section.en;
            return (
            <section
              key={section.en.title}
              className="rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-5"
            >
              <p className="text-base font-medium text-[var(--bokmoo-ink)]">
                {index + 1}. {copy.title}
              </p>
              <p className="mt-3 text-sm leading-7 text-[var(--bokmoo-copy)]">{copy.body}</p>
            </section>
          );})}
        </div>
      </div>
    </div>
  );
});
