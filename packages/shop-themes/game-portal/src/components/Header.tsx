import React, { useEffect } from 'react';
import type { HeaderProps } from 'shared/src/types/theme';

const NAV = [
  { href: '/', label: '首页' },
  { href: '/games', label: '全部游戏' },
  { href: '/games?category=puzzle', label: '益智' },
  { href: '/games?category=arcade', label: '街机' },
  { href: '/games?category=racing', label: '竞速' },
];

/** 广告位：AdSense 脚本经 Header 注入一次（pub 归属 game.jiffoo.com 审核主体） */
function useAdSenseScript() {
  useEffect(() => {
    const w = window as unknown as { __gpAdSenseInjected?: boolean };
    if (w.__gpAdSenseInjected) return;
    w.__gpAdSenseInjected = true;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3690602190399666';
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
  }, []);
}

export function Header({ onNavigate }: HeaderProps) {
  useAdSenseScript();
  const go = (href: string) => (event: React.MouseEvent) => {
    event.preventDefault();
    onNavigate?.(href);
  };
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b0b13]/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-5 py-3">
        <a href="/" onClick={go('/')} className="flex items-center gap-2.5 no-underline">
          <span
            className="grid h-10 w-10 place-items-center rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg,#7c5cff,#5b3df0)', boxShadow: '0 6px 18px rgba(124,92,255,.35)' }}
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="11" rx="4" />
              <path d="M7 11v3M5.5 12.5h3" />
              <circle cx="16" cy="12" r="0.6" fill="currentColor" />
              <circle cx="18.5" cy="14" r="0.6" fill="currentColor" />
            </svg>
          </span>
          <span className="flex flex-col leading-tight">
            <strong className="text-[15px] tracking-wider text-white">PLAYGROUND</strong>
            <small className="text-[11px] text-[#9a9aad]">免费网页游戏大厅</small>
          </span>
        </a>
        <nav className="flex items-center gap-1 overflow-x-auto" aria-label="游戏分类">
          {NAV.map(item => (
            <a
              key={item.href}
              href={item.href}
              onClick={go(item.href)}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-[13.5px] text-[#9a9aad] transition-colors hover:bg-white/5 hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

export default Header;
