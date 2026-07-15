import React from 'react';
import type { TermsPageProps } from 'shared/src/types/theme';

const sections = [
  ['Acceptance of Terms', 'By accessing or using the BOKMOO website and services, you agree to be bound by these Terms of Service.'],
  ['Use of Services', 'You agree to use our services only for lawful purposes and in accordance with these Terms.'],
  ['Purchases and Payments', 'All payments are final and non-refundable unless required by law.'],
  ['Limitation of Liability', 'BOKMOO is not liable for any indirect, incidental, or consequential damages.'],
];

export const TermsPage = React.memo(function TermsPage(_props: TermsPageProps) {
  return (
    <div className="min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-24 pt-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[980px] rounded-[1.6rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8">
        <h1 className="text-[clamp(2.2rem,4vw,3.5rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]">
          Terms of Service
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
