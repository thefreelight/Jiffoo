/**
 * Structural shells for the imagic studio pages.
 *
 * Restores the exports StudioHomeClient imports; purely layout containers so
 * page chrome (nav state, spacing) has a single mounting point.
 */
import type { ReactNode } from 'react';

export function StudioPage({
  activeNav,
  children,
}: {
  activeNav?: string;
  children: ReactNode;
}) {
  return (
    <div className="imagic-studio-page" data-active-nav={activeNav}>
      {children}
    </div>
  );
}

export function StudioMain({ children }: { children: ReactNode }) {
  return <main className="imagic-studio-main">{children}</main>;
}
