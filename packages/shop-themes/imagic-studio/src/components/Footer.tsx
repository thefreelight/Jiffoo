import type { FooterProps } from 'shared/src/types/theme';

export function Footer({ onNavigateToHelp, onNavigateToPrivacy, onNavigateToTerms }: FooterProps) {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div className="max-w-xl">
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--imagic-muted)]">Imagic Studio</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--imagic-ink)]">
            A lighter storefront for people turning raw shots into story-ready visuals.
          </h2>
          <p className="mt-3 text-sm leading-6 text-[color:var(--imagic-muted)]">
            Theme experience for `imagic.art`, backed by the `imagic-core` plugin for asset upload, image restyling,
            and async video transformation.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <button type="button" onClick={onNavigateToHelp} className="rounded-full border border-slate-200 px-4 py-2 text-[color:var(--imagic-ink)]">
            Help
          </button>
          <button type="button" onClick={onNavigateToPrivacy} className="rounded-full border border-slate-200 px-4 py-2 text-[color:var(--imagic-ink)]">
            Privacy
          </button>
          <button type="button" onClick={onNavigateToTerms} className="rounded-full border border-slate-200 px-4 py-2 text-[color:var(--imagic-ink)]">
            Terms
          </button>
        </div>
      </div>
    </footer>
  );
}
