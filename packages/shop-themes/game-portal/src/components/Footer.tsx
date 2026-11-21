import React from 'react';
import type { FooterProps } from 'shared/src/types/theme';

export function Footer({ onNavigate }: FooterProps) {
  const go = (href: string) => (event: React.MouseEvent) => {
    event.preventDefault();
    onNavigate?.(href);
  };
  return (
    <footer className="mt-10 border-t border-white/10 px-5 py-5 text-[12.5px] text-[#9a9aad]">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3">
        <div>© 2026 PLAYGROUND · game.jiffoo.com</div>
        <nav className="flex flex-wrap gap-4">
          <a href="/privacy" onClick={go('/privacy')} className="hover:text-white">隐私政策</a>
          <a href="/terms" onClick={go('/terms')} className="hover:text-white">服务条款</a>
          <a href="/credits" onClick={go('/credits')} className="hover:text-white">游戏来源与致谢</a>
          <a href="mailto:support@jiffoo.com" className="hover:text-white">联系我们</a>
        </nav>
      </div>
    </footer>
  );
}

export default Footer;
