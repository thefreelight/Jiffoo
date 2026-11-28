import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ts from 'typescript';
import { getMessages } from 'shared/src/i18n';
import { I18nProvider } from 'shared/src/i18n/react';
import { AffiliateNativeWorkspace } from '@/components/plugins/AffiliateNativeWorkspace';
import type { AffiliateNativeOverviewData } from '@/lib/hooks/use-api';

/**
 * The admin says everything through the dictionary (2026-11-28). Before this, 797 of the keys its pages asked for had
 * no 简体中文, and 505 pieces of English were written straight into components — so the Chinese admin read as two
 * languages at once. These checks read the sources the way the compiler does and fail when it starts again:
 *
 *  - a key a page asks for that 简体中文 does not have (the English at the call site would then show);
 *  - a key that is both a label and a section (one of the two can never be found);
 *  - English written into a component — text, a placeholder, a label, a toast, a message kept in state, the words a
 *    failure falls back to — unless it is one of the named exceptions below;
 *  - a line of 简体中文 that is still English (a code, a unit or a brand excepted);
 *  - and the affiliate workspace, rendered in 简体中文, reads as Chinese.
 */

const ADMIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCOPE = ['app', 'components', 'lib', 'hooks'];
const SKIP_DIRS = new Set(['node_modules', '.next', '.open-next', 'tests', '__tests__']);
const rel = (file: string) => path.relative(ADMIN, file).split(path.sep).join('/');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) sourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec|stories)\.|\.d\.ts$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** The files a page can reach: every file under app/, and whatever they import, directly or through each other. */
function reachableFiles(): Set<string> {
  const exists = (base: string) => [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')].find((candidate) => /\.(ts|tsx)$/.test(candidate) && fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  const resolve = (from: string, spec: string) => spec.startsWith('@/') ? exists(path.join(ADMIN, spec.slice(2))) : spec.startsWith('.') ? exists(path.resolve(path.dirname(from), spec)) : undefined;
  const seen = new Set<string>();
  const queue = SCOPE.includes('app') ? sourceFiles(path.join(ADMIN, 'app')) : [];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = fs.readFileSync(file, 'utf8');
    const pattern = /(?:import|export)\s+(?:[\s\S]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
    for (const match of source.matchAll(pattern)) {
      const target = resolve(file, match[1] ?? match[2] ?? match[3]!);
      if (target && !seen.has(target)) queue.push(target);
    }
  }
  return seen;
}

function flatten(value: unknown, prefix = '', out = new Map<string, string>()): Map<string, string> {
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (inner && typeof inner === 'object') flatten(inner, full, out);
    else if (!out.has(full)) out.set(full, String(inner));
  }
  return out;
}
// the admin's own dictionaries: merchant (which also holds the legacy admin.* lines) and common
const namespace = (locale: 'zh-Hans' | 'en') => getMessages(locale, 'tenant');
const dictionaryOf = (locale: 'zh-Hans' | 'en') => {
  const messages = namespace(locale) as unknown as { merchant: unknown; common: unknown; admin?: unknown };
  const merged = new Map<string, string>();
  for (const part of [messages.common, messages.merchant]) for (const [key, value] of flatten(part)) if (!merged.has(key)) merged.set(key, value);
  return merged;
};
const chinese = dictionaryOf('zh-Hans');
const english = dictionaryOf('en');

/** Keys asked for with a key kept on a record or built at run time; the scan below cannot see those. */
const KEYS_ASKED_AT_RUN_TIME = [
  // the shipping operations name themselves by a key kept on each action
  'merchant.plugins.workspace.shipping.action.createLabelOrder', 'merchant.plugins.workspace.shipping.action.createPickupOrder',
  'merchant.plugins.workspace.shipping.action.queryTracking', 'merchant.plugins.workspace.shipping.action.subscribeTracking',
  'merchant.plugins.workspace.shipping.action.createShipmentOrder', 'merchant.plugins.workspace.shipping.action.getShipmentOrder',
  'merchant.plugins.workspace.shipping.action.cancelShipmentOrder', 'merchant.plugins.workspace.shipping.action.getShippingLabel',
  // the affiliate helpers take the translator as an argument
  'merchant.plugins.workspace.affiliate.error.nameTooShort', 'merchant.plugins.workspace.affiliate.error.ownerRequired',
  'merchant.plugins.workspace.affiliate.error.organizationRate', 'merchant.plugins.workspace.affiliate.scope.summaryAll',
  'merchant.plugins.workspace.affiliate.scope.summarySelected', 'merchant.plugins.workspace.affiliate.scope.summaryExcept',
  // option lists outside a component carry the key of each line
  'merchant.settings.apiToken.scopeCatalogRead', 'merchant.settings.apiToken.scopeCartWrite', 'merchant.settings.apiToken.scopeCheckoutCreate',
  'merchant.settings.apiToken.scopeOrdersRead', 'merchant.settings.apiToken.scopeAllAccess',
  'merchant.settings.general.storeNamePlaceholder', 'merchant.settings.general.storeDescriptionPlaceholder',
  'merchant.settings.timezone.utc', 'merchant.settings.timezone.newYork', 'merchant.settings.timezone.losAngeles', 'merchant.settings.timezone.london',
  'merchant.settings.timezone.shanghai', 'merchant.settings.timezone.hongKong', 'merchant.settings.timezone.taipei', 'merchant.settings.timezone.tokyo',
];

/** English that stays, each for its own reason. A new line here is a decision to leave it in English, not a fix. */
const EXCLUDED_FILES = new Set([
  'lib/extension-catalog-zh.ts', // this is the Chinese itself: its English is what English readers see
]);
/** A route handler answers a request; its words never reach a screen. */
const isRouteHandler = (file: string) => /\/route\.ts$/.test(file);

/** Keys whose English is put together at the call site (a name is placed in the sentence); the English stays there. */
const ENGLISH_BUILT_AT_RUN_TIME = new Set(['merchant.warehouses.deleteConfirm', 'admin.health.alerts.validationError']);
const ENGLISH_THAT_STAYS = new Set([
  // the root layout sits outside the locale segment: its description is for search engines and crawlers
  'app/layout.tsx|Operational admin workspace for commerce teams',
  // an example of the JSON a merchant pastes in
  'components/plugins/I18nTranslationsPanel.tsx|{ "Sign in": "ログイン", "Password": "パスワード" }',
  // a carrier's name
  'components/plugins/PluginNativeWorkspaces.tsx|Kuaidi100',
  // the English beside its own translation, for English readers
  'components/ui/dialog.tsx|Close',
  // the name of a language in that language
  'app/[locale]/settings/page.tsx|English',
]);

/** A code, a unit, a brand or an example address: allowed to stand without Chinese. */
const NOT_COPY = /^(?:N\/A|API Key|yourstore|zhang-san|WH-MAIN|[A-Z]{2,5}|v\d.*|\d[\d.,%]*|USD|CNY|EUR|GBP|HKD|TWD|SKU|SEO(?: .*)?|API|App|eSIM|AI|AEO|JSON|URL|SMTP.*|OAuth.*|MCP.*|JWT|HTML|CSS|Docker.*|Kubernetes.*|Next\.js.*|Stripe.*|Odoo|BOKMOO.*|Firepath.*|RemoteRadar.*|Game Stats|Imager AI|Kuaidi100|4PX.*|Jiffoo.*|VIP|Pro|Telegram|WhatsApp|Google.*|Facebook.*|Apple.*|Meta|OpenAI|DeepSeek|Moonshot.*|Qwen.*|Z\.ai.*|Zhipu.*|GLM.*|Claude.*|gpt-.*|whsec_|sk_|pk_|rk_|GOCSPX|example\.com.*|https?.*|\/.*|UTC|America\/.*|Europe\/.*|Asia\/.*|localhost.*|\{.*\}|—|–|·|→|↗|⬇|×|✓|\.{3}|…|%)$/i;

interface Read {
  asked: Map<string, { english: string[]; where: Set<string> }>;
  hardcoded: Array<{ file: string; line: number; kind: string; text: string }>;
}

const hasWords = (text: string) => /[A-Za-z]{3,}/.test(text) && (/[A-Za-z]{3,}\s+[A-Za-z]{2,}/.test(text) || /[A-Z][a-z]{2,}/.test(text)) && !/^\/|:\/\//.test(text);
const TEXT_ATTRIBUTES = new Set(['placeholder', 'title', 'alt', 'aria-label', 'aria-placeholder', 'label', 'description', 'helperText', 'tooltip']);
const LABEL_PROPERTIES = new Set(['label', 'description', 'placeholder', 'tooltip', 'helperText', 'emptyText', 'subtitle', 'heading', 'hint']);
/** attributes that are not read as words */
const NOT_READ = /^(className|src|href|variant|icon|to|as|for|id|key|value|type|name|alt|title|d|fill|stroke|width|height|viewBox|xmlns|data-[\w-]+|aria-hidden|role|tabIndex|target|rel|autoComplete|spellCheck|dir|lang)$/;

function readAdmin(): Read {
  const asked: Read['asked'] = new Map();
  const hardcoded: Read['hardcoded'] = [];
  const live = reachableFiles();
  for (const scope of SCOPE) {
    for (const file of sourceFiles(path.join(ADMIN, scope))) {
      if (EXCLUDED_FILES.has(rel(file)) || isRouteHandler(rel(file))) continue;
      if (!live.has(file)) continue; // no page reaches this file: nothing in it is shown
      const source = fs.readFileSync(file, 'utf8');
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const lineOf = (node: ts.Node) => ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
      const textOf = (node: ts.Node | undefined) => (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null);
      const where = rel(file);
      const reachable = live.has(file);

      // the translators of this file: useT() (a raw t), useWorkspaceText(), and a local (key, fallback) function
      const helpers = new Map<ts.FunctionLikeDeclaration, Map<string, 'raw' | 'workspace' | 'getText'>>();
      const collect = (node: ts.Node, outer: ts.FunctionLikeDeclaration | null) => {
        if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.name) && outer) {
          const init = node.initializer;
          const byCall = ts.isCallExpression(init) && ts.isIdentifier(init.expression) ? (init.expression.text === 'useT' ? 'raw' : init.expression.text === 'useWorkspaceText' ? 'workspace' : null) : null;
          const local = (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) && init.parameters.length >= 2 && ts.isIdentifier(init.parameters[0].name) && /^(key|k)$/i.test(init.parameters[0].name.text) && ts.isIdentifier(init.parameters[1].name) && /fallback|fb|english/i.test(init.parameters[1].name.text);
          if (byCall || local) {
            if (!helpers.has(outer)) helpers.set(outer, new Map());
            helpers.get(outer)!.set(node.name.text, byCall ?? 'getText');
          }
        }
        let next = outer;
        if (ts.isFunctionLike(node) && 'body' in node && node.body) next = node as ts.FunctionLikeDeclaration;
        ts.forEachChild(node, (child) => collect(child, next));
      };
      collect(ast, null);
      const enclosing = (node: ts.Node) => [...helpers.keys()].filter((fn) => fn.pos <= node.pos && fn.end >= node.end).sort((a, b) => b.pos - a.pos)[0];
      const translatorOf = (node: ts.Node) => {
        for (const scope of [enclosing(node), null]) {
          for (const [name, kind] of helpers.get(scope as ts.FunctionLikeDeclaration) ?? []) if (kind !== 'raw') return { name, kind };
        }
        return null;
      };
      /** a line of a list written outside a component carries the key it is looked up by at render */
      const carriesItsKey = (property: ts.PropertyAssignment) => {
        const siblings = (property.parent as ts.ObjectLiteralExpression).properties.filter(ts.isPropertyAssignment);
        const names = siblings.filter((sibling) => sibling.name && ts.isIdentifier(sibling.name)).map((sibling) => (sibling.name as ts.Identifier).text);
        if (names.some((name) => /Key$/.test(name) || name === 'labelZhHans')) return true;
        const value = siblings.find((sibling) => sibling.name && ts.isIdentifier(sibling.name) && (sibling.name as ts.Identifier).text === 'value');
        return textOf(value?.initializer) !== null && ['en', 'zh-Hans', 'zh-Hant'].includes(textOf(value!.initializer)!);
      };
      /** the lines a choice on the screen is between */
      const branchesOf = (expression: ts.Expression | undefined): ts.Expression[] => {
        if (!expression) return [];
        if (ts.isParenthesizedExpression(expression)) return branchesOf(expression.expression);
        if (ts.isConditionalExpression(expression)) {
          // the English beside its own translation is what English readers get: `t('k') !== 'k' ? t('k') : 'English'`
          if (/(^|[^\w.])t\(/.test(expression.getText(ast))) return [];
          return [...branchesOf(expression.whenTrue), ...branchesOf(expression.whenFalse)];
        }
        return ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression) ? [expression] : [];
      };
      const flag = (kind: string, text: string, node: ts.Node, property?: ts.PropertyAssignment) => {
        if (!reachable || !hasWords(text)) return;
        if (property && carriesItsKey(property)) return;
        const key = `${where}|${text}`;
        if (ENGLISH_THAT_STAYS.has(key)) return;
        hardcoded.push({ file: where, line: lineOf(node), kind, text });
      };

      const visit = (node: ts.Node) => {
        const call = ts.isCallExpression(node) && ts.isIdentifier(node.expression) ? node.expression.text : null;
        // only a call of the translator is a translation: cn('rounded-md …') in the same component is not
        const found = call === null ? null : translatorOf(node);
        const translator = found && found.name === call ? found : null;
        const byName = call !== null && !translator && ['getText', 'tf', 'translate'].includes(call);
        const workspacePrefix = translator?.kind === 'workspace' || (byName && call === 'tf') ? 'merchant.plugins.workspace.' : '';
        if (ts.isCallExpression(node) && (translator || byName)) {
          const first = textOf(node.arguments[0]);
          if (first !== null && first.includes('.')) {
            const key = first.startsWith('common.') ? first : `${workspacePrefix}${first}`;
            if (!asked.has(key)) asked.set(key, { english: [], where: new Set() });
            asked.get(key)!.where.add(where);
            const second = textOf(node.arguments[1]);
            if (second !== null) asked.get(key)!.english.push(second);
          }
        }
        if (ts.isPropertyAssignment(node) && /[A-Za-z]Key$/.test(node.name.getText(ast)) && ts.isStringLiteral(node.initializer) && /^[a-z][\w]*(\.[\w-]+)+$/.test(node.initializer.text)) {
          const key = /^(merchant|common|admin)\./.test(node.initializer.text) ? node.initializer.text : `merchant.plugins.workspace.${node.initializer.text}`;
          if (!asked.has(key)) asked.set(key, { english: [], where: new Set() });
          asked.get(key)!.where.add(where);
        }
        // a choice between two lines shown on the screen: {open ? 'Collapse' : 'Expand'} between tags, or in an attribute that is read
        if (ts.isJsxAttribute(node) && node.initializer && ts.isJsxExpression(node.initializer) && !NOT_READ.test(node.name.getText(ast))) {
          for (const branch of branchesOf(node.initializer.expression)) flag(`@${node.name.getText(ast)}?`, (branch as ts.StringLiteral).text, branch);
        }
        if (ts.isJsxExpression(node) && node.expression && ts.isConditionalExpression(node.expression) && !ts.isJsxAttribute(node.parent)) {
          for (const branch of branchesOf(node.expression)) flag('choice', (branch as ts.StringLiteral).text, branch);
        }
        if (ts.isJsxText(node)) {
          const text = node.text.replace(/\s+/g, ' ').trim();
          if (text) flag('text', text, node);
        }
        if (ts.isJsxAttribute(node) && TEXT_ATTRIBUTES.has(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) flag(node.name.getText(ast), node.initializer.text, node);
        if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && LABEL_PROPERTIES.has(node.name.text) && node.initializer && ts.isStringLiteral(node.initializer)) flag(`${node.name.text}:`, node.initializer.text, node, node);
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && /^set[A-Z]\w*(Message|Error|Status|Notice|Hint|Label)$/.test(node.expression.text)) {
          for (const argument of node.arguments) { const value = textOf(argument); if (value !== null) flag('state message', value, node); }
        }
        if (ts.isConditionalExpression(node) && /instanceof Error/.test(node.condition.getText(ast))) {
          for (const branch of [node.whenTrue, node.whenFalse]) { const value = textOf(branch); if (value !== null) flag('failure fallback', value, branch); }
        }
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && /^toast\.(success|error|info|warning|loading|message)$/.test(node.expression.getText(ast))) {
          for (const argument of node.arguments) { const value = textOf(argument); if (value !== null) flag('toast', value, node); }
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
    }
  }
  return { asked, hardcoded };
}

describe('the admin in 简体中文', () => {
  const read = readAdmin();
  const asked = [...read.asked.keys(), ...KEYS_ASKED_AT_RUN_TIME];
  // a key is written with its namespace (merchant.x) or without it (admin.x, common.x → the common namespace first)
  const lookup = (dictionary: Map<string, string>, key: string) => dictionary.get(key) ?? dictionary.get(key.replace(/^merchant\./, '')) ?? dictionary.get(key.replace(/^common\./, ''));

  it('has 简体中文 for every key its pages ask for', () => {
    const missing = asked.filter((key) => !lookup(chinese, key));
    expect(missing, 'keys without 简体中文 (the English at the call site shows instead):\n' + missing.map((key) => `  ${key}${read.asked.get(key)?.where.size ? `  ← ${[...read.asked.get(key)!.where].slice(0, 3).join(', ')}` : ''}`).join('\n')).toEqual([]);
  });

  it('has English in the dictionary for the keys it asks for, so the English admin reads from one place too', () => {
    const missing = asked.filter((key) => !lookup(english, key) && !ENGLISH_BUILT_AT_RUN_TIME.has(key));
    expect(missing, 'keys without English in the dictionary:\n' + missing.map((key) => `  ${key}`).join('\n')).toEqual([]);
  });

  it('uses no key as both a label and a section', () => {
    const keys = new Set(asked);
    const conflicts = asked.filter((key) => key.split('.').slice(1).some((_, index) => keys.has(key.split('.').slice(0, index + 1).join('.'))));
    expect(conflicts, 'one of the two can never be found:\n' + conflicts.join('\n')).toEqual([]);
  });

  it('writes no English straight into what a page can reach', () => {
    expect(read.hardcoded, 'English written into a component (say it with getText and add the 简体中文):\n' + read.hardcoded.map((line) => `  ${line.file}:${line.line} ${line.kind} ${line.text}`).join('\n')).toEqual([]);
  });

  it('keeps the English out of the 简体中文 dictionary itself', () => {
    const stillEnglish = [...chinese].filter(([key, value]) => !/[\u4e00-\u9fff]/.test(value) && !NOT_COPY.test(value) && !/^[\w.\-]+@[\w.\-]+$/.test(value));
    expect(stillEnglish.map(([key]) => key), 'lines of 简体中文 with no Chinese in them:\n' + stillEnglish.map(([key, value]) => `  ${key} = ${value}`).join('\n')).toEqual([]);
  });

  it('reads the affiliate workspace as Chinese', () => {
    const data = {
      totals: { partnerCount: 1, organizationCount: 1, applicationPending: 1, commissionCount: 1, commissionTotal: 2, commissionPending: 2 },
      applications: [{ id: 'app-1', organization_name: 'Crew', contact_name: 'Sam', email: 'sam@example.com', status: 'pending', created_at: '2026-11-27T02:00:00.000Z' }],
      partners: [{ id: 'p-1', code: 'CREATOR10', status: 'active', display_name: 'Sam', commission_rate: 10, discount_rate: 10, discount_type: 'percentage', currency: 'USD', commission_total: 2, commission_count: 1 }],
      organizations: [{ id: 'org-1', code: 'ORG-1', name: 'Crew', status: 'active', commission_rate: 5, member_count: 0, owner_email: 'sam@example.com' }],
      commissions: [{ id: 'c-1', partner_code: 'CREATOR10', order_id: 'ord-1', amount: 2, commission_rate: 10, currency: 'USD', status: 'pending' }],
      attributions: [{ id: 'a-1', partner_code: 'CREATOR10', user_id: 'u-1', status: 'clicked', landing_url: 'https://example.com/', associated_at: null }],
    } as unknown as AffiliateNativeOverviewData;
    const html = renderToString(
      <I18nProvider locale="zh-Hans" messages={getMessages('zh-Hans', 'tenant')}>
        <QueryClientProvider client={new QueryClient()}>
          <AffiliateNativeWorkspace data={data} />
        </QueryClientProvider>
      </I18nProvider>,
    );
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    for (const chineseLine of ['机构申请', '推广伙伴', '机构', '佣金', '归因记录', '待处理', '已点击', '标记已付', '撤销', '创建机构', '全部商品']) expect(text).toContain(chineseLine);
    for (const englishLine of ['Applications', 'Partners', 'Organizations', 'Commissions', 'Attributions', 'Mark paid', 'Create organization', 'All products', 'No applications yet']) expect(text).not.toContain(englishLine);
  });
});
