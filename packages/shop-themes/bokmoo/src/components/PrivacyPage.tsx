import React from 'react';
import type { PrivacyPageProps } from 'shared/src/types/theme';

const sections = [
  ['Information We Collect', 'We collect information you provide directly to us, such as when you create an account or make a purchase.'],
  ['How We Use Information', 'We use the information to provide, maintain, and improve our services.'],
  ['Data Protection', 'We implement appropriate security measures to protect your data.'],
  ['Your Rights', 'You have the right to access, update, or delete your personal information.'],
];

export const PrivacyPage = React.memo(function PrivacyPage(_props: PrivacyPageProps) {
  return (
    <div className="min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-24 pt-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[980px] rounded-[1.6rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8">
        <h1 className="text-[clamp(2.2rem,4vw,3.5rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-[var(--bokmoo-copy-soft)]">Last updated: April 15, 2024</p>

        <div className="mt-8 space-y-5">
          {sections.map(([title, body], index) => (
            <section
              key={title}
              className="rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-5"
            >
              <p className="text-base font-medium text-[var(--bokmoo-ink)]">
                {index + 1}. {title}
              </p>
              <p className="mt-3 text-sm leading-7 text-[var(--bokmoo-copy)]">{body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
});
