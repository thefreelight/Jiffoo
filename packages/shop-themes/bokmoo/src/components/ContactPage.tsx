import React from 'react';
import type { ContactPageProps } from 'shared/src/types/theme';
import { pickCopy } from '../site';
import { resolveBokmooSiteConfig } from '../site';

export const ContactPage = React.memo(function ContactPage({ config, locale }: ContactPageProps) {
  const t = (copy: { en: string; hans: string; hant: string }) => pickCopy(locale, copy);
  const site = resolveBokmooSiteConfig(config);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--bokmoo-gold)_9%,transparent),transparent_34%),var(--bokmoo-bg)] px-4 pb-24 pt-8 sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-[980px]">
        <div className="overflow-hidden rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_18%,var(--bokmoo-line))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_80%,black),color-mix(in_oklab,var(--bokmoo-bg-elevated)_92%,black))] shadow-[var(--bokmoo-shadow)] sm:rounded-[1.6rem]">
          <div className="grid gap-7 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-gold)]">
                {t({ en: 'About BOKMOO', hans: '关于 BOKMOO', hant: '關於 BOKMOO' })}
              </p>
              <h1 className="mt-4 text-[clamp(2.2rem,4vw,3.6rem)] font-semibold leading-[0.96] tracking-[-0.05em] text-[var(--bokmoo-ink)]">
                {t({ en: 'BOKMOO is built for global travelers.', hans: 'BOKMOO 为全球旅行者而生。', hant: 'BOKMOO 為全球旅行者而生。' })}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--bokmoo-copy)]">
                {t({ en: 'Our mission is to make connectivity simple, affordable, and reliable anywhere in the world.', hans: '我们的使命是让全球连接变得简单、实惠、可靠。', hant: '我們的使命是讓全球連接變得簡單、實惠、可靠。' })}
              </p>
              <a
                href={`mailto:${site.supportEmail}`}
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[0.9rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_22%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-5 text-sm font-medium text-[var(--bokmoo-ink)]"
              >
                {site.supportEmail}
              </a>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {[
                  [{'200+', t({ en: 'Countries', hans: '国家和地区', hant: '國家和地區' })}],
                  [{'1M+', t({ en: 'Happy Users', hans: '满意用户', hant: '滿意用戶' })}],
                  [{'99.9%', t({ en: 'Uptime', hans: '在线率', hant: '在線率' })}],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="rounded-[1rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_16%,var(--bokmoo-line))] bg-[color:color-mix(in_oklab,var(--bokmoo-bg)_88%,black)] px-4 py-5"
                  >
                    <p className="text-3xl font-semibold tracking-[-0.05em] text-[var(--bokmoo-gold)]">{value}</p>
                    <p className="mt-2 text-sm text-[var(--bokmoo-copy-soft)]">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative min-h-[15rem] overflow-hidden rounded-[1.2rem] border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_20%,var(--bokmoo-line))] bg-[linear-gradient(160deg,#30261c_0%,#141210_56%,#0a0a0b_100%)] sm:min-h-[19rem] sm:rounded-[1.4rem]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_42%,rgba(215,178,61,0.34),transparent_26%)]" />
              <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_24%,transparent)]" />
              <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
