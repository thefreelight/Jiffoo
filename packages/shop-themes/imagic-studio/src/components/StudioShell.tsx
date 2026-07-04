'use client';

import clsx from 'clsx';
import {
  Compass,
  Crown,
  FolderOpen,
  Home,
  ImagePlus,
  LayoutTemplate,
  Plus,
  Sparkles,
  UserRound,
} from 'lucide-react';
import type { ReactNode } from 'react';

export type StudioView =
  | 'home'
  | 'create'
  | 'explore'
  | 'pricing'
  | 'projects'
  | 'profile'
  | 'generate'
  | 'templates'
  | 'assets'
  | 'history';

function normalizeView(view: StudioView): 'home' | 'create' | 'explore' | 'projects' | 'profile' {
  if (view === 'generate' || view === 'templates' || view === 'create') return 'create';
  if (view === 'assets' || view === 'projects') return 'projects';
  if (view === 'history' || view === 'profile') return 'profile';
  if (view === 'pricing' || view === 'explore') return 'explore';
  return 'home';
}

const bottomNav = [
  { id: 'home' as const, label: 'Home', href: '/', icon: Home },
  { id: 'explore' as const, label: 'Explore', href: '/products', icon: Compass },
  { id: 'create' as const, label: 'Create', href: '/#create', icon: Plus, prominent: true },
  { id: 'projects' as const, label: 'Projects', href: '/profile', icon: FolderOpen },
  { id: 'profile' as const, label: 'Profile', href: '/profile', icon: UserRound },
];

function navigateTo(path: string) {
  window.location.href = path;
}

export function toolIcon(id: string) {
  if (id.includes('image')) return <ImagePlus className="h-4 w-4" />;
  if (id.includes('template')) return <LayoutTemplate className="h-4 w-4" />;
  return <Sparkles className="h-4 w-4" />;
}

export function StudioPage({
  activeNav,
  children,
  className,
}: {
  activeNav: StudioView;
  activeTool?: string;
  onToolSelect?: (item: unknown) => void;
  children: ReactNode;
  className?: string;
}) {
  const active = normalizeView(activeNav);

  return (
    <div className={clsx('imagic-page', className)}>
      {children}
      <nav className="imagic-mobile-tabbar">
        <div className="imagic-mobile-tabbar-inner">
          {bottomNav.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTo(item.href)}
                className={clsx(
                  'imagic-mobile-tab',
                  isActive && 'is-active',
                  item.prominent && 'is-prominent',
                )}
              >
                <span>
                  <Icon className={item.prominent ? 'h-8 w-8' : 'h-5 w-5'} />
                </span>
                <strong>{item.prominent ? '' : item.label}</strong>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function StudioMain({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={clsx('imagic-main', className)}>{children}</main>;
}

export function StudioSectionIntro({
  eyebrow,
  title,
  body,
  align = 'left',
}: {
  eyebrow?: string;
  title: string;
  body: string;
  align?: 'left' | 'center';
}) {
  return (
    <div className={clsx('max-w-3xl', align === 'center' && 'mx-auto text-center')}>
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--imagic-primary)]">{eyebrow}</p> : null}
      <h1 className="mt-3 text-balance text-[clamp(2.3rem,5vw,4.7rem)] font-semibold leading-[0.98] tracking-[-0.075em] text-[color:var(--imagic-ink)]">
        {title}
      </h1>
      <p className="mt-4 text-base leading-8 text-[color:var(--imagic-ink-soft)]">{body}</p>
    </div>
  );
}

export function StudioPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('imagic-panel rounded-[2rem] p-6 sm:p-8', className)}>{children}</div>;
}

export function StudioBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-[color:var(--imagic-line)] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--imagic-muted)]">
      {children}
    </span>
  );
}

export function ProCrownButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick || (() => navigateTo('/pricing'))}
      className="imagic-crown-button"
      aria-label="Open Pro plan"
    >
      <Crown className="h-6 w-6" />
    </button>
  );
}
