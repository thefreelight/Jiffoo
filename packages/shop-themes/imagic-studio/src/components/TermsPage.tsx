'use client';

import type { TermsPageProps } from 'shared/src/types/theme';

import { StudioMain, StudioPage, StudioPanel, StudioSectionIntro } from './StudioShell';

const sections = [
  ['Service use', 'The imagic workspace and related storefront content are provided for lawful creator, business, and commercial use within the product rules.'],
  ['Purchases', 'Product purchases, creator packs, and digital assets are delivered according to the checkout and order status information shown inside the workspace.'],
  ['Generation outputs', 'You are responsible for the prompts, uploads, and downstream use of any generated material created with the service.'],
  ['Changes', 'We may update pricing, policy language, and product capabilities as the workspace evolves.'],
];

export function TermsPage(_: TermsPageProps) {
  return (
    <StudioPage activeNav="history">
      <StudioMain className="space-y-6">
        <StudioPanel>
          <StudioSectionIntro
            eyebrow="Terms"
            title="Terms of service for the imagic workspace and storefront."
            body="These terms summarize the rules for using the creator workspace, generation surfaces, and product purchasing flows presented inside the theme."
          />
        </StudioPanel>
        <div className="space-y-4">
          {sections.map(([title, body]) => (
            <StudioPanel key={title}>
              <h2 className="text-2xl font-semibold tracking-[-0.05em] text-[color:var(--imagic-ink)]">{title}</h2>
              <p className="mt-3 text-sm leading-8 text-[color:var(--imagic-ink-soft)]">{body}</p>
            </StudioPanel>
          ))}
        </div>
      </StudioMain>
    </StudioPage>
  );
}
