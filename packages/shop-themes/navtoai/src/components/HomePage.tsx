import React from 'react';
import { ArrowRight, Bot, Code2, Compass, GalleryVerticalEnd, Search, Sparkles, Video } from 'lucide-react';
import type { HomePageProps } from 'shared/src/types/theme';
import { isExternalHref, navLaunchLanes, resolveNavToAiSiteConfig } from '../site';

const laneIcons = [Search, GalleryVerticalEnd, Video, Code2];

const principles = [
  {
    title: 'Browse by job',
    detail: 'Start with the task at hand such as research, image generation, agent workflows, or post-production.',
  },
  {
    title: 'Trim the noise',
    detail: 'Surface the clearest tags, categories, and tradeoffs first so operators can move faster.',
  },
  {
    title: 'Keep commerce close',
    detail: 'When a tool belongs in the stack, checkout and account flows are already connected to the directory.',
  },
];

const signals = [
  'LLM copilots',
  'Prompt QA',
  'Model routing',
  'Image generation',
  'Video editing',
  'Voice cloning',
  'Developer agents',
  'Workflow automation',
];

export const HomePage = React.memo(function HomePage({ config, onNavigate }: HomePageProps) {
  const site = resolveNavToAiSiteConfig(config);

  const openHref = React.useCallback(
    (href: string) => {
      if (isExternalHref(href)) {
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }

      onNavigate?.(href);
    },
    [onNavigate]
  );

  return (
    <div className="bg-[linear-gradient(180deg,var(--navtoai-bg),color-mix(in_oklab,var(--navtoai-bg)_88%,white))] text-[var(--navtoai-ink)]">
      <section className="relative overflow-hidden border-b border-[var(--navtoai-line)] px-4 pb-16 pt-20 sm:px-6 sm:pb-20 sm:pt-24 lg:px-8">
        <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:var(--navtoai-grid)] [background-size:68px_68px]" />
        <div className="pointer-events-none absolute right-[-7rem] top-[-7rem] h-64 w-64 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--navtoai-primary)_24%,white),transparent_70%)] blur-2xl" />
        <div className="pointer-events-none absolute bottom-[-6rem] left-[-5rem] h-56 w-56 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--navtoai-accent)_18%,white),transparent_72%)] blur-2xl" />

        <div className="relative mx-auto grid max-w-[1280px] gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(20rem,0.92fr)] lg:items-start">
          <div>
            <div className="inline-flex items-center gap-3 rounded-full border border-[var(--navtoai-line)] bg-[color:color-mix(in_oklab,var(--navtoai-surface)_92%,white)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--navtoai-copy)] shadow-[var(--navtoai-shadow)]">
              <Compass className="h-4 w-4 text-[var(--navtoai-primary)]" />
              {site.eyebrow}
            </div>

            <h1 className="mt-6 max-w-5xl text-[clamp(3rem,7vw,6.2rem)] font-black leading-[0.94] tracking-[-0.06em] text-[var(--navtoai-ink)]">
              {site.headline}
            </h1>
            <p className="mt-6 max-w-2xl text-[clamp(1rem,1.8vw,1.25rem)] leading-8 text-[var(--navtoai-copy)]">
              {site.subheadline}
            </p>

            <div className="mt-8 flex flex-wrap gap-2">
              {signals.map((signal) => (
                <button
                  key={signal}
                  type="button"
                  onClick={() => openHref(`/search?q=${encodeURIComponent(signal)}`)}
                  className="rounded-full border border-[var(--navtoai-line)] bg-[color:color-mix(in_oklab,var(--navtoai-surface)_92%,white)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--navtoai-copy)] transition-colors hover:border-[var(--navtoai-primary)] hover:text-[var(--navtoai-ink)]"
                >
                  {signal}
                </button>
              ))}
            </div>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => openHref(site.primaryCtaHref)}
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-[var(--navtoai-primary)] px-7 text-sm font-semibold uppercase tracking-[0.22em] text-white transition-transform duration-300 hover:-translate-y-0.5"
              >
                {site.primaryCtaLabel}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => openHref(site.secondaryCtaHref)}
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] px-7 text-sm font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-ink)]"
              >
                {site.secondaryCtaLabel}
              </button>
            </div>
          </div>

          <div className="rounded-[var(--navtoai-radius-lg)] border border-[var(--navtoai-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--navtoai-surface)_96%,white),var(--navtoai-surface-alt))] p-6 shadow-[var(--navtoai-shadow)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--navtoai-copy-soft)]">
                  Directory modes
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--navtoai-ink)]">
                  Curate discovery like a buyer guide, not a feature dump.
                </h2>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--navtoai-primary-soft)] text-[var(--navtoai-primary)]">
                <Bot className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              {principles.map((principle, index) => (
                <div
                  key={principle.title}
                  className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-3 rounded-[var(--navtoai-radius-md)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-4"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--navtoai-ink)] text-sm font-black text-white">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="text-base font-black tracking-[-0.02em] text-[var(--navtoai-ink)]">
                      {principle.title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-[var(--navtoai-copy)]">{principle.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[var(--navtoai-radius-md)] border border-[var(--navtoai-line)] bg-[var(--navtoai-ink)] p-5 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
                Operator note
              </p>
              <p className="mt-3 text-sm leading-7 text-white/88">
                NavToAI keeps the catalog merchant-friendly: product records, checkout, order history, and account flows stay intact while the storefront feels more like a navigation site for modern AI tooling.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1280px]">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--navtoai-copy-soft)]">
              Browse by lane
            </p>
            <h2 className="mt-4 text-[clamp(2.2rem,4vw,4rem)] font-black leading-[0.96] tracking-[-0.05em] text-[var(--navtoai-ink)]">
              Built for AI directories where category clarity matters more than launch-day hype.
            </h2>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {navLaunchLanes.map((lane, index) => {
              const Icon = laneIcons[index] || Sparkles;

              return (
                <button
                  key={lane.label}
                  type="button"
                  onClick={() => openHref(lane.href)}
                  className="group rounded-[var(--navtoai-radius-lg)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-6 text-left shadow-[var(--navtoai-shadow)] transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--navtoai-primary-soft)] text-[var(--navtoai-primary)]">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-xl font-black tracking-[-0.03em] text-[var(--navtoai-ink)]">
                    {lane.label}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--navtoai-copy)]">{lane.caption}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-primary)]">
                    Open lane
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
});
