import { pickCopy } from '../site';

/**
 * Names and descriptions of the two BOKMOO cards in the seven storefront languages.
 *
 * The catalog keeps one English name and description per product and answers the same text for every
 * language, so on the Chinese storefront the page said "实体 eSIM 卡" above an English name and an English
 * description. These translations stand in while the catalog still carries the English text they were
 * translated from; as soon as the catalog's text changes, the new text is shown as it is.
 */

export interface CardCopy {
  en: string;
  hans: string;
  hant: string;
  ja: string;
  ko: string;
  fr: string;
  de: string;
}

export type CardKind = 'bluetooth' | 'plug-in';

interface KnownCard {
  kind: CardKind;
  /** Product id on the official store; the slug answers for the same product on other reads. */
  keys: string[];
  /** The description the catalog carries, in English. */
  sourceDescription: string;
  name: CardCopy;
  description: CardCopy;
}

const CARDS: KnownCard[] = [
  {
    kind: 'bluetooth',
    keys: ['odoo-product-7', 'bokmoo-ble-v1'],
    sourceDescription:
      'Bokmoo Bluetooth Card — manage multiple eSIM profiles wirelessly. Enable, switch, and organize eSIM plans in the BOKMOO app. No tray tools needed.\n\nThe card connects to your phone over Bluetooth, so you can carry several eSIM profiles on one physical card and move between them in seconds — ideal for travel, separate work and personal lines, or keeping a backup plan ready. Pair it with the BOKMOO app, pick a profile, and it applies over the air.',
    name: {
      en: 'Bokmoo Bluetooth Card',
      hans: 'Bokmoo 蓝牙卡',
      hant: 'Bokmoo 藍牙卡',
      ja: 'Bokmoo Bluetooth カード',
      ko: 'Bokmoo 블루투스 카드',
      fr: 'Carte Bokmoo Bluetooth',
      de: 'Bokmoo Bluetooth-Karte',
    },
    description: {
      en: 'Bokmoo Bluetooth Card — manage multiple eSIM profiles wirelessly. Enable, switch, and organize eSIM plans in the BOKMOO app. No tray tools needed.\n\nThe card connects to your phone over Bluetooth, so you can carry several eSIM profiles on one physical card and move between them in seconds — ideal for travel, separate work and personal lines, or keeping a backup plan ready. Pair it with the BOKMOO app, pick a profile, and it applies over the air.',
      hans: 'Bokmoo 蓝牙卡——无线管理多个 eSIM 配置文件。在 BOKMOO App 里启用、切换和整理 eSIM 套餐，无需取卡针。\n\n卡片通过蓝牙连接手机，一张实体卡上可以携带多个 eSIM 配置文件，几秒内即可切换——适合旅行、工作与个人号码分开使用，或随时备一个备用套餐。配对 BOKMOO App，选一个配置文件，即可空中写入。',
      hant: 'Bokmoo 藍牙卡——無線管理多個 eSIM 設定檔。在 BOKMOO App 裡啟用、切換和整理 eSIM 套餐，無需退卡針。\n\n卡片透過藍牙連接手機，一張實體卡上可以攜帶多個 eSIM 設定檔，幾秒內即可切換——適合旅行、工作與個人門號分開使用，或隨時備一個備用方案。配對 BOKMOO App，選一個設定檔，即可透過空中下載寫入。',
      ja: 'Bokmoo Bluetooth カード——複数の eSIM プロファイルをワイヤレスで管理。BOKMOO アプリで eSIM プランの有効化・切り替え・整理ができ、ピンは不要です。\n\nカードは Bluetooth でスマートフォンに接続するため、1 枚の物理カードに複数の eSIM プロファイルを持ち、数秒で切り替えられます。旅行、仕事用と個人用の回線の使い分け、予備プランの保持に最適です。BOKMOO アプリとペアリングしてプロファイルを選ぶだけで、無線で書き込まれます。',
      ko: 'Bokmoo 블루투스 카드 — 여러 eSIM 프로필을 무선으로 관리하세요. BOKMOO 앱에서 eSIM 요금제를 활성화하고 전환하고 정리할 수 있으며, 핀 도구가 필요 없습니다.\n\n카드가 블루투스로 휴대폰에 연결되므로 실제 카드 한 장에 여러 eSIM 프로필을 담고 몇 초 만에 전환할 수 있습니다. 여행, 업무용·개인용 회선 분리, 예비 요금제 준비에 적합합니다. BOKMOO 앱과 페어링하고 프로필을 선택하면 무선으로 적용됩니다.',
      fr: 'Carte Bokmoo Bluetooth — gérez plusieurs profils eSIM sans fil. Activez, changez et organisez vos forfaits eSIM dans l’application BOKMOO, sans outil d’éjection.\n\nLa carte se connecte à votre téléphone en Bluetooth : vous pouvez garder plusieurs profils eSIM sur une seule carte physique et passer de l’un à l’autre en quelques secondes — idéal pour voyager, séparer lignes pro et perso, ou garder un forfait de rechange prêt. Jumelez-la avec l’application BOKMOO, choisissez un profil, et il s’applique à distance.',
      de: 'Bokmoo Bluetooth-Karte – mehrere eSIM-Profile drahtlos verwalten. eSIM-Tarife in der BOKMOO-App aktivieren, wechseln und ordnen – ohne Simnad.\n\nDie Karte verbindet sich per Bluetooth mit Ihrem Smartphone, sodass Sie mehrere eSIM-Profile auf einer physischen Karte tragen und in Sekunden wechseln können – ideal zum Reisen, für getrennte Geschäfts- und Privatanschlüsse oder einen bereiten Ersatztarif. Mit der BOKMOO-App koppeln, Profil wählen – und er wird drahtlos aufgespielt.',
    },
  },
  {
    kind: 'plug-in',
    keys: ['odoo-product-6', 'bokmoo-card-v1'],
    sourceDescription:
      'Bokmoo Card V1 — plug-in smart card that installs eSIM profiles directly on your phone. Works with the BOKMOO app; eSIM plan service is rolling out soon.\n\nInsert the card, open the BOKMOO app, and load your eSIM profile straight onto the card — a simple way to carry a second line or keep a backup of your main eSIM. No Bluetooth pairing required.',
    name: {
      en: 'Bokmoo Card',
      hans: 'Bokmoo 实体卡',
      hant: 'Bokmoo 實體卡',
      ja: 'Bokmoo カード',
      ko: 'Bokmoo 카드',
      fr: 'Carte Bokmoo',
      de: 'Bokmoo Karte',
    },
    description: {
      en: 'Bokmoo Card V1 — plug-in smart card that installs eSIM profiles directly on your phone. Works with the BOKMOO app; eSIM plan service is rolling out soon.\n\nInsert the card, open the BOKMOO app, and load your eSIM profile straight onto the card — a simple way to carry a second line or keep a backup of your main eSIM. No Bluetooth pairing required.',
      hans: 'Bokmoo 实体卡——即插即用的智能卡，把 eSIM 配置文件直接装进手机。配合 BOKMOO App 使用。\n\n插入卡片，打开 BOKMOO App，即可把 eSIM 配置文件直接写入卡中——轻松带上第二个号码，或为主 eSIM 留一份备份。无需蓝牙配对。',
      hant: 'Bokmoo 實體卡——即插即用的智慧卡，把 eSIM 設定檔直接安裝到手機。搭配 BOKMOO App 使用。\n\n插入卡片，開啟 BOKMOO App，即可把 eSIM 設定檔直接寫入卡中——輕鬆攜帶第二個門號，或為主要 eSIM 保留一份備份。無需藍牙配對。',
      ja: 'Bokmoo カード——eSIM プロファイルをスマートフォンに直接インストールする、差し込むだけのスマートカード。BOKMOO アプリと併用します。\n\nカードを差し込み、BOKMOO アプリを開いて、eSIM プロファイルをカードに直接書き込みます。2 番目の回線を持ったり、メインの eSIM のバックアップを取ったりする簡単な方法です。Bluetooth のペアリングは不要です。',
      ko: 'Bokmoo 카드 — eSIM 프로필을 휴대폰에 바로 설치하는 꽂기만 하면 되는 스마트 카드. BOKMOO 앱과 함께 사용합니다.\n\n카드를 꽂고 BOKMOO 앱을 연 다음 eSIM 프로필을 카드에 바로 불러오세요. 두 번째 회선을 들고 다니거나 주 eSIM의 백업을 유지하는 간단한 방법입니다. 블루투스 페어링은 필요 없습니다.',
      fr: 'Carte Bokmoo — une carte à puce à insérer qui installe vos profils eSIM directement sur votre téléphone. S’utilise avec l’application BOKMOO.\n\nInsérez la carte, ouvrez l’application BOKMOO et chargez votre profil eSIM directement sur la carte — une façon simple de transporter une seconde ligne ou de garder une sauvegarde de votre eSIM principale. Aucun jumelage Bluetooth requis.',
      de: 'Bokmoo Karte – eine einzusteckende Smartcard, die eSIM-Profile direkt auf Ihrem Smartphone installiert. Funktioniert mit der BOKMOO-App.\n\nKarte einstecken, BOKMOO-App öffnen und Ihr eSIM-Profil direkt auf die Karte laden – ein einfacher Weg, einen zweiten Anschluss dabei zu haben oder eine Sicherung Ihrer Haupt-eSIM zu behalten. Kein Bluetooth-Koppeln nötig.',
    },
  },
];

const squash = (value: unknown): string => String(value ?? '').replace(/\s+/g, ' ').trim();

/** The known card a product is, by its id or its slug; null for anything else. */
export function knownCardOf(product: { id?: string | null; sku?: string | null; slug?: string | null } | null | undefined): KnownCard | null {
  if (!product) return null;
  const keys = [product.id, product.sku, product.slug].map((key) => String(key ?? '').toLowerCase());
  return CARDS.find((card) => card.keys.some((key) => keys.includes(key))) ?? null;
}

/** 'bluetooth' for the Bluetooth card, 'plug-in' for the basic card, null for anything else. */
export function cardKindOf(product: Parameters<typeof knownCardOf>[0]): CardKind | null {
  return knownCardOf(product)?.kind ?? null;
}

/** The English description the catalog carries for a known card; '' for anything else. */
export function catalogCardDescription(product: Parameters<typeof knownCardOf>[0]): string {
  return knownCardOf(product)?.sourceDescription ?? '';
}

/** The card's name in the storefront language. The catalog's own name is used in English and for unknown products. */
export function cardName(product: Parameters<typeof knownCardOf>[0], locale: string | undefined): string | null {
  const card = knownCardOf(product);
  if (!card) return null;
  return pickCopy(locale, card.name);
}

/**
 * The card's description in the storefront language — only while the catalog still carries the English
 * text it was translated from, so a description the store owner rewrites is shown as written.
 */
export function cardDescription(product: Parameters<typeof knownCardOf>[0] & { description?: string | null }, locale: string | undefined): string | null {
  const card = knownCardOf(product);
  if (!card) return null;
  if (squash(product.description) !== squash(card.sourceDescription)) return null;
  return pickCopy(locale, card.description);
}

/** The card's name in the storefront language, falling back to the name the cart or the order stored. */
export function cardLineName(item: { productId?: string | null; variantId?: string | null; productName?: string | null; sku?: string | null }, locale: string | undefined): string {
  return cardName({ id: item.productId, sku: item.sku }, locale) ?? String(item.productName ?? '');
}
