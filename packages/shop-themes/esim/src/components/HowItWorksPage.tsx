import React from 'react';
import { CreditCard, MapPin, Wifi } from 'lucide-react';
import type { HowItWorksPageProps } from 'shared/src/types/theme';
import { type ThemeCopy, pickCopy, resolveEsimSiteConfig } from '../site';

const STEPS = [
  {
    icon: MapPin,
    title: { en: 'Pick your destination', hans: '选择目的地', hant: '選擇目的地' },
    body: {
      en: 'Choose a country or region, the data and the days you need.',
      hans: '选择国家或地区，以及所需的流量和天数。',
      hant: '選擇國家或地區，以及所需的流量和天數。',
    },
  },
  {
    icon: CreditCard,
    title: { en: 'Check out', hans: '完成支付', hant: '完成付款' },
    body: {
      en: 'Pay securely. Your plan is issued right after payment.',
      hans: '安全付款，套餐在支付后立即发放。',
      hant: '安全付款，方案在付款後立即發放。',
    },
  },
  {
    icon: Wifi,
    title: { en: 'Install and connect', hans: '安装并连接', hant: '安裝並連線' },
    body: {
      en: 'Scan the QR code or enter the activation code. Most plans start on first connection.',
      hans: '扫描二维码或输入激活码。多数套餐在首次联网时生效。',
      hant: '掃描 QR 碼或輸入啟用碼。多數方案在首次連線時生效。',
    },
  },
];

/**
 * Standalone "how it works" page. The home page links here through the
 * hero's secondary call to action; without it the host renders its
 * English-only "Unable to load component" fallback.
 */
export const HowItWorksPage = React.memo(function HowItWorksPage({ config, locale }: HowItWorksPageProps) {
  const t = (copy: ThemeCopy) => pickCopy(locale, copy);
  const site = resolveEsimSiteConfig(config, locale);
  const prefix = locale && locale !== 'en' ? `/${locale}` : '/en';

  return (
    <div className="min-h-screen bg-[var(--esim-bg)] px-4 pb-24 pt-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[980px]">
        <div className="rounded-[1.6rem] border border-[var(--esim-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--esim-bg-elevated)_96%,white),var(--esim-bg-elevated))] p-6 shadow-[var(--esim-shadow)] sm:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--esim-gold)]">
            {pickCopy(locale, { en: 'eSIM Plans', hans: 'eSIM 方案', hant: 'eSIM 方案' })}
          </p>
          <h1 className="mt-3 text-[clamp(2.2rem,4vw,3.4rem)] font-semibold leading-[1.02] tracking-[-0.05em] text-[var(--esim-ink)]">
            {t({ en: 'How it works', hans: '了解使用方式', hant: '瞭解使用方式' })}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--esim-copy)]">
            {t({ en: 'Three steps from checkout to connected.', hans: '从下单到联网，只需三步。', hant: '從下單到連線，只需三步。' })}
          </p>

          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li
                key={step.title.en}
                className="rounded-[1.2rem] border border-[var(--esim-line)] bg-[var(--esim-bg)] p-6 shadow-[var(--esim-shadow)]"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--esim-gold)_24%,transparent)] bg-[color:color-mix(in_oklab,var(--esim-gold)_14%,transparent)] text-[var(--esim-gold)]">
                    <step.icon className="h-5 w-5" />
                  </span>
                  <span className="text-[11px] font-semibold tracking-[0.18em] text-[var(--esim-copy-soft)]">0{index + 1}</span>
                </div>
                <h2 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-[var(--esim-ink)]">{t(step.title)}</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--esim-copy)]">{t(step.body)}</p>
              </li>
            ))}
          </ol>

          <a
            href={`${prefix}${site.primaryCtaHref}`}
            className="mt-10 inline-flex min-h-12 items-center justify-center rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--esim-gold)_88%,white),color-mix(in_oklab,var(--esim-gold)_70%,#8a6a1f))] px-7 text-sm font-semibold text-[#0b0c10] transition-opacity hover:opacity-95"
          >
            {pickCopy(locale, { en: 'Shop eSIM Plans', hans: '选购 eSIM 方案', hant: '選購 eSIM 方案' })}
          </a>
        </div>
      </div>
    </div>
  );
});
