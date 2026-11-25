/**
 * Black Friday 2026 campaign page, in the seven storefront languages.
 *
 * Static content: the window, the automatic discount on the two BOKMOO cards
 * with a way to reach each card, how creator promo codes add to it, and the
 * fine print. The catalog listing only shows eSIM plans, so for the cards
 * this page is the way in. Self-styled in the
 * bokmoo dark-gold look. Prices and dates here must match the promotion the
 * store runs (native_promotions) — change them together.
 */

'use client';

import React from 'react';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';

type Lang = 'en' | 'hans' | 'hant' | 'ja' | 'ko' | 'fr' | 'de';
type Copy = Record<Lang, string>;

const COPY = {
  eyebrow: {
    en: 'Black Friday 2026', hans: '2026 黑五活动', hant: '2026 黑五活動', ja: 'ブラックフライデー 2026',
    ko: '2026 블랙 프라이데이', fr: 'Black Friday 2026', de: 'Black Friday 2026',
  },
  title: {
    en: '20% off BOKMOO cards, and more off with a creator code',
    hans: 'BOKMOO 实体卡 8 折，凭创作者折扣码还可再优惠',
    hant: 'BOKMOO 實體卡 8 折，憑創作者折扣碼還可再優惠',
    ja: 'BOKMOOカードが20%オフ、クリエイターコードでさらに割引',
    ko: 'BOKMOO 카드 20% 할인, 크리에이터 코드로 추가 할인',
    fr: '20 % de réduction sur les cartes BOKMOO, et davantage avec un code créateur',
    de: '20 % Rabatt auf BOKMOO-Karten, mit Creator-Code noch mehr',
  },
  windowLabel: {
    en: 'Campaign window', hans: '活动时间', hant: '活動時間', ja: 'キャンペーン期間',
    ko: '프로모션 기간', fr: 'Période de l’offre', de: 'Zeitraum der Aktion',
  },
  window: {
    en: 'Nov 27, 2026 00:00 — Nov 30, 2026 23:59 (UTC)',
    hans: '2026 年 11 月 27 日 00:00 — 11 月 30 日 23:59（UTC）',
    hant: '2026 年 11 月 27 日 00:00 — 11 月 30 日 23:59（UTC）',
    ja: '2026年11月27日 00:00 — 11月30日 23:59（UTC）',
    ko: '2026년 11월 27일 00:00 — 11월 30일 23:59 (UTC)',
    fr: '27 novembre 2026 00:00 — 30 novembre 2026 23:59 (UTC)',
    de: '27. November 2026 00:00 — 30. November 2026 23:59 (UTC)',
  },
  shopCta: {
    en: 'Shop the Black Friday deal', hans: '去抢黑五价', hant: '去搶黑五價', ja: 'ブラックフライデーのセールを見る',
    ko: '블랙 프라이데이 세일 보기', fr: 'Voir l’offre Black Friday', de: 'Zum Black-Friday-Angebot',
  },
  dealTitle: {
    en: 'The deal', hans: '优惠详情', hant: '優惠詳情', ja: 'セール内容', ko: '할인 내용',
    fr: 'L’offre', de: 'Das Angebot',
  },
  deal1: {
    en: 'From Nov 27 to Nov 30 the BOKMOO Card drops from $20 to $16, and the Bokmoo Bluetooth Card from $40 to $32 — 20% off.',
    hans: '11 月 27 日至 30 日，BOKMOO 卡从 $20 降到 $16，Bokmoo 蓝牙卡从 $40 降到 $32，即 8 折。',
    hant: '11 月 27 日至 30 日，BOKMOO 卡從 $20 降到 $16，Bokmoo 藍牙卡從 $40 降到 $32，即 8 折。',
    ja: '11月27日〜30日、BOKMOOカードは$20→$16、Bokmoo Bluetoothカードは$40→$32の20%オフ。',
    ko: '11월 27일부터 30일까지 BOKMOO 카드는 $20에서 $16으로, Bokmoo 블루투스 카드는 $40에서 $32으로 20% 할인됩니다.',
    fr: 'Du 27 au 30 novembre, la carte BOKMOO passe de 20 $ à 16 $ et la carte Bluetooth Bokmoo de 40 $ à 32 $ : 20 % de réduction.',
    de: 'Vom 27. bis 30. November sinkt die BOKMOO-Karte von 20 $ auf 16 $ und die Bokmoo Bluetooth-Karte von 40 $ auf 32 $ — 20 % Rabatt.',
  },
  deal2: {
    en: 'The discount is applied automatically at checkout. No code is needed.',
    hans: '折扣在结算时自动生效，无需优惠码。',
    hant: '折扣在結帳時自動生效，無需優惠碼。',
    ja: '割引はチェックアウト時に自動で適用されます。コードは不要です。',
    ko: '할인은 결제 시 자동으로 적용됩니다. 코드는 필요하지 않습니다.',
    fr: 'La réduction est appliquée automatiquement au paiement. Aucun code n’est nécessaire.',
    de: 'Der Rabatt wird an der Kasse automatisch abgezogen. Kein Code nötig.',
  },
  deal3: {
    en: 'There is no order limit: the sale price applies to every order placed in the window.',
    hans: '不限订单数：活动时间内的每一笔订单都享受活动价。',
    hant: '不限訂單數：活動時間內的每一筆訂單都享有活動價。',
    ja: '注文数の制限はありません。期間中のすべての注文にセール価格が適用されます。',
    ko: '주문 수 제한이 없습니다. 기간 내의 모든 주문에 세일 가격이 적용됩니다.',
    fr: 'Aucune limite de commandes : le prix soldé s’applique à chaque commande passée pendant la période.',
    de: 'Keine Bestellbegrenzung: Der Sale-Preis gilt für jede Bestellung im Aktionszeitraum.',
  },
  cardsTitle: {
    en: 'The cards on sale', hans: '参与活动的实体卡', hant: '參與活動的實體卡', ja: 'セール対象のカード',
    ko: '할인 대상 카드', fr: 'Les cartes en soldes', de: 'Die Karten im Sale',
  },
  viewCard: {
    en: 'View card', hans: '查看卡片', hant: '查看卡片', ja: 'カードを見る', ko: '카드 보기',
    fr: 'Voir la carte', de: 'Karte ansehen',
  },
  codeTitle: {
    en: 'Creator codes', hans: '创作者折扣码', hant: '創作者折扣碼', ja: 'クリエイターコード',
    ko: '크리에이터 코드', fr: 'Codes créateurs', de: 'Creator-Codes',
  },
  code1: {
    en: 'Creators in the BOKMOO affiliate program have their own promo codes. Enter one at checkout to take a further discount off the sale price — a percentage off or a fixed amount off, as set for that code.',
    hans: 'BOKMOO 联盟计划的创作者拥有自己的折扣码。结算时输入，可在活动价基础上再享优惠——按该码的设置，可能是折上折或立减。',
    hant: 'BOKMOO 聯盟計劃的創作者擁有自己的折扣碼。結帳時輸入，可在活動價基礎上再享優惠——按該碼的設定，可能是折上折或立減。',
    ja: 'BOKMOOアフィリエイトプログラムのクリエイターには、それぞれのプロモコードがあります。チェックアウト時に入力すると、セール価格からさらに割引（コードごとに設定された割合、または固定額）が適用されます。',
    ko: 'BOKMOO 제휴 프로그램의 크리에이터에게는 각자의 프로모 코드가 있습니다. 결제 시 입력하면 세일 가격에서 추가 할인(코드별로 설정된 비율 또는 고정 금액)을 받습니다.',
    fr: 'Les créateurs du programme d’affiliation BOKMOO ont leur propre code promo. Saisissez-le au paiement pour une réduction supplémentaire sur le prix soldé — un pourcentage ou un montant fixe, selon le code.',
    de: 'Creator im BOKMOO-Partnerprogramm haben eigene Promo-Codes. Geben Sie einen an der Kasse ein, um einen zusätzlichen Rabatt auf den Sale-Preis zu erhalten — prozentual oder als fester Betrag, je nach Code.',
  },
  code2: {
    en: 'During this sale a creator code applies to the two cards above and can be used on every order.',
    hans: '本次活动期间，创作者折扣码适用于上述两张实体卡，每笔订单都可使用。',
    hant: '本次活動期間，創作者折扣碼適用於上述兩張實體卡，每筆訂單都可使用。',
    ja: '本セール期間中、クリエイターコードは上記の2種類のカードに適用され、すべての注文で使えます。',
    ko: '이번 세일 기간에는 크리에이터 코드가 위 두 가지 카드에 적용되며 모든 주문에서 사용할 수 있습니다.',
    fr: 'Pendant cette vente, un code créateur s’applique aux deux cartes ci-dessus et peut être utilisé sur chaque commande.',
    de: 'Während dieser Aktion gilt ein Creator-Code für die beiden Karten oben und kann bei jeder Bestellung verwendet werden.',
  },
  fineTitle: {
    en: 'Fine print', hans: '细则', hant: '細則', ja: '注意事項', ko: '유의 사항',
    fr: 'Conditions', de: 'Kleingedrucktes',
  },
  fine1: {
    en: 'The sale starts and ends at the times above (UTC). Orders placed outside the window are charged at list price.',
    hans: '活动按上述时间（UTC）开始和结束，活动时间外的订单按原价结算。',
    hant: '活動按上述時間（UTC）開始和結束，活動時間外的訂單按原價結帳。',
    ja: 'セールは上記の時間（UTC）に開始・終了します。期間外の注文は定価での請求となります。',
    ko: '세일은 위 시간(UTC)에 시작하고 종료됩니다. 기간 외 주문은 정가로 결제됩니다.',
    fr: 'La vente commence et se termine aux heures indiquées ci-dessus (UTC). Les commandes passées en dehors de cette période sont facturées au prix normal.',
    de: 'Die Aktion beginnt und endet zu den oben genannten Zeiten (UTC). Bestellungen außerhalb des Zeitraums werden zum regulären Preis berechnet.',
  },
  fine2: {
    en: 'Prices are in US dollars. Shipping, if any, is shown at checkout.',
    hans: '价格以美元计。运费（如有）在结算页显示。',
    hant: '價格以美元計。運費（如有）在結帳頁顯示。',
    ja: '価格は米ドル建てです。送料がある場合はチェックアウト時に表示されます。',
    ko: '가격은 미국 달러 기준입니다. 배송비가 있는 경우 결제 시 표시됩니다.',
    fr: 'Les prix sont en dollars US. Les frais de livraison éventuels sont indiqués au paiement.',
    de: 'Preise in US-Dollar. Versandkosten werden, falls vorhanden, an der Kasse angezeigt.',
  },
  fine3: {
    en: 'The sale price cannot be combined with other promotions. Creator codes are the exception.',
    hans: '活动价不能与其他优惠同时使用，创作者折扣码除外。',
    hant: '活動價不能與其他優惠同時使用，創作者折扣碼除外。',
    ja: 'セール価格は他のプロモーションと併用できません（クリエイターコードを除く）。',
    ko: '세일 가격은 다른 프로모션과 중복 적용되지 않습니다. 크리에이터 코드는 예외입니다.',
    fr: 'Le prix soldé ne se cumule pas avec d’autres promotions, sauf avec les codes créateurs.',
    de: 'Der Sale-Preis ist nicht mit anderen Aktionen kombinierbar. Creator-Codes sind davon ausgenommen.',
  },
  fine4: {
    en: 'We may cancel orders that abuse the campaign, such as fraud, duplicate accounts or self-dealing.',
    hans: '滥用活动（欺诈、重复账号、自买自卖）的订单可能被取消。',
    hant: '濫用活動（欺詐、重複帳號、自買自賣）的訂單可能被取消。',
    ja: '不正、重複アカウント、自己購入などキャンペーンの悪用と判断された注文はキャンセルされる場合があります。',
    ko: '사기, 중복 계정, 자체 구매 등 프로모션을 남용한 주문은 취소될 수 있습니다.',
    fr: 'Nous pouvons annuler les commandes qui abusent de l’offre (fraude, comptes en double, auto-achat).',
    de: 'Bestellungen, die die Aktion missbrauchen (Betrug, Doppelkonten, Eigenkauf), können wir stornieren.',
  },
  fine5: {
    en: 'Questions? Write to support@bokmoo.com.',
    hans: '有疑问请联系 support@bokmoo.com。',
    hant: '有疑問請聯絡 support@bokmoo.com。',
    ja: 'ご質問は support@bokmoo.com まで。',
    ko: '문의: support@bokmoo.com',
    fr: 'Une question ? Écrivez à support@bokmoo.com.',
    de: 'Fragen? Schreiben Sie an support@bokmoo.com.',
  },
} satisfies Record<string, Copy>;

// The two products the promotion covers. Keep in step with the promotion's
// product ids and prices (native_promotions).
const CARDS = [
  { id: 'odoo-product-6', name: 'BOKMOO Card', listPrice: 20, salePrice: 16 },
  { id: 'odoo-product-7', name: 'Bokmoo Bluetooth Card', listPrice: 40, salePrice: 32 },
];

function pick(locale: string | undefined, copy: Copy): string {
  if (locale === 'zh-Hant' || locale === 'zh-HK') return copy.hant;
  if (locale?.startsWith('zh')) return copy.hans;
  if (locale === 'ja') return copy.ja;
  if (locale === 'ko') return copy.ko;
  if (locale === 'fr') return copy.fr;
  if (locale === 'de') return copy.de;
  return copy.en;
}

function Section({ title, items, gold, muted = false }: { title: string; items: string[]; gold: string; muted?: boolean }) {
  return (
    <>
      <h2 className="text-lg font-bold" style={{ color: gold }}>{title}</h2>
      <ul className={`mt-3 space-y-2 leading-relaxed ${muted ? 'text-xs text-white/60' : 'text-sm text-white/85'}`}>
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </>
  );
}

export default function BlackFridayPageClient() {
  const nav = useLocalizedNavigation();
  const L = (copy: Copy) => pick(nav.locale, copy);
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
            href="#bf-cards"
            className="mt-4 inline-block rounded-full px-5 py-2.5 text-sm font-bold text-[#0b0c10] transition hover:opacity-90"
            style={{ backgroundColor: gold }}
          >
            {L(COPY.shopCta)} →
          </a>
        </div>

        <section className="mt-8" id="bf-cards">
          <h2 className="text-lg font-bold" style={{ color: gold }}>{L(COPY.cardsTitle)}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {CARDS.map((card) => (
              <a
                key={card.id}
                href={nav.getHref(`/products/${card.id}`)}
                className="block rounded-2xl border p-5 transition hover:bg-white/10"
                style={{ borderColor: 'rgba(216, 180, 90, 0.4)' }}
              >
                <p className="text-base font-bold text-white">{card.name}</p>
                <p className="mt-1 text-2xl font-black" style={{ color: gold }}>
                  ${card.salePrice.toFixed(2)}
                  <s className="ml-2 text-sm font-normal text-white/50">${card.listPrice.toFixed(2)}</s>
                </p>
                <span className="mt-3 inline-block text-sm font-bold" style={{ color: gold }}>{L(COPY.viewCard)} →</span>
              </a>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <Section title={L(COPY.dealTitle)} items={[L(COPY.deal1), L(COPY.deal2), L(COPY.deal3)]} gold={gold} />
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
          <Section title={L(COPY.codeTitle)} items={[L(COPY.code1), L(COPY.code2)]} gold={gold} />
        </section>

        <section className="mt-8">
          <Section
            title={L(COPY.fineTitle)}
            items={[L(COPY.fine1), L(COPY.fine2), L(COPY.fine3), L(COPY.fine4), L(COPY.fine5)]}
            gold={gold}
            muted
          />
        </section>
      </div>
    </div>
  );
}
