#!/usr/bin/env node
/**
 * Export the theme's translatable copy in the Store Localization (i18n)
 * plugin's import format:
 *
 *   node scripts/export-i18n.mjs > theme-i18n.json
 *   node scripts/export-i18n.mjs --namespace theme.esim --locales ja,ko,fr,de
 *
 * Keys are the English source strings. zh-Hans / zh-Hant come from the
 * inline `hans` / `hant` entries next to each `en`, ja / ko / fr / de from
 * the message catalog in src/i18n, and `en` maps every key to itself so the
 * English copy can be overridden too. Strings with interpolated templates
 * are skipped: they carry their own inline translations and have no stable key.
 *
 * Page metadata (theme.json -> x-jiffoo-seo.pages) is exported the same way:
 * the English title / description of each route is the key, the declared
 * locales are its translations.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const themeRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(themeRoot, '..', '..', '..');

function unescapeJs(value) {
  return value
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\`/g, '`')
    .replace(/\\\\/g, '\\');
}

function argumentValue(argv, name, fallback) {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
}

const namespace = argumentValue(process.argv, '--namespace', 'theme.esim');
const localeFilter = argumentValue(process.argv, '--locales', 'en,zh-Hans,zh-Hant,ja,ko,fr,de').split(',').map((entry) => entry.trim()).filter(Boolean);

const ts = (await import(pathToFileURL(path.join(repoRoot, 'node_modules', 'typescript', 'lib', 'typescript.js')).href)).default;

function themeSources(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'i18n' && entry.name !== 'scripts') themeSources(target, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) {
      out.push(target);
    }
  }
  return out;
}

const staticText = (node) => {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return unescapeJs(node.text);
  return null;
};

/** english source -> { hans, hant } collected from the object literals around each `en`. */
const inline = new Map();
const remember = (english, hans, hant) => {
  const current = inline.get(english) || {};
  if (hans !== null && current.hans === undefined) current.hans = hans;
  if (hant !== null && current.hant === undefined) current.hant = hant;
  inline.set(english, current);
};

for (const file of themeSources(path.join(themeRoot, 'src'))) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node) => {
    // { en: '…', hans: '…', hant: '…' }
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === 'en' && ts.isObjectLiteralExpression(node.parent)) {
      const english = staticText(node.initializer);
      if (english !== null && !english.includes('${')) {
        let hans = null;
        let hant = null;
        for (const sibling of node.parent.properties) {
          if (!ts.isPropertyAssignment(sibling) || !ts.isIdentifier(sibling.name)) continue;
          if (sibling.name.text === 'hans') hans = staticText(sibling.initializer);
          if (sibling.name.text === 'hant') hant = staticText(sibling.initializer);
        }
        remember(english, hans, hant);
      }
    }
    // pickLocalized(configured, 'English default', '简体', '繁體', locale)
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'pickLocalized') {
      const english = staticText(node.arguments[1]);
      if (english !== null) remember(english, staticText(node.arguments[2]), staticText(node.arguments[3]));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

const catalog = {};
for (const locale of ['ja', 'ko', 'fr', 'de']) {
  const file = path.join(themeRoot, 'src', 'i18n', `${locale}.json`);
  if (fs.existsSync(file)) catalog[locale] = JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** english source -> { hans, hant, ja, ko, fr, de } from theme.json -> x-jiffoo-seo.pages */
const pageMetadata = new Map();
const manifest = JSON.parse(fs.readFileSync(path.join(themeRoot, 'theme-pack', 'theme.json'), 'utf8'));
for (const locales of Object.values(manifest['x-jiffoo-seo']?.pages ?? {})) {
  if (!locales.en) continue;
  for (const field of ['title', 'description']) {
    const english = locales.en[field];
    if (typeof english !== 'string') continue;
    const values = {};
    for (const [locale, entry] of Object.entries(locales)) {
      // Same field names as the inline entries: zh-Hans -> hans, zh-Hant -> hant.
      const name = locale === 'zh-Hans' ? 'hans' : locale === 'zh-Hant' ? 'hant' : locale;
      if (locale !== 'en' && typeof entry?.[field] === 'string') values[name] = entry[field];
    }
    pageMetadata.set(english, values);
  }
}

const translations = {};
for (const locale of localeFilter) translations[locale] = { [namespace]: {} };

const report = { keys: inline.size + pageMetadata.size, missing: { 'zh-Hans': 0, 'zh-Hant': 0, ja: 0, ko: 0, fr: 0, de: 0 } };
const sources = [...new Set([...inline.keys(), ...pageMetadata.keys()])].sort((a, b) => a.localeCompare(b));
for (const english of sources) {
  const copy = { ...pageMetadata.get(english), ...(inline.get(english) || {}) };
  if (localeFilter.includes('en')) translations.en[namespace][english] = english;
  if (localeFilter.includes('zh-Hans')) {
    if (copy.hans !== undefined) translations['zh-Hans'][namespace][english] = copy.hans;
    else report.missing['zh-Hans'] += 1;
  }
  if (localeFilter.includes('zh-Hant')) {
    if (copy.hant !== undefined) translations['zh-Hant'][namespace][english] = copy.hant;
    else report.missing['zh-Hant'] += 1;
  }
  for (const locale of ['ja', 'ko', 'fr', 'de']) {
    if (!localeFilter.includes(locale)) continue;
    const value = copy[locale] ?? catalog[locale]?.[english];
    if (typeof value === 'string' && value.trim()) translations[locale][namespace][english] = value;
    else report.missing[locale] += 1;
  }
}

if (process.argv.includes('--report')) {
  for (const [locale, namespaced] of Object.entries(translations)) {
    report[locale] = Object.keys(namespaced[namespace]).length;
  }
  process.stderr.write(`${JSON.stringify(report, null, 1)}\n`);
}
process.stdout.write(`${JSON.stringify({ translations }, null, 1)}\n`);
