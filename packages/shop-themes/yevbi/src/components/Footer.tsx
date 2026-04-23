/**
 * Yevbi Footer Component
 * Premium dark consumer eSIM store style
 */

import type { FooterProps } from '../types';
import { useState } from 'react';
import {
  Send,
  Globe,
  ShieldCheck,
  CreditCard,
  ArrowRight,
  Wifi,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getBrandName, getSupportEmail } from '../lib/branding';

export function Footer({
  config,
  platformBranding,
  onNavigate,
  onNavigateToProducts,
  onNavigateToHelp,
  onNavigateToContact,
  onNavigateToPrivacy,
  onNavigateToTerms,
}: FooterProps) {
  const [email, setEmail] = useState('');
  const brandName = getBrandName(config);
  const brandMark = brandName.toUpperCase();
  const supportEmail = getSupportEmail(config);
  const showPoweredBy = platformBranding?.showPoweredByJiffoo !== false;

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Subscribe:', email);
    setEmail('');
  };

  return (
    <footer className="bg-muted text-foreground border-t border-border overflow-hidden relative transition-colors duration-300">
      <div className="container mx-auto px-4 py-24 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-16 lg:gap-8">

          {/* Brand */}
          <div className="lg:col-span-4 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 border border-border flex items-center justify-center text-foreground">
                <Wifi className="w-5 h-5" />
              </div>
              <span className="font-mono font-bold text-xl uppercase tracking-widest">{brandMark}</span>
            </div>
            <p className="text-muted-foreground font-mono text-sm leading-relaxed max-w-sm">
              Global eSIM plans for travelers.
              Stay connected in 150+ countries — no physical SIM required.
            </p>
            <a
              href={`mailto:${supportEmail}`}
              className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              <Send className="w-3 h-3" />
              {supportEmail}
            </a>
            <div className="font-mono text-xs flex gap-4 text-muted-foreground">
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> Secure Checkout</span>
            </div>
          </div>

          {/* Navigation */}
          <div className="lg:col-span-2 space-y-8">
            <h4 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Explore</h4>
            <ul className="space-y-4">
              <FooterLink label="Browse Plans" onClick={onNavigateToProducts} />
              <FooterLink label="Search" onClick={() => onNavigate?.('/search')} />
              <FooterLink label="My Orders" onClick={() => onNavigate?.('/orders')} />
              <FooterLink label="My Account" onClick={() => onNavigate?.('/profile')} />
            </ul>
          </div>

          <div className="lg:col-span-2 space-y-8">
            <h4 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Support</h4>
            <ul className="space-y-4">
              <FooterLink label="Help Center" onClick={onNavigateToHelp} />
              <FooterLink label="Contact Us" onClick={onNavigateToContact} />
              <FooterLink label="Privacy Policy" onClick={onNavigateToPrivacy} />
              <FooterLink label="Terms of Use" onClick={onNavigateToTerms} />
            </ul>
          </div>

          {/* Newsletter */}
          <div className="lg:col-span-4 space-y-6 border-l border-border pl-8">
            <h4 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Stay Updated</h4>
            <p className="text-muted-foreground font-mono text-xs max-w-xs">
              Get travel tips, new destination coverage, and exclusive offers.
            </p>
            <form onSubmit={handleSubscribe} className="relative flex max-w-xs pt-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full h-10 px-4 bg-background border border-border font-mono text-xs text-foreground focus:outline-none focus:border-foreground transition-colors rounded-none"
                required
              />
              <button
                type="submit"
                className="h-10 px-4 bg-foreground border border-foreground flex items-center justify-center text-background hover:bg-muted hover:text-foreground transition-colors rounded-none"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
            <div className="flex items-center gap-4 pt-4">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <ShieldCheck className="w-4 h-4 text-muted-foreground" />
              <Globe className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Legal Bar */}
        <div className="mt-24 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-8">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
            © {new Date().getFullYear()} {brandMark}. ALL RIGHTS RESERVED.
          </p>
          {showPoweredBy ? (
            <a
              href={platformBranding?.poweredByHref || 'https://jiffoo.com'}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors"
            >
              {platformBranding?.poweredByLabel || 'Powered by Jiffoo'}
            </a>
          ) : (
            <div className="flex items-center gap-8">
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="w-3 h-3" /> SSL Encrypted
              </span>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ label, onClick }: { label: string, onClick?: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        className="text-muted-foreground hover:text-foreground font-mono text-xs transition-colors flex items-center uppercase tracking-wider"
      >
        <span>{label}</span>
      </button>
    </li>
  );
}

export default Footer;
