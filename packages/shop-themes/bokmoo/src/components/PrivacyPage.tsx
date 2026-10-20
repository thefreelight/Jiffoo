import React from 'react';
import type { PrivacyPageProps } from 'shared/src/types/theme';
import { pickCopy } from '../site';

const sections = [
  {
    en: { title: 'Information We Collect', body: 'We collect information you provide directly to us, such as when you create an account or make a purchase.' },
    hans: { title: '我们收集的信息', body: '我们收集你直接提供的信息，例如创建账户或购买时提供的信息。' },
    hant: { title: '我們收集的資訊', body: '我們收集你直接提供的資訊，例如建立帳戶或購買時提供的資訊。' },
  },
  {
    en: { title: 'How We Use Information', body: 'We use the information to provide, maintain, and improve our services.' },
    hans: { title: '我们如何使用信息', body: '我们使用这些信息来提供、维护和改进我们的服务。' },
    hant: { title: '我們如何使用資訊', body: '我們使用這些資訊來提供、維護和改進我們的服務。' },
  },
  {
    en: { title: 'Data Protection', body: 'We implement appropriate security measures to protect your data.' },
    hans: { title: '数据保护', body: '我们采取适当的安全措施来保护你的数据。' },
    hant: { title: '資料保護', body: '我們採取適當的安全措施來保護你的資料。' },
  },
  {
    en: { title: 'Your Rights', body: 'You have the right to access, update, or delete your personal information.' },
    hans: { title: '你的权利', body: '你有权访问、更新或删除你的个人信息。' },
    hant: { title: '你的權利', body: '你有權存取、更新或刪除你的個人資訊。' },
  },
];

export const PrivacyPage = React.memo(function PrivacyPage({ locale }: PrivacyPageProps) {
  const t = (copy: { en: string; hans: string; hant: string }) => pickCopy(locale, copy);
  return (
    <div className="min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-24 pt-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[980px] rounded-[1.6rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8">
        <h1 className="text-[clamp(2.2rem,4vw,3.5rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]">
          {t({ en: 'Privacy Policy', hans: '隐私政策', hant: '隱私政策' })}
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
