'use client';

import { ArrowRight, LifeBuoy, Search, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { HelpPageProps } from 'shared/src/types/theme';

import { StudioMain, StudioPage, StudioPanel, StudioSectionIntro } from './StudioShell';

const helpTopics = [
  {
    id: 'generation',
    title: 'Generation workflow',
    description: 'How uploads, prompt tuning, and render lanes work together inside the imagic workspace.',
  },
  {
    id: 'video',
    title: 'Video queue',
    description: 'Understand async video status, export expectations, and how to interpret queue states.',
  },
  {
    id: 'templates',
    title: 'Template discovery',
    description: 'Use template cards as fast starting points for products, portraits, landscapes, and promo visuals.',
  },
  {
    id: 'billing',
    title: 'Plans and billing',
    description: 'Compare upgrade options, plan benefits, and account-related questions before scaling usage.',
  },
  {
    id: 'assets',
    title: 'Saved assets',
    description: 'Manage uploads, generation history, and how assets connect back to your creator account.',
  },
  {
    id: 'support',
    title: 'Support handoff',
    description: 'Know when to self-serve, when to review account settings, and when to contact the team directly.',
  },
];

export function HelpPage({ onNavigateToCategory, onNavigateToContact }: HelpPageProps) {
  const [query, setQuery] = useState('');

  const filteredTopics = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) {
      return helpTopics;
    }
    return helpTopics.filter((topic) => `${topic.title} ${topic.description}`.toLowerCase().includes(value));
  }, [query]);

  return (
    <StudioPage activeNav="history">
      <StudioMain className="space-y-6">
        <StudioPanel>
          <StudioSectionIntro
            eyebrow="Help center"
            title="Find the answer before your creative loop loses momentum."
            body="Use the help center like a control-room guide: generation, templates, assets, account access, and support escalation stay easy to scan from one dark workspace."
          />
          <label className="relative mt-8 block max-w-2xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--imagic-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search generation, templates, billing, or support..."
              className="h-12 w-full rounded-full border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] pl-11 pr-4 text-sm text-[color:var(--imagic-ink)] outline-none placeholder:text-[color:var(--imagic-muted)]"
            />
          </label>
        </StudioPanel>

        {filteredTopics.length === 0 ? (
          <StudioPanel className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--imagic-primary-soft)] text-[color:var(--imagic-primary)]">
              <Search className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold tracking-[-0.05em] text-[color:var(--imagic-ink)]">No help topics matched that query.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[color:var(--imagic-ink-soft)]">Try a broader phrase like “video”, “billing”, or “assets”, or reach out to the support lane below.</p>
          </StudioPanel>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredTopics.map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => onNavigateToCategory?.(topic.id)}
                className="rounded-[1.7rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface)]/94 p-5 text-left shadow-[var(--imagic-soft-shadow)] transition hover:-translate-y-1"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--imagic-primary-soft)] text-[color:var(--imagic-primary)]">
                  <LifeBuoy className="h-5 w-5" />
                </div>
                <h2 className="mt-5 text-2xl font-semibold tracking-[-0.05em] text-[color:var(--imagic-ink)]">{topic.title}</h2>
                <p className="mt-3 text-sm leading-7 text-[color:var(--imagic-ink-soft)]">{topic.description}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[color:var(--imagic-primary)]">Open topic <ArrowRight className="h-4 w-4" /></span>
              </button>
            ))}
          </div>
        )}

        <StudioPanel>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--imagic-muted)]">Need a handoff?</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--imagic-ink)]">Move from self-serve help into human support.</h2>
              <p className="mt-3 text-sm leading-7 text-[color:var(--imagic-ink-soft)]">When the answer depends on plan changes, account access, or generation issues that need manual review, jump out of docs and talk to the team.</p>
            </div>
            <button type="button" onClick={() => onNavigateToContact?.()} className="imagic-button-primary inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-[var(--imagic-primary-shadow)]">
              <Sparkles className="h-4 w-4" />
              Contact support
            </button>
          </div>
        </StudioPanel>
      </StudioMain>
    </StudioPage>
  );
}
