'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

export function DrawerMenu({ label, links }: { label: string; links: Array<{ href: string; label: string }> }) {
  const [open, setOpen] = useState(false);
  return <div className="relative">
    <button type="button" aria-label={label} aria-expanded={open} aria-controls="shop-drawer"
      onClick={() => setOpen(!open)} className="rounded-shop border border-line p-2">
      {open ? <X size={18} /> : <Menu size={18} />}
    </button>
    {open && <nav id="shop-drawer" aria-label={label}
      className="absolute left-0 top-full z-20 mt-2 min-w-48 border border-line bg-surface p-3 shadow-sm">
      {links.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)}
        className="block px-2 py-2 hover:text-action">{link.label}</Link>)}
    </nav>}
  </div>;
}
