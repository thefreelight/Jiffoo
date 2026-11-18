import React from 'react';
import { ArrowRight, Globe2, QrCode, ShieldCheck, Signal } from 'lucide-react';
import type { HelpPageProps } from 'shared/src/types/theme';
import { pickCopy } from '../site';

const topics = [
  {
    title: { en: 'How to install eSIM', hans: '如何安装 eSIM', hant: '如何安裝 eSIM' },
    subtitle: { en: 'Step-by-step guide', hans: '分步指南', hant: '分步指南' },
    icon: QrCode,
  },
  {
    title: { en: 'How eSIM works', hans: 'eSIM 的工作原理', hant: 'eSIM 的工作原理' },
    subtitle: { en: 'Learn the basics', hans: '了解基础知识', hant: '了解基礎知識' },
    icon: Globe2,
  },
  {
    title: { en: 'Supported devices', hans: '支持的设备', hant: '支援的裝置' },
    subtitle: { en: 'Check compatibility', hans: '查看兼容性', hant: '查看相容性' },
    icon: ShieldCheck,
  },
  {
    title: { en: 'Top up & Data plans', hans: '充值与流量套餐', hant: '充值與流量套餐' },
    subtitle: { en: 'Manage your plan', hans: '管理你的套餐', hant: '管理你的套餐' },
    icon: Signal,
  },
];

export const HelpPage = React.memo(function HelpPage({ onNavigateToContact, locale }: HelpPageProps) {
  const t = (copy: { en: string; hans: string; hant: string }) => pickCopy(locale, copy);
  const [query, setQuery] = React.useState('');

  const filtered = topics.filter((topic) =>
    !query
      ? true
      : `${topic.title.en} ${topic.title.hans} ${topic.title.hant} ${topic.subtitle.en} ${topic.subtitle.hans} ${topic.subtitle.hant}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--esim-gold)_9%,transparent),transparent_34%),var(--esim-bg)] px-4 pb-24 pt-8 sm:px-6 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-[980px]">
        <div className="rounded-[1.35rem] border border-[color:color-mix(in_oklab,var(--esim-gold)_18%,var(--esim-line))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--esim-bg-elevated)_80%,black),color-mix(in_oklab,var(--esim-bg-elevated)_92%,black))] p-5 shadow-[var(--esim-shadow)] sm:rounded-[1.6rem] sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--esim-gold)]">
                BOKMOO
              </p>
              <h1 className="mt-3 text-[clamp(2.2rem,4vw,3.6rem)] font-semibold tracking-[-0.05em] text-[var(--esim-ink)]">
                {t({ en: 'Help Center', hans: '帮助中心', hant: '幫助中心' })}
              </h1>
            </div>
          </div>

          <div className="mt-6">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t({ en: 'Search for help...', hans: '搜索帮助…', hant: '搜尋幫助…' })}
              className="h-12 w-full rounded-[0.95rem] border border-[var(--esim-line)] bg-[color:color-mix(in_oklab,var(--esim-bg)_88%,black)] px-4 text-sm text-[var(--esim-ink)] outline-none placeholder:text-[var(--esim-copy-soft)]"
            />
          </div>

          <div className="mt-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--esim-copy-soft)]">
              {pickCopy(locale, { en: 'Popular Topics', hans: '热门主题', hant: '熱門主題' })}
            </p>
            <div className="mt-4 grid gap-3">
              {filtered.map(({ title, subtitle, icon: Icon }) => (
                <button
                  key={title.en}
                  className="flex items-center justify-between rounded-[1rem] border border-[var(--esim-line)] bg-[color:color-mix(in_oklab,var(--esim-bg)_88%,black)] px-4 py-4 text-left transition-colors hover:border-[color:color-mix(in_oklab,var(--esim-gold)_32%,var(--esim-line))] hover:bg-[color:color-mix(in_oklab,var(--esim-bg)_82%,black)]"
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[0.9rem] bg-[color:color-mix(in_oklab,var(--esim-gold)_12%,transparent)] text-[var(--esim-gold)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--esim-ink)]">{pickCopy(locale, title)}</p>
                      <p className="mt-1 text-xs text-[var(--esim-copy-soft)]">{pickCopy(locale, subtitle)}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[var(--esim-copy-soft)]" />
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigateToContact?.()}
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded-[0.9rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--esim-gold)_82%,white),color-mix(in_oklab,var(--esim-gold)_68%,black))] px-6 text-sm font-semibold text-[var(--esim-bg)]"
            type="button"
          >
            {t({ en: 'Contact Support', hans: '联系支持', hant: '聯絡支援' })}
          </button>
        </div>
      </div>
    </div>
  );
});
