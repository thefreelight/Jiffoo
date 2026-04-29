import React from 'react';
import { Copy, QrCode } from 'lucide-react';
import type { BokmooInstallSession } from '../lib/api';

function copyToClipboard(value: string) {
  if (!value || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
  navigator.clipboard.writeText(value).catch(() => undefined);
}

type InstallSessionPanelProps = {
  session: BokmooInstallSession;
  className?: string;
  title?: string;
};

function getQrImageSrc(value?: string): string | null {
  if (!value) return null;
  if (/^data:image\//i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) return value;
  return null;
}

export const InstallSessionPanel = React.memo(function InstallSessionPanel({
  session,
  className = '',
  title = 'Install Details',
}: InstallSessionPanelProps) {
  const qrImageSrc = getQrImageSrc(session.qrCode);
  const qrPayload = session.qrCode || session.lpaString || '';
  const fields = [
    ['SM-DP+', session.smdpAddress || '—'],
    ['Matching ID', session.matchingId || '—'],
    ['Activation Code', session.activationCode || '—'],
    ['Confirmation Code', session.confirmationCode || '—'],
  ];

  return (
    <div
      className={`rounded-[1.1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-4 text-left ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[0.9rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)] text-[var(--bokmoo-gold)]">
          <QrCode className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--bokmoo-ink)]">{title}</p>
          <p className="mt-1 text-xs text-[var(--bokmoo-copy-soft)]">{session.packageTitle}</p>
        </div>
      </div>

      {qrPayload ? (
        <div className="mt-4 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(160deg,color-mix(in_oklab,var(--bokmoo-gold)_9%,transparent),transparent_52%),var(--bokmoo-bg-elevated)] p-4">
          <div className="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
            <div className="flex aspect-square items-center justify-center rounded-[0.9rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-3">
              {qrImageSrc ? (
                <img src={qrImageSrc} alt="BOKMOO eSIM install QR code" className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-[var(--bokmoo-copy)]">
                  <QrCode className="h-11 w-11 text-[var(--bokmoo-gold)]" />
                  <span className="text-xs leading-5">QR payload ready</span>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--bokmoo-ink)]">Scan or install manually</p>
              <p className="mt-2 text-xs leading-5 text-[var(--bokmoo-copy)]">
                If the QR image is not provided by the backend, use the manual fields below or copy the LPA payload.
              </p>
              <button
                onClick={() => copyToClipboard(qrPayload)}
                className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-[0.8rem] border border-[var(--bokmoo-line)] px-4 text-sm font-medium text-[var(--bokmoo-ink)]"
                type="button"
              >
                <Copy className="h-4 w-4 text-[var(--bokmoo-gold)]" />
                Copy QR Payload
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {fields.map(([label, value]) => (
          <div
            key={`${label}-${value}`}
            className="flex items-center justify-between gap-3 rounded-[0.9rem] border border-[var(--bokmoo-line)] px-3 py-3"
          >
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--bokmoo-copy-soft)]">{label}</p>
              <p className="mt-1 text-sm text-[var(--bokmoo-ink)]">{value}</p>
            </div>
            {value !== '—' ? (
              <button
                onClick={() => copyToClipboard(String(value))}
                className="text-[var(--bokmoo-gold)]"
                type="button"
              >
                <Copy className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {session.lpaString ? (
        <div className="mt-3 rounded-[0.9rem] border border-[var(--bokmoo-line)] px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--bokmoo-copy-soft)]">LPA String</p>
              <p className="mt-1 break-all text-sm text-[var(--bokmoo-ink)]">{session.lpaString}</p>
            </div>
            <button
              onClick={() => copyToClipboard(session.lpaString || '')}
              className="text-[var(--bokmoo-gold)]"
              type="button"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {session.instructions?.ios?.length || session.instructions?.android?.length || session.instructions?.general?.length ? (
        <div className="mt-4 space-y-3">
          {session.instructions?.ios?.length ? (
            <div className="rounded-[0.9rem] border border-[var(--bokmoo-line)] px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--bokmoo-copy-soft)]">iOS</p>
              <ul className="mt-2 space-y-2 text-sm text-[var(--bokmoo-copy)]">
                {session.instructions.ios.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {session.instructions?.android?.length ? (
            <div className="rounded-[0.9rem] border border-[var(--bokmoo-line)] px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--bokmoo-copy-soft)]">Android</p>
              <ul className="mt-2 space-y-2 text-sm text-[var(--bokmoo-copy)]">
                {session.instructions.android.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {session.instructions?.general?.length ? (
            <div className="rounded-[0.9rem] border border-[var(--bokmoo-line)] px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--bokmoo-copy-soft)]">General Notes</p>
              <ul className="mt-2 space-y-2 text-sm text-[var(--bokmoo-copy)]">
                {session.instructions.general.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {session.support?.email || session.support?.phone ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--bokmoo-copy)]">
          {session.support?.email ? (
            <a className="inline-flex items-center gap-2 text-[var(--bokmoo-ink)] underline" href={`mailto:${session.support.email}`}>
              {session.support.email}
            </a>
          ) : null}
          {session.support?.phone ? (
            <a className="inline-flex items-center gap-2 text-[var(--bokmoo-ink)] underline" href={`tel:${session.support.phone}`}>
              {session.support.phone}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
