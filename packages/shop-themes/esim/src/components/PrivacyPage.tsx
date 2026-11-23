import React from 'react';
import type { PrivacyPageProps } from 'shared/src/types/theme';
import { type ThemeCopy, pickCopy } from '../site';

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
  const t = (copy: ThemeCopy) => pickCopy(locale, copy);
  return (
    <div className="min-h-screen bg-[var(--esim-bg)] px-4 pb-24 pt-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[980px] rounded-[1.6rem] border border-[var(--esim-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--esim-bg-elevated)_96%,white),var(--esim-bg-elevated))] p-6 shadow-[var(--esim-shadow)] sm:p-8">
        <h1 className="text-[clamp(2.2rem,4vw,3.5rem)] font-semibold tracking-[-0.05em] text-[var(--esim-ink)]">
          {t({ en: 'Privacy Policy', hans: '隐私政策', hant: '隱私政策' })}
        </h1>
        <p className="mt-3 text-sm text-[var(--esim-copy-soft)]">{t({ en: 'Last updated: April 15, 2024', hans: '最后更新：2024 年 4 月 15 日', hant: '最後更新：2024 年 4 月 15 日' })}</p>

        <div className="mt-8 space-y-5">
          {sections.map((section, index) => {
            // zh reads the inline Chinese copy; ja/ko/fr/de come from the catalog by English source.
            const title = pickCopy(locale, { en: section.en.title, hans: section.hans.title, hant: section.hant.title });
            const body = pickCopy(locale, { en: section.en.body, hans: section.hans.body, hant: section.hant.body });
            return (
            <section
              key={section.en.title}
              className="rounded-[1rem] border border-[var(--esim-line)] bg-[var(--esim-bg)] p-5"
            >
              <p className="text-base font-medium text-[var(--esim-ink)]">
                {index + 1}. {title}
              </p>
              <p className="mt-3 text-sm leading-7 text-[var(--esim-copy)]">{body}</p>
            </section>
          );})}
        </div>
      </div>
    </div>
  );
});
