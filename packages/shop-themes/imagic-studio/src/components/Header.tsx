import type { HeaderProps } from 'shared/src/types/theme';

export function Header({
  cartItemCount,
  isAuthenticated,
  onNavigateToCart,
  onNavigateToLogin,
  onNavigateToProfile,
  onNavigateToRegister,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-[color:var(--imagic-bg)]/92 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <a href="/" className="flex items-center gap-3 text-[color:var(--imagic-ink)]">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            <span className="text-lg font-semibold tracking-tight text-[color:var(--imagic-primary)]">IA</span>
          </span>
          <span className="flex flex-col">
            <span className="text-sm uppercase tracking-[0.28em] text-[color:var(--imagic-muted)]">imagic</span>
            <span className="text-base font-semibold tracking-tight">Studio</span>
          </span>
        </a>

        <nav className="hidden items-center gap-8 text-sm font-medium text-[color:var(--imagic-muted)] lg:flex">
          <a href="#studio" className="transition hover:text-[color:var(--imagic-ink)]">Studio</a>
          <a href="#samples" className="transition hover:text-[color:var(--imagic-ink)]">Samples</a>
          <a href="#workflow" className="transition hover:text-[color:var(--imagic-ink)]">Workflow</a>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNavigateToCart}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[color:var(--imagic-ink)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            Queue {cartItemCount > 0 ? `(${cartItemCount})` : ''}
          </button>

          {isAuthenticated ? (
            <button
              type="button"
              onClick={onNavigateToProfile}
              className="rounded-full bg-[color:var(--imagic-primary)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--imagic-card-shadow)] transition hover:-translate-y-0.5"
            >
              Dashboard
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="hidden rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-[color:var(--imagic-ink)] transition hover:bg-white sm:inline-flex"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={onNavigateToRegister}
                className="rounded-full bg-[color:var(--imagic-primary)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--imagic-card-shadow)] transition hover:-translate-y-0.5"
              >
                Launch Studio
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
