/**
 * Black Friday 2026 campaign rules — bilingual (en / zh-Hans / zh-Hant).
 * Static content: window, discount, gold-pin raffle rules and the
 * no-purchase entry channel. Self-styled in the bokmoo dark-gold look.
 */

'use client';

import React from 'react';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';

type Lang = 'en' | 'hans' | 'hant';

const COPY = {
  eyebrow: { en: 'Black Friday 2026', hans: '2026 黑五活动', hant: '2026 黑五活動' },
  title: { en: '20% off the BOKMOO Card — and a pure gold pin raffle', hans: 'BOKMOO 卡 8 折，纯金卡针抽奖', hant: 'BOKMOO 卡 8 折，純金卡針抽獎' },
  windowLabel: { en: 'Campaign window', hans: '活动时间', hant: '活動時間' },
  window: { en: 'Nov 25, 2026 00:00 — Dec 1, 2026 23:59 (UTC)', hans: '2026 年 11 月 25 日 00:00 — 12 月 1 日 23:59（UTC）', hant: '2026 年 11 月 25 日 00:00 — 12 月 1 日 23:59（UTC）' },
  shopCta: { en: 'Shop the Black Friday deal', hans: '去抢黑五价', hant: '去搶黑五價' },
  dealTitle: { en: 'The deal', hans: '优惠详情', hant: '優惠詳情' },
  deal1: { en: 'The BOKMOO Card drops from $20 to $15.99 (20% off) during the window.', hans: '活动期间 BOKMOO 卡从 $20 降到 $15.99（8 折）。', hant: '活動期間 BOKMOO 卡從 $20 降到 $15.99（8 折）。' },
  deal2: { en: 'The discount is applied automatically at checkout — no code needed.', hans: '结账时自动生效，无需优惠码。', hant: '結賬時自動生效，無需優惠碼。' },
  deal3: { en: 'Limit: one promotion-priced order per customer during the campaign.', hans: '限购：活动期间每位顾客限 1 笔促销价订单。', hant: '限購：活動期間每位顧客限 1 筆促銷價訂單。' },
  raffleTitle: { en: 'The gold pin raffle', hans: '纯金卡针抽奖', hant: '純金卡針抽獎' },
  raffle1: { en: 'Prize: one BOKMOO pin in 1g of 999 fine gold, engraved with the campaign mark.', hans: '奖品：1 克 999 足金 BOKMOO 卡针一枚，刻活动印记。', hant: '獎品：1 克 999 足金 BOKMOO 卡針一枚，刻活動印記。' },
  raffle2: { en: 'Every paid order during the window = one entry. More orders, more entries.', hans: '活动期内每笔已支付订单 = 1 次入围，多买多入围。', hant: '活動期內每筆已支付訂單 = 1 次入圍，多買多入圍。' },
  raffle3: { en: 'The draw happens after the window closes, using publicly verifiable randomness: entries are hashed and the winner is picked against the hash of the first Bitcoin block mined after Dec 1, 23:59 UTC. Anyone can re-run the verification.', hans: '窗口关闭后开奖，采用公开可验证的随机源：入围单哈希化，以 12 月 1 日 23:59 UTC 之后挖出的第一个比特币区块哈希对齐选出中奖者，任何人可复算验证。', hant: '窗口關閉後開獎，採用公開可驗證的隨機源：入圍單哈希化，以 12 月 1 日 23:59 UTC 之後挖出的第一個比特幣區塊哈希對齊選出中獎者，任何人可復算驗證。' },
  raffle4: { en: 'The winner is notified through the in-app notification center and by email; results and verification data are published on this page.', hans: '中奖者将通过 App 内通知中心和邮件获知；结果与验证数据公布在本页。', hant: '中獎者將通過 App 內通知中心和郵件獲知；結果與驗證數據公佈在本頁。' },
  freeTitle: { en: 'No purchase necessary', hans: '免购入参与通道', hant: '免購入參與通道' },
  free1: { en: 'A purchase does not improve your chances relative to the entry pool — free entries share the same draw.', hans: '免购入入围与订单入围进入同一奖池，中奖概率一致。', hant: '免購入入圍與訂單入圍進入同一獎池，中獎概率一致。' },
  free2: { en: 'To enter for free, email support@bokmoo.com with the subject "BOKMOO Black Friday Entry" and your name plus a contact email, before the window closes.', hans: '免购入参与：在窗口关闭前发邮件至 support@bokmoo.com，标题写 "BOKMOO Black Friday Entry"，附姓名和联系邮箱。', hant: '免購入參與：在窗口關閉前發郵件至 support@bokmoo.com，標題寫 "BOKMOO Black Friday Entry"，附姓名和聯繫郵箱。' },
  free3: { en: 'One free entry per person; duplicate or automated submissions are void.', hans: '每人限 1 次免购入入围，重复或机器提交无效。', hant: '每人限 1 次免購入入圍，重複或機器提交無效。' },
  fineTitle: { en: 'Fine print', hans: '细则', hant: '細則' },
  fine1: { en: 'Open to customers 18 or older where the campaign is available. One gold pin total; no cash alternative.', hans: '面向活动可用地区的 18 岁及以上顾客；金卡针共 1 枚，不可折现。', hant: '面向活動可用地區的 18 歲及以上顧客；金卡針共 1 枚，不可折現。' },
  fine2: { en: 'Any applicable taxes on the prize are the winner\u2019s responsibility.', hans: '奖品涉及的相关税费由中奖者承担。', hant: '獎品涉及的相關稅費由中獎者承擔。' },
  fine3: { en: 'We may disqualify entries that abuse the campaign (fraud, duplicate accounts, self-dealing).', hans: '滥用活动（欺诈、重复账号、自买自卖）的入围资格将被取消。', hant: '濫用活動（欺詐、重複賬號、自買自賣）的入圍資格將被取消。' },
  fine4: { en: 'Apple Inc. and Google LLC are not sponsors of, or participants in, this campaign.', hans: 'Apple Inc. 与 Google LLC 非本活动的赞助方或参与方。', hant: 'Apple Inc. 與 Google LLC 非本活動的贊助方或參與方。' },
  fine5: { en: 'These rules may be updated on this page; the version published at the time of the draw applies.', hans: '细则可能在本页更新，以开奖时公布版本为准。', hant: '細則可能在本頁更新，以開獎時公佈版本為準。' },
} as const;

function pick(locale: string | undefined, copy: Record<Lang, string>): string {
  if (locale === 'zh-Hant') return copy.hant;
  if (locale?.startsWith('zh')) return copy.hans;
  return copy.en;
}

export default function BlackFridayPageClient() {
  const nav = useLocalizedNavigation();
  const L = (copy: Record<Lang, string>) => pick(nav.locale, copy);
  const shopHref = nav.getHref('/bestsellers');
  const gold = '#d8b45a';

  return (
    <div className="min-h-screen bg-[#08070a] text-white">
      <div className="mx-auto w-full max-w-3xl px-5 pb-16 pt-12">
        <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: gold }}>{L(COPY.eyebrow)}</p>
        <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl" style={{ color: gold }}>{L(COPY.title)}</h1>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/60">{L(COPY.windowLabel)}</p>
          <p className="mt-1 text-lg font-bold">{L(COPY.window)}</p>
          <a
            href={shopHref}
            className="mt-4 inline-block rounded-full px-5 py-2.5 text-sm font-bold text-[#0b0c10] transition hover:opacity-90"
            style={{ backgroundColor: gold }}
          >
            {L(COPY.shopCta)} →
          </a>
        </div>

        <section className="mt-8">
          <h2 className="text-lg font-bold" style={{ color: gold }}>{L(COPY.dealTitle)}</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-white/85">
            <li>• {L(COPY.deal1)}</li>
            <li>• {L(COPY.deal2)}</li>
            <li>• {L(COPY.deal3)}</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold" style={{ color: gold }}>{L(COPY.raffleTitle)}</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-white/85">
            <li>• {L(COPY.raffle1)}</li>
            <li>• {L(COPY.raffle2)}</li>
            <li>• {L(COPY.raffle3)}</li>
            <li>• {L(COPY.raffle4)}</li>
          </ul>
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-bold" style={{ color: gold }}>{L(COPY.freeTitle)}</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-white/85">
            <li>• {L(COPY.free1)}</li>
            <li>• {L(COPY.free2)}</li>
            <li>• {L(COPY.free3)}</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold" style={{ color: gold }}>{L(COPY.fineTitle)}</h2>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-white/60">
            <li>• {L(COPY.fine1)}</li>
            <li>• {L(COPY.fine2)}</li>
            <li>• {L(COPY.fine3)}</li>
            <li>• {L(COPY.fine4)}</li>
            <li>• {L(COPY.fine5)}</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
