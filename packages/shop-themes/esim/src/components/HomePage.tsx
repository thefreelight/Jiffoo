import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { HomePageProps } from 'shared/src/types/theme';
import { RoutePlanner, EXAMPLE_TRIP_STOPS } from './route/RoutePlanner';
import { destinationLabel } from '../lib/esim/catalog';
import { pickCopy } from '../site';

/**
 * 路线通 — eSIM Route Mall homepage (PRD §5).
 * 「一趟行程，一张 eSIM」 — pick destinations, tune the route, see which
 * single eSIM covers the whole trip. Deterministic matching, zero model calls.
 */

const HAIRLINE = 'border-[color:rgba(255,255,255,0.08)]';

function RouteProgressHero({
  locale,
  stops,
}: {
  locale?: string;
  stops: Array<{ code: string; days: number }>;
}) {
  const t = (copy: { en: string; hans: string; hant: string }) =>
    locale === 'zh-Hant' ? copy.hant : locale && locale.startsWith('zh') ? copy.hans : copy.en;
  if (stops.length === 0) return null;
  return (
    <div className={`mx-auto mt-10 w-full max-w-3xl rounded-2xl border ${HAIRLINE} bg-[#141414]/70 px-6 py-4`}>
      <ol className="flex items-start justify-between py-3">
        {stops.map((stop, index) => (
          <React.Fragment key={`${stop.code}-${index}`}>
            {index > 0 && <span className="mt-[7px] h-px flex-1 bg-[rgba(212,175,55,0.45)]" aria-hidden="true" />}
            <li className="flex flex-col items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-[var(--esim-gold)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--esim-gold)]" />
              </span>
              <span className="text-sm text-[var(--esim-ink)]">{destinationLabel(stop.code, locale)}</span>
              <span className="text-xs text-[var(--esim-gold)]">{stop.days} {t({ en: 'days', hans: '天', hant: '天' })}</span>
            </li>
          </React.Fragment>
        ))}
      </ol>
    </div>
  );
}

const FEATURES: Array<{ title: { en: string; hans: string; hant: string }; body: { en: string; hans: string; hant: string }; tag: { en: string; hans: string; hant: string } }> = [
  {
    title: { en: 'One code, seamless roaming', hans: '一码安装，无缝漫游', hant: '一碼安裝，無縫漫遊' },
    body: {
      en: 'After checkout the eSIM QR code is issued to your email and account instantly. Add it before boarding; it connects on arrival.',
      hans: '下单后即时发送高清 eSIM 二维码至您的邮箱与账户中心，出发前添加，落地即自动连网。',
      hant: '下單後即時發送高清 eSIM 二維碼至您的郵箱與賬戶中心，出發前添加，落地即自動連網。',
    },
    tag: { en: 'No physical SIM swap', hans: '无需实体 SIM 换装', hant: '無需實體 SIM 換裝' },
  },
  {
    title: { en: 'Smart multi-country top-ups', hans: '智能跨国漫游续费', hant: '智能跨國漫遊續費' },
    body: {
      en: 'Trip changed or running low mid-journey? Add a data pack without reinstalling.',
      hans: '行程告急或有新增停留国，可一键追加流量包，无需重新扫码安装。',
      hant: '行程告急或有新增停留國，可一鍵追加流量包，無需重新掃碼安裝。',
    },
    tag: { en: 'Flexible validity & top-ups', hans: '灵活续期与充值', hant: '靈活續期與充值' },
  },
  {
    title: { en: '24/7 travel support', hans: '24/7 全球旅途保障', hant: '24/7 全球旅途保障' },
    body: {
      en: 'Bilingual support helps with APN setup, network preference and device compatibility around the clock.',
      hans: '双语技术团队全天候在线，随时协助诊断 APN 接入、网络偏好与设备兼容性。',
      hant: '雙語技術團隊全天候在線，隨時協助診斷 APN 接入、網絡偏好與設備兼容性。',
    },
    tag: { en: 'Full refund if not activated', hans: '未激活全额退款承诺', hant: '未激活全額退款承諾' },
  },
];

const FAQ_ITEMS: Array<{ q: { en: string; hans: string; hant: string }; a: { en: string; hans: string; hant: string } }> = [
  {
    q: { en: 'Can I add a stop after buying?', hans: '临时加站怎么办？', hant: '臨時加站怎麼辦？' },
    a: {
      en: 'Yes. Your existing order stays valid; the planner re-checks coverage and tells you exactly which new stop needs its own plan.',
      hans: '可以。已购订单不受影响，路线通会重新核验覆盖，并明确指出新增站点是否需要另行购买。',
      hant: '可以。已購訂單不受影響，路線通會重新核驗覆蓋，並明確指出新增站點是否需要另行購買。',
    },
  },
  {
    q: { en: 'What if I never activate the eSIM?', hans: '未激活可以退款吗？', hant: '未激活可以退款嗎？' },
    a: {
      en: 'Plans unused before activation are refundable per the plan terms shown before checkout.',
      hans: '未激活的套餐按结账前展示的条款可申请退款。',
      hant: '未激活的套餐按結賬前展示的條款可申請退款。',
    },
  },
  {
    q: { en: 'When does validity start counting?', hans: '有效期从什么时候起算？', hant: '有效期從什麼時候起算？' },
    a: {
      en: 'Most plans start on first connection. Plans that start at purchase or install say so explicitly, and the planner counts pre-trip time for them.',
      hans: '多数套餐从首次联网起算；购买或安装即起算的套餐会明确标注，路线通会把出发前的时间计入核验。',
      hant: '多數套餐從首次聯網起算；購買或安裝即起算的套餐會明確標註，路線通會把出發前的時間計入核驗。',
    },
  },
  {
    q: { en: 'Is hotspot sharing supported?', hans: '支持热点共享吗？', hant: '支持熱點共享嗎？' },
    a: {
      en: 'Plans confirm hotspot support explicitly; require it in Usage settings and the planner only recommends plans that confirm it.',
      hans: '套餐会明确标注是否支持热点；在「用法」中开启热点共享后，路线通只推荐明确支持的套餐。',
      hant: '套餐會明確標註是否支持熱點；在「用法」中開啟熱點共享後，路線通只推薦明確支持的套餐。',
    },
  },
];

function FaqSection({ locale }: { locale?: string }) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);
  const t = (copy: { en: string; hans: string; hant: string }) =>
    locale === 'zh-Hant' ? copy.hant : locale && locale.startsWith('zh') ? copy.hans : copy.en;
  return (
    <section className="mx-auto max-w-3xl px-6 py-16" aria-labelledby="esim-faq-heading">
      <h2 id="esim-faq-heading" className="mb-8 text-center text-2xl font-light tracking-tight text-[var(--esim-ink)]">
        {t({ en: 'Questions, answered', hans: '常见疑问与保障', hant: '常見疑問與保障' })}
      </h2>
      <div className="space-y-2.5">
        {FAQ_ITEMS.map((item, index) => {
          const open = openIndex === index;
          return (
            <div key={index} className={`rounded-xl border ${HAIRLINE} bg-[#141414]`}>
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : index)}
                aria-expanded={open}
                className="flex min-h-[44px] w-full items-center justify-between px-4 py-3.5 text-left text-sm font-medium text-[var(--esim-ink)]"
              >
                {t(item.q)}
                <ChevronDown className={`h-4 w-4 text-[var(--esim-copy-soft)] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              {open && <p className="border-t border-[rgba(255,255,255,0.08)] px-4 py-3.5 text-sm leading-relaxed text-[var(--esim-copy)]">{t(item.a)}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export const HomePage = React.memo(function HomePage({ locale, config, onNavigate }: HomePageProps) {
  const t = (copy: { en: string; hans: string; hant: string }) => pickCopy(locale, copy);
  void config;

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-[var(--esim-ink)]">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(212,175,55,0.1),transparent_55%)]" />
        <div aria-hidden="true" className="absolute top-0 h-px w-full bg-[rgba(255,255,255,0.08)]" />
        <div className="relative mx-auto max-w-6xl px-6 pt-14 pb-10 lg:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-block rounded border border-[rgba(212,175,55,0.4)] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[var(--esim-gold-strong)]">
              {t({ en: 'Route Planner', hans: '路线通', hant: '路線通' })}
            </span>
            <h1 className="mt-5 text-4xl font-light leading-[1.15] tracking-tight text-white sm:text-5xl">
              {t({ en: 'One trip,', hans: '一趟行程，', hant: '一趟行程，' })}
              <span className="font-normal">{t({ en: 'one eSIM.', hans: '一张 eSIM', hant: '一張 eSIM' })}</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base font-light leading-relaxed text-[var(--esim-copy)]">
              {t({
                en: 'Multiple countries, one purchase, a simpler trip. Pick your route and we verify which single eSIM covers all of it.',
                hans: '多国连通，一次购买，行程更简单。选好路线，我们核对哪张 eSIM 覆盖全程。',
                hant: '多國連通，一次購買，行程更簡單。選好路線，我們核對哪張 eSIM 覆蓋全程。',
              })}
            </p>
            <RouteProgressHero locale={locale} stops={EXAMPLE_TRIP_STOPS} />
            <p className="mt-3 text-xs text-[var(--esim-copy-soft)]">
              {t({ en: 'Example route shown — your route starts empty below.', hans: '以上为示例路线——你的行程从下方空白开始。', hant: '以上為示例路線——你的行程從下方空白開始。' })}
            </p>
          </div>
        </div>
      </section>

      {/* Planner: left editor, right recommendation (PRD §5.1) */}
      <section className="mx-auto max-w-6xl px-6 pb-6" aria-label={t({ en: 'Route planner', hans: '路线规划', hant: '路線規劃' })}>
        <RoutePlanner locale={locale} config={config} onNavigate={onNavigate} />
      </section>

      {/* Feature trio */}
      <section className="mx-auto max-w-6xl px-6 py-14" aria-labelledby="esim-features-heading">
        <h2 id="esim-features-heading" className="sr-only">{t({ en: 'Why Bokmoo eSIM', hans: '为什么选择 Bokmoo eSIM', hant: '為什麼選擇 Bokmoo eSIM' })}</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <article key={index} className={`rounded-2xl border ${HAIRLINE} bg-[#141414] p-5`}>
              <h3 className="text-base font-medium text-[var(--esim-ink)]">{t(feature.title)}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-[var(--esim-copy)]">{t(feature.body)}</p>
              <p className="mt-3 text-xs font-medium tracking-wide text-[var(--esim-gold)]">{t(feature.tag)}</p>
            </article>
          ))}
        </div>
      </section>

      <FaqSection locale={locale} />
    </div>
  );
});
