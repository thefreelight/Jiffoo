import React from 'react';
import { ArrowRight, Globe2, ShieldCheck } from 'lucide-react';
import type { FooterProps } from '../types';

const defaultEasyEuiccDownloadUrl = 'https://easyeuicc.cc/downloads/EasyEUICC-v1.6.2.apk';

export const Footer = React.memo(function Footer({
  config,
  platformBranding,
  onNavigate,
  onNavigateToHelp,
  onNavigateToContact,
  onNavigateToPrivacy,
  onNavigateToTerms,
}: FooterProps) {
  const brandName = config?.brand?.name?.trim() || 'Yevbi';
  const supportEmail = config?.site?.supportEmail || 'support@yevbi.com';
  const showPoweredBy = platformBranding?.showPoweredByJiffoo !== false;
  const isAppDownload = config?.site?.archetype === 'app-download' || brandName.toLowerCase() === 'easyeuicc';
  const downloadUrl = config?.site?.androidDownloadUrl || config?.site?.primaryCtaHref || defaultEasyEuiccDownloadUrl;

  if (isAppDownload) {
    return (
      <footer className="hidden border-t border-[#dbe7f7] bg-white px-5 py-10 md:block sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[var(--esim-container)] flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <button type="button" onClick={() => onNavigate?.('/')} className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--esim-primary)] text-sm font-black text-white">E</span>
              <span className="text-xl font-black text-[var(--esim-primary)]">{brandName}</span>
            </button>
            <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-[#64748b]">
              Android eUICC management download page. For support, contact{' '}
              <a href={`mailto:${supportEmail}`} className="font-black text-[var(--esim-primary)]">{supportEmail}</a>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm font-black">
            <button type="button" onClick={onNavigateToPrivacy} className="rounded-full border border-[#dbe7f7] px-4 py-2 text-[#334155] hover:text-[var(--esim-primary)]">
              Privacy
            </button>
            <button type="button" onClick={onNavigateToTerms} className="rounded-full border border-[#dbe7f7] px-4 py-2 text-[#334155] hover:text-[var(--esim-primary)]">
              Terms
            </button>
            <a href={downloadUrl} className="rounded-full bg-[var(--esim-primary)] px-5 py-2 text-white shadow-[0_12px_28px_rgb(23_107_255_/_0.20)]">
              Download APK
            </a>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="hidden border-t border-[var(--esim-line)] bg-white px-5 py-12 md:block sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[var(--esim-container)]">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto_auto] lg:items-start">
          <div>
            <button type="button" onClick={() => onNavigate?.('/')} className="flex items-center gap-3">
              <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-[var(--esim-primary)] text-sm font-black text-white shadow-[0_12px_24px_rgb(21_107_255_/_0.20)]">
                <span className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-white/22" />
                <span className="relative">Y</span>
              </span>
              <span className="text-xl font-black tracking-[-0.055em] text-[var(--esim-primary)]">{brandName}</span>
            </button>
            <p className="mt-5 max-w-md text-sm leading-6 text-[var(--esim-muted)]">
              Global eSIM plans selected for fast setup, clear pricing, and confident arrivals.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm font-bold text-[var(--esim-ink-soft)]">
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--esim-surface-cool)] px-4 py-2">
                <Globe2 className="h-4 w-4 text-[var(--esim-primary)]" />
                190+ regions
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--esim-surface-cool)] px-4 py-2">
                <ShieldCheck className="h-4 w-4 text-[var(--esim-primary)]" />
                Secure checkout
              </span>
            </div>
          </div>

          <FooterLinks
            title="Company"
            links={[
              ['Help center', onNavigateToHelp],
              ['Contact', onNavigateToContact],
              ['Privacy', onNavigateToPrivacy],
              ['Terms', onNavigateToTerms],
            ]}
          />

          <div className="rounded-[1.75rem] border border-[var(--esim-line)] bg-[var(--esim-surface-cool)] p-5">
            <p className="text-sm font-extrabold text-[var(--esim-ink)]">Need help before takeoff?</p>
            <a href={`mailto:${supportEmail}`} className="mt-4 inline-flex items-center gap-2 text-sm font-extrabold text-[var(--esim-primary-dark)]">
              {supportEmail}
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="mt-10 flex flex-col justify-between gap-4 border-t border-[var(--esim-line)] pt-6 text-sm font-medium text-[var(--esim-muted)] md:flex-row md:items-center">
          <p>Copyright {new Date().getFullYear()} {brandName}. All rights reserved.</p>
          {showPoweredBy ? (
            <a href={platformBranding?.poweredByHref || 'https://jiffoo.com'} target="_blank" rel="noreferrer" className="font-extrabold text-[var(--esim-ink-soft)] hover:text-[var(--esim-primary)]">
              {platformBranding?.poweredByLabel || 'Powered by Jiffoo'}
            </a>
          ) : (
            <p>USD pricing, instant delivery, no roaming contract.</p>
          )}
        </div>
      </div>
    </footer>
  );
});

function FooterLinks({ title, links }: { title: string; links: Array<[string, () => void]> }) {
  return (
    <div>
      <h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--esim-muted)]">{title}</h3>
      <div className="mt-5 grid gap-3">
        {links.map(([label, action]) => (
          <button key={label} type="button" onClick={action} className="w-fit text-left text-sm font-extrabold text-[var(--esim-ink)] transition hover:text-[var(--esim-primary)]">
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default Footer;
