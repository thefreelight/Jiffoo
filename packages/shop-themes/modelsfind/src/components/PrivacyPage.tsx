import React from 'react';
import { Eye, FileText, LockKeyhole, ShieldCheck, Users } from 'lucide-react';
import type { PrivacyPageProps } from 'shared/src/types/theme';

const sections = [
  ['Information we collect', 'Theme-level default text: account details, booking requests, and support messages may be stored so operators can fulfill inquiries and manage private access.', FileText],
  ['How information is used', 'Data may be used to process bookings, verify access, provide concierge support, and improve archive discovery across desktop and mobile experiences.', Eye],
  ['Sharing and disclosures', 'Information should only be shared with service providers or operators directly involved in delivering the requested booking or support flow, subject to production policy.', Users],
  ['Security posture', 'The storefront should apply appropriate safeguards for personal data, authentication, and transaction details. Replace this section with production legal and operational specifics.', LockKeyhole],
  ['User rights', 'Users may request access, correction, or deletion of relevant personal information, subject to operational and legal constraints in the production environment.', ShieldCheck],
] as const;

export const PrivacyPage = React.memo(function PrivacyPage(_: PrivacyPageProps) {
  return (
    <div className="modelsfind-shell min-h-screen px-4 pb-32 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]">
      <div className="mx-auto max-w-[1180px]">
        <section className="modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] p-4 md:p-6 xl:p-8">
          <div className="modelsfind-hero overflow-hidden rounded-[1.8rem] border border-[var(--modelsfind-line)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_22%,rgba(255,108,240,0.24),transparent_24%),radial-gradient(circle_at_78%_18%,rgba(214,184,255,0.14),transparent_20%),linear-gradient(180deg,rgba(10,8,14,0.82),rgba(10,8,14,0.96))]" />
            <div className="relative z-10 flex min-h-[22rem] flex-col justify-end px-6 pb-8 pt-10 md:px-10 md:pb-10 md:pt-12">
              <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--modelsfind-primary)]">Privacy</p>
              <h1 className="mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.8rem,7vw,4.8rem)] leading-[0.92] tracking-[-0.05em] text-white">
                Privacy framework for the private archive.
              </h1>
              <p className="mt-4 max-w-[34rem] text-sm leading-7 text-[var(--modelsfind-copy)]">
                This is a theme-level default. Production shops should replace it with jurisdiction-specific legal text before launch.
              </p>
            </div>
          </div>
          <div className="mt-8 grid gap-4">
            {sections.map(([title, body, icon]) => {
              const Icon = icon;
              return (
                <article
                  key={title}
                  className="rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="[font-family:var(--modelsfind-display)] text-[2rem] leading-none tracking-[-0.04em] text-white">
                        {title}
                      </h2>
                      <p className="mt-3 text-sm leading-7 text-[var(--modelsfind-copy)]">{body}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
});

