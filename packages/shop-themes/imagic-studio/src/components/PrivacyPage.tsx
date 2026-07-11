'use client';

import type { PrivacyPageProps } from 'shared/src/types/theme';

import { StudioMain, StudioPage, StudioPanel, StudioSectionIntro } from './StudioShell';

const sections = [
  ['Information we collect', 'We collect the account, upload, and purchase information needed to run the imagic workspace, process payments, and support creator-side generation flows.'],
  ['How we use it', 'Information is used to operate the workspace, deliver purchases, maintain generation history, and improve the product experience.'],
  ['Sharing and processors', 'We only share what is necessary with payment, hosting, and infrastructure providers that support the service.'],
  ['Your controls', 'You can request access, corrections, or deletion for the account information tied to your workspace.'],
];

export function PrivacyPage(_: PrivacyPageProps) {
  return (
    <StudioPage activeNav="history">
      <StudioMain className="space-y-6">
        <StudioPanel>
          <StudioSectionIntro
            eyebrow="Privacy"
            title="Privacy information for the imagic creator workspace."
            body="This page keeps policy content inside the same visual system as the rest of the theme, so legal reading still feels like part of the product experience."
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
