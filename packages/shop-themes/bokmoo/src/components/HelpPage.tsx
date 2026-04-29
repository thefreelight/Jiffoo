import React from 'react';
import { ArrowRight, Globe2, QrCode, ShieldCheck, Signal } from 'lucide-react';
import type { HelpPageProps } from 'shared/src/types/theme';

const topics = [
  {
    title: 'How to install eSIM',
    subtitle: 'Step-by-step guide',
    icon: QrCode,
  },
  {
    title: 'How eSIM works',
    subtitle: 'Learn the basics',
    icon: Globe2,
  },
  {
    title: 'Supported devices',
    subtitle: 'Check compatibility',
    icon: ShieldCheck,
  },
  {
    title: 'Top up & Data plans',
    subtitle: 'Manage your plan',
    icon: Signal,
  },
];

export const HelpPage = React.memo(function HelpPage({ onNavigateToContact }: HelpPageProps) {
  const [query, setQuery] = React.useState('');

  const filtered = topics.filter((topic) =>
    !query
      ? true
      : `${topic.title} ${topic.subtitle}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--bokmoo-gold)_9%,transparent),transparent_34%),var(--bokmoo-bg)] px-4 pb-24 pt-8 sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-[980px]">
        <div className="rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,var(--bokmoo-line))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_80%,black),color-mix(in_oklab,var(--bokmoo-bg-elevated)_92%,black))] p-5 shadow-[var(--bokmoo-shadow)] sm:rounded-[1.6rem] sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-gold)]">
                BOKMOO
              </p>
              <h1 className="mt-3 text-[clamp(2.2rem,4vw,3.6rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]">
                Help Center
              </h1>
            </div>
          </div>

          <div className="mt-6">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search for help..."
              className="h-12 w-full rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none placeholder:text-[var(--bokmoo-copy-soft)]"
            />
          </div>

          <div className="mt-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
              Popular Topics
            </p>
            <div className="mt-4 grid gap-3">
              {filtered.map(({ title, subtitle, icon: Icon }) => (
                <button
                  key={title}
                  className="flex items-center justify-between rounded-[1rem] border border-[var(--bokmoo-line)] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 py-4 text-left transition-colors hover:border-[color:color-mix(in_oklab,var(--bokmoo-gold)_32%,var(--bokmoo-line))] hover:bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_82%,black)]"
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[0.9rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_12%,transparent)] text-[var(--bokmoo-gold)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--bokmoo-ink)]">{title}</p>
                      <p className="mt-1 text-xs text-[var(--bokmoo-copy-soft)]">{subtitle}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[var(--bokmoo-copy-soft)]" />
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigateToContact?.()}
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-6 text-sm font-semibold text-[var(--bokmoo-bg)]"
            type="button"
          >
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
});
