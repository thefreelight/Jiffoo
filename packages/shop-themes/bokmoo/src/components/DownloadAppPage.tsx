import React from 'react';
import type { DownloadAppPageProps } from 'shared/src/types/theme';
import { resolveBokmooSiteConfig } from '../site';

// Store targets for the BOKMOO companion app. The iOS app is still in
// App Store review — flip iOS_APP_STORE_LIVE to true (URL is
// https://apps.apple.com/app/id6791455265) once it is approved.
const IOS_APP_STORE_LIVE = false;
const ANDROID_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.bokmoo.app';
const ANDROID_APK_URL = 'https://bokmoo.com/extensions/downloads/bokmoo-0.0.6-vc14.apk';
const ANDROID_APK_VERSION = '0.0.6 (14)';
const ANDROID_APK_SIZE = '79 MB';

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function AndroidIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.46 11.46 0 00-8.94 0L5.65 5.67c-.19-.29-.58-.38-.87-.2-.28.18-.37.54-.22.83L6.4 9.48A10.81 10.81 0 001 18h22a10.81 10.81 0 00-5.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" />
    </svg>
  );
}

export const DownloadAppPage = React.memo(function DownloadAppPage({ config }: DownloadAppPageProps) {
  const site = resolveBokmooSiteConfig(config);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--bokmoo-gold)_9%,transparent),transparent_34%),var(--bokmoo-bg)] px-4 pb-24 pt-8 sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-[980px]">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-gold)]">
            BOKMOO App
          </p>
          <h1 className="mt-4 text-[clamp(2.2rem,4vw,3.4rem)] font-semibold leading-[0.98] tracking-[-0.05em] text-[var(--bokmoo-ink)]">
            Your BOKMOO card, in your pocket.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-[var(--bokmoo-copy)]">
            Activate your BOKMOO card over Bluetooth, install and switch eSIM
            profiles, and track your data — right from your phone.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <div className="overflow-hidden rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,var(--bokmoo-line))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_80%,black),color-mix(in_oklab,var(--bokmoo-bg-elevated)_92%,black))] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] text-[var(--bokmoo-gold)]">
                <AppleIcon />
              </span>
              <div>
                <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--bokmoo-ink)]">iOS</p>
                <p className="text-sm text-[var(--bokmoo-copy-soft)]">iPhone · iPad</p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-7 text-[var(--bokmoo-copy)]">
              Requires iOS 15 or later. Activates BOKMOO cards over Bluetooth.
            </p>
            {IOS_APP_STORE_LIVE ? (
              <a
                href="https://apps.apple.com/app/id6791455265"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] text-sm font-semibold text-[var(--bokmoo-bg)]"
              >
                <AppleIcon />
                Download on the App Store
              </a>
            ) : (
              <div className="mt-6">
                <span className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] text-sm font-semibold text-[var(--bokmoo-copy-soft)]">
                  <AppleIcon />
                  App Store
                </span>
                <p className="mt-3 text-center text-xs text-[var(--bokmoo-copy-soft)]">
                  In App Store review — coming soon.
                </p>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,var(--bokmoo-line))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_80%,black),color-mix(in_oklab,var(--bokmoo-bg-elevated)_92%,black))] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] text-[var(--bokmoo-gold)]">
                <AndroidIcon />
              </span>
              <div>
                <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--bokmoo-ink)]">Android</p>
                <p className="text-sm text-[var(--bokmoo-copy-soft)]">Android 9.0+</p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-7 text-[var(--bokmoo-copy)]">
              Install from Google Play, or download the APK directly if Play is
              unavailable on your device.
            </p>
            <div className="mt-6 grid gap-3">
              <a
                href={ANDROID_PLAY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] text-sm font-semibold text-[var(--bokmoo-bg)]"
              >
                <AndroidIcon />
                Get it on Google Play
              </a>
              <a
                href={ANDROID_APK_URL}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] text-sm font-semibold text-[var(--bokmoo-ink)]"
              >
                <AndroidIcon />
                Download APK directly
              </a>
            </div>
            <p className="mt-3 text-center text-xs text-[var(--bokmoo-copy-soft)]">
              Version {ANDROID_APK_VERSION} · {ANDROID_APK_SIZE} · allow installs from your browser when prompted.
            </p>
          </div>
        </div>

        <p className="mt-10 text-center text-sm text-[var(--bokmoo-copy-soft)]">
          Questions about setup? Contact{' '}
          <a href={`mailto:${site.supportEmail}`} className="text-[var(--bokmoo-gold)] hover:underline">
            {site.supportEmail}
          </a>
          .
        </p>
      </div>
    </div>
  );
});
