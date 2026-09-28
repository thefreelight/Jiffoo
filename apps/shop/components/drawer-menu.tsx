'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

export function DrawerMenu({ label, links }: { label: string; links: Array<{ href: string; label: string }> }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeAndRestoreFocus = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const closeFromOutside = (event: Event) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeFromOutside);
    document.addEventListener('focusin', closeFromOutside);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside);
      document.removeEventListener('focusin', closeFromOutside);
    };
  }, [open]);
  return <div ref={container} className={open ? 'relative w-full md:w-auto' : 'relative'} onKeyDown={(event) => {
    if (open && event.key === 'Escape') {
      event.preventDefault();
      closeAndRestoreFocus();
    }
  }}>
    <button ref={trigger} type="button" aria-label={label} aria-expanded={open} aria-controls="shop-drawer"
      title={label} onClick={() => setOpen(!open)}
      className="rounded-shop border border-line p-[calc(var(--shop-section-spacing)/6)] md:p-2">
      {open ? <X size={18} /> : <Menu size={18} />}
    </button>
    {open && <nav id="shop-drawer" aria-label={label}
      className="right-0 top-full z-20 mt-[calc(var(--shop-section-spacing)/6)] w-full min-w-48 max-w-[calc(100vw-var(--shop-section-spacing)*2/3)] border border-line bg-surface p-[calc(var(--shop-section-spacing)/4)] shadow-sm md:absolute md:left-0 md:right-auto md:mt-2 md:w-auto md:max-w-none md:p-3">
      {links.map((link) => <Link key={link.href} href={link.href} onClick={closeAndRestoreFocus}
        className="block px-[calc(var(--shop-section-spacing)/6)] py-[calc(var(--shop-section-spacing)/6)] hover:text-action md:px-2 md:py-2">{link.label}</Link>)}
    </nav>}
  </div>;
}
