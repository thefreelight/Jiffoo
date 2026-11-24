import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { CATALOG_LOCALES, themeMessage } from './index';
import { pickCopy, resolveEsimSiteConfig } from '../site';
import { itemStatusLabel, localeTag, orderStatusLabel } from '../lib/esim/order-copy';
import {
  buildDestinationCatalog,
  destinationLabel,
  planTitle,
  regionLabelOf,
  searchDestinations,
} from '../lib/esim/catalog';
import type { EsimApiProduct } from '../lib/api';

const SRC = join(import.meta.dirname, '..');

function themeSources(dir = SRC): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== 'i18n' && name !== 'node_modules') out.push(...themeSources(path));
    } else if (/\.tsx?$/.test(name) && !/\.test\.ts$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

test('every catalog locale carries the same key set with non-empty translations', () => {
  const keySets = CATALOG_LOCALES.map((locale) => {
    const raw = JSON.parse(readFileSync(join(SRC, 'i18n', `${locale}.json`), 'utf8')) as Record<string, string>;
    for (const [english, translated] of Object.entries(raw)) {
      assert.equal(typeof translated, 'string', `${locale} value for ${JSON.stringify(english)} must be a string`);
      assert.ok(translated.trim(), `${locale} translation of ${JSON.stringify(english)} is empty`);
    }
    return Object.keys(raw).sort();
  });
  for (const keys of keySets) assert.deepEqual(keys, keySets[0]);
});

test('every static English source string in the theme has a ja/ko/fr/de catalog translation', () => {
  // These defaults are resolved from the theme defaultConfig (plain strings, not `en:` records).
  const plainDefaults = ['BOKMOO eSIM Card', 'One Card.\nGlobal Connection.', 'Shop eSIM Plans', 'How it works'];
  const missing: string[] = [];
  for (const file of themeSources()) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const record = (node: ts.Node) => {
      if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === 'en') {
        const init = node.initializer;
        const text = ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init) ? init.text : null;
        // Interpolated templates carry their own inline translations at the call site.
        if (text !== null) {
          const catalogs = CATALOG_LOCALES.filter((locale) => themeMessage(locale, text) === null);
          if (catalogs.length) missing.push(`${relative(SRC, file)}: ${JSON.stringify(text)} lacks ${catalogs.join('/')}`);
        }
      }
      ts.forEachChild(node, record);
    };
    record(source);
  }
  for (const english of plainDefaults) {
    const catalogs = CATALOG_LOCALES.filter((locale) => themeMessage(locale, english) === null);
    if (catalogs.length) missing.push(`site.ts default: ${JSON.stringify(english)} lacks ${catalogs.join('/')}`);
  }
  assert.deepEqual(missing, []);
});

test('no raw JSX text renders English copy outside the brand / OS allowlist', () => {
  // Anything else between tags bypasses pickCopy and shows English on every locale.
  const allowed = new Set(['BOKMOO', 'BOKMOO App', 'iOS', 'Android', 'iPhone · iPad', 'Android 9.0+', 'ICCID ····', 'Google', 'Apple']);
  const offenders: string[] = [];
  for (const file of themeSources().filter((path) => path.endsWith('.tsx'))) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      if (ts.isJsxText(node)) {
        const text = node.getText(source).replace(/\s+/g, ' ').trim();
        if (/[A-Za-z]{2,}/.test(text) && !allowed.has(text)) {
          offenders.push(`${relative(SRC, file)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1} ${JSON.stringify(text)}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.deepEqual(offenders, []);
});

test('no component resolves copy by hand (everything goes through pickCopy)', () => {
  // A local `locale === 'zh-Hant' ? copy.hant : copy.en` helper silently drops
  // ja/ko/fr/de even when the call site carries the translations.
  const dataModules = new Set(['site.ts', 'lib/esim/catalog.ts']);
  const offenders: string[] = [];
  for (const file of themeSources()) {
    const rel = relative(SRC, file);
    if (dataModules.has(rel) || rel.endsWith('.test.ts')) continue;
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    // `{ en: section.en.title, hans: section.hans.title }` handed to pickCopy is the supported way to lift nested copy.
    const insideCopyArgument = (node: ts.Node): boolean => {
      for (let current = node.parent; current; current = current.parent) {
        if (ts.isCallExpression(current)) return current.arguments.some((argument) => argument.pos <= node.pos && argument.end >= node.end);
        if (ts.isArrowFunction(current) || ts.isFunctionLike(current)) return false;
      }
      return false;
    };
    const visit = (node: ts.Node) => {
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)
        && ['hans', 'hant', 'ja', 'ko', 'fr', 'de'].includes(node.name.text)
        && !insideCopyArgument(node)) {
        offenders.push(`${rel}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1} ${node.getText(source)}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.deepEqual(offenders, []);
});

test('pickCopy resolves each storefront locale without falling back to English by accident', () => {
  const copy = { en: 'Hello', hans: '你好', hant: '你好' };
  assert.equal(pickCopy('en', copy), 'Hello');
  assert.equal(pickCopy('zh-Hans', copy), '你好');
  assert.equal(pickCopy('zh-Hant', copy), '你好');
  // ja/ko/fr/de: an explicit entry wins, otherwise the catalog translates the English source.
  assert.equal(pickCopy('ja', { ...copy, ja: 'こんにちは' }), 'こんにちは');
  assert.equal(pickCopy('de', { en: 'Password', hans: '密码', hant: '密碼' }), 'Passwort');
  assert.equal(pickCopy('fr', { en: 'Sign in', hans: '登录', hant: '登入' }), 'Se connecter');
  assert.equal(pickCopy('ko', { en: 'Orders', hans: '订单', hant: '訂單' }), '주문');
  // Unknown sources and unknown locales fall back to English rather than crashing.
  assert.equal(pickCopy('ja', { en: 'zz-untranslated-source' }), 'zz-untranslated-source');
  assert.equal(pickCopy(undefined, copy), 'Hello');
});

test('translations kept in the Store Localization plugin win over the built-in copy', () => {
  const root = globalThis as unknown as Record<string, unknown>;
  root.__JIFFOO_THEME_I18N__ = {
    messages: {
      de: { 'theme.esim': { Password: 'Kennwort (Plugin)', 'Shop eSIM Plans': 'Tarife im Plugin' }, common: { Password: 'ignored' } },
      'zh-Hans': { 'theme.esim': { Password: '插件译文' } },
      ja: { 'theme.esim': { Password: '   ' } },
    },
  };
  try {
    // Only this theme's namespace is consulted, for the page's own locale only.
    assert.equal(pickCopy('de', { en: 'Password', hans: '密码', hant: '密碼' }), 'Kennwort (Plugin)');
    assert.equal(pickCopy('zh-Hans', { en: 'Password', hans: '密码', hant: '密碼' }), '插件译文');
    // The theme's defaultConfig copy goes through the same override.
    assert.equal(resolveEsimSiteConfig(undefined, 'de').primaryCtaLabel, 'Tarife im Plugin');
    // A blank plugin value means "no override": built-ins stay in charge.
    assert.equal(pickCopy('ja', { en: 'Password', hans: '密码', hant: '密碼' }), 'パスワード');
    assert.equal(pickCopy('en', { en: 'Password', hans: '密码', hant: '密碼' }), 'Password');
  } finally {
    delete root.__JIFFOO_THEME_I18N__;
  }
  // Without the registry nothing changes.
  assert.equal(pickCopy('de', { en: 'Password', hans: '密码', hant: '密碼' }), 'Passwort');
});

test('order status and date tags follow the storefront locale', () => {
  assert.equal(orderStatusLabel('DELIVERED', 'ja'), '完了');
  assert.equal(orderStatusLabel('PAID', 'ko'), '결제 완료');
  assert.equal(itemStatusLabel('delivered', 'fr'), 'Livré');
  assert.equal(itemStatusLabel('processing', 'de'), 'In Bearbeitung');
  assert.equal(itemStatusLabel('delivered', 'zh-Hant'), '已交付');
  // Unknown enum values read as words instead of raw identifiers.
  assert.equal(orderStatusLabel('OUT_FOR_DELIVERY', 'en'), 'OUT FOR DELIVERY');
  assert.equal(localeTag('zh-Hant'), 'zh-TW');
  assert.equal(localeTag('ko'), 'ko-KR');
  assert.equal(localeTag(undefined), 'en-US');
});

test('region and destination names resolve in all seven locales', () => {
  assert.equal(regionLabelOf('CN', 'de'), 'Festlandchina');
  assert.equal(regionLabelOf('GC', 'ja'), '大中華圏');
  assert.equal(regionLabelOf('HKMO-1GB-7D', 'ko'), '홍콩·마카오');
  assert.equal(regionLabelOf('EU', 'zh-Hans'), '欧洲');
  assert.equal(regionLabelOf('XX', 'en'), null);
  assert.equal(destinationLabel('JP', 'fr'), 'Japon');
  assert.equal(destinationLabel('ZZ', 'de'), 'ZZ');
  // Search matches every spelling of a place, including city aliases.
  assert.equal(searchDestinations('东京')[0].code, 'JP');
  assert.equal(searchDestinations('東京')[0].code, 'JP');
  assert.equal(searchDestinations('japan')[0].code, 'JP');
  assert.equal(searchDestinations('日本')[0].code, 'JP');
  assert.equal(searchDestinations('도쿄')[0].code, 'JP');
  assert.equal(searchDestinations('서울')[0].code, 'KR');
  assert.equal(searchDestinations('Seoul')[0].code, 'KR');
  assert.equal(searchDestinations('Corée')[0].code, 'KR');
  assert.equal(searchDestinations('호치민')[0].code, 'VN');
  assert.equal(searchDestinations('오사카')[0].code, 'JP');
  assert.equal(searchDestinations('베이징')[0].code, 'CN');
  // An unknown query returns an empty result (never a wrong destination).
  assert.deepEqual(searchDestinations('zz-no-such-place'), []);
  // An empty query surfaces the popular destinations.
  assert.ok(searchDestinations('').every((entry) => entry.popular));
});

test('plan titles are built from the SKU in the storefront locale', () => {
  assert.equal(planTitle('boss-CN-10GB-30D', '目录名', 'de'), 'Festlandchina 10 GB / 30 Tage');
  assert.equal(planTitle('boss-HKMO-1GB-7D', 'x', 'fr'), 'Hong Kong & Macao 1 Go / 7 jours');
  assert.equal(planTitle('boss-HKMO-1GB-1D', 'x', 'fr'), 'Hong Kong & Macao 1 Go / 1 jour');
  assert.equal(planTitle('boss-JK-5GB-10D', 'x', 'ja'), '日本・韓国 5GB / 10日間');
  assert.equal(planTitle('boss-JK-5GB-10D', 'x', 'ko'), '일본·한국 5GB / 10일');
  assert.equal(planTitle('boss-JK-5GB-10D', 'x', 'en'), 'Japan & Korea 5GB / 10 days');
  assert.equal(planTitle('boss-JK-5GB-1D', 'x', 'en'), 'Japan & Korea 5GB / 1 day');
  // zh-Hans keeps the richer Simplified catalog name; zh-Hant is titled from the SKU because the
  // catalog name is Simplified. Unparseable SKUs keep the catalog name everywhere.
  assert.equal(planTitle('boss-JK-5GB-10D', '目录名', 'zh-Hans'), '目录名');
  assert.equal(planTitle('boss-JK-5GB-10D', '目录名', 'zh-Hant'), '日韓 5GB / 10 天');
  assert.equal(planTitle('boss-WEIRD', '目录名', 'de'), '目录名');
  assert.equal(planTitle(undefined, '目录名', 'ja'), '目录名');
});

test('destination catalog is derived from product coverage and sorted for the locale', () => {
  const product = (id: string, destinations: string[], price: number) =>
    (({ id, name: id, price, typeData: { esim: { destinations } } }) as unknown as EsimApiProduct);
  const products = [product('boss-SEA-5GB-10D', ['TH', 'MY', 'SG'], 12), product('boss-JP-3GB-7D', ['JP'], 9)];
  const catalog = buildDestinationCatalog(products, 'ja');
  // Popular destinations first, then alphabetical in the locale (ja: シンガポール < タイ < 日本).
  assert.deepEqual(catalog.map((entry) => entry.info.code), ['SG', 'TH', 'JP', 'MY']);
  assert.equal(catalog[1].planCount, 1);
  // Coverage codes the registry does not name are skipped rather than shown raw.
  assert.deepEqual(buildDestinationCatalog([product('x', ['ZZ'], 1)], 'en'), []);
});

type PageSeo = { title?: string; description?: string };
const SEO_LOCALES = ['en', 'zh-Hans', 'zh-Hant', ...CATALOG_LOCALES];

function declaredPageSeo(): Record<string, Record<string, PageSeo | undefined>> {
  const manifest = JSON.parse(readFileSync(join(SRC, '..', 'theme-pack', 'theme.json'), 'utf8')) as {
    'x-jiffoo-seo'?: { pages: Record<string, Record<string, PageSeo | undefined>> };
  };
  return manifest['x-jiffoo-seo']?.pages ?? {};
}

test('page metadata in theme.json is complete in all seven storefront locales', () => {
  const pages = declaredPageSeo();
  assert.ok(Object.keys(pages).length > 0, 'theme.json declares no page metadata');

  for (const [route, locales] of Object.entries(pages)) {
    const english = locales.en;
    assert.ok(english?.title && english?.description, `${route}: the English source is required`);
    for (const locale of SEO_LOCALES) {
      const entry = locales[locale];
      assert.ok(entry?.title?.trim(), `${route}: ${locale} title is missing`);
      assert.ok(entry?.description?.trim(), `${route}: ${locale} description is missing`);
      for (const field of ['title', 'description'] as const) {
        // The host fills `{brand}` per storefront, so a translation keeps or drops it exactly like its source.
        assert.equal(
          entry[field]!.includes('{brand}'),
          english[field]!.includes('{brand}'),
          `${route} ${locale} ${field}: {brand} must match the English source`,
        );
        assert.equal(/\$\{/.test(entry[field]!), false, `${route} ${locale} ${field}: only {brand} may be interpolated`);
      }
      assert.ok(entry.title!.length <= 70, `${route} ${locale}: title is ${entry.title!.length} characters`);
      assert.ok(entry.description!.length <= 170, `${route} ${locale}: description is ${entry.description!.length} characters`);
    }
  }
});

test('page metadata is exported for the Store Localization plugin like every other string', () => {
  const exported = JSON.parse(execFileSync(
    process.execPath,
    [join(SRC, '..', 'scripts', 'export-i18n.mjs')],
    { encoding: 'utf8' },
  )) as { translations: Record<string, Record<string, Record<string, string>>> };

  for (const [route, locales] of Object.entries(declaredPageSeo())) {
    for (const locale of SEO_LOCALES) {
      for (const field of ['title', 'description'] as const) {
        const english = locales.en![field]!;
        assert.equal(exported.translations[locale]?.['theme.esim']?.[english], locales[locale]![field], `${route} ${locale} ${field}`);
      }
    }
  }
});
