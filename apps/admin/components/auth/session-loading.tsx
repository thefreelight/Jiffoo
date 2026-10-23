import { useT } from 'shared/src/i18n/react';

export function SessionLoading() {
  const t = useT();
  return <div role="status" aria-label={t('common.loading')} className="flex h-dvh bg-ground text-foreground">
    <div aria-hidden="true" className="hidden w-[240px] shrink-0 border-r border-border px-4 py-6 min-[769px]:block">
      <div className="mb-10 h-7 w-24 rounded bg-muted" />
      {[0, 1, 2, 3, 4, 5].map(item => <div key={item} className="mb-5 h-4 w-28 rounded bg-muted" />)}
    </div>
    <div aria-hidden="true" className="min-w-0 flex-1 px-8 pt-10">
      <div className="mx-auto max-w-[1056px] space-y-8">
        <div className="h-7 w-40 rounded bg-muted" />
        <div className="h-24 rounded-xl border border-border" />
        <div className="grid grid-cols-3 gap-4">{[0, 1, 2].map(item => <div key={item} className="h-28 rounded-xl border border-border" />)}</div>
        <div className="h-48 rounded-xl border border-border" />
      </div>
    </div>
  </div>;
}
