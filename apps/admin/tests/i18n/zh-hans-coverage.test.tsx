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
 *  - a line of 简体中文 said the Taiwan way, or written with a Traditional character;
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

/**
 * 简体中文 is written the mainland way (2026-11-28). Before this, 379 dictionary lines said things the Taiwan way —
 * 载入, 设定, 帐号, 连线 — because the dictionaries had been translated from Traditional Chinese. Words a mainland
 * reader reads as another region's wording; a word that is ordinary Chinese as well (建立, 取得, 透过) is not listed.
 * A line that must keep one of these is a decision: name it in TAIWAN_WORD_THAT_STAYS.
 */
const TAIWAN_STYLE_WORDS = [
  // people and accounts
  '使用者', '登入', '登出', '帐号', '帐户', '帐单', '转帐', '对帐', '大头贴', '身分',
  // access, connection, servers, network
  '存取', '连线', '网路', '网际网路', '伺服器', '资料库', '网域', '子网域', '连接埠', '权杖', '金钥', '杂凑', '签核', '生物辨识',
  // settings, loading, saving, finding
  '设定', '预设', '载入', '储存变更', '储存中', '已储存', '储存成功', '储存失败', '未储存', '储存设定', '储存格', '搜寻', '重新整理', '栏位', '汇出', '汇入', '列印', '套用', '重设', '封存', '排程', '行事历', '工作阶段',
  // the screen
  '介面', '选单', '视窗', '萤幕', '对话方块', '核取方块', '单选钮', '进度列', '下拉式选单', '控制项', '版面配置', '索引标签', '收合', '网址列', '外挂', '范本', '版型', '模组', '解除安装',
  // data and code
  '资讯', '讯息', '档案', '快取', '佇列', '程式', '软体', '硬碟', '硬体', '韧体', '宽频', '位元组', '解析度', '标头', '查询字串', '检查码', '副档名', '试算表',
  // buying and selling
  '结帐', '宅配', '超商', '折价券', '红利点数', '提领', '分润', '行销', '客制', '自订', '保固',
  // mail and messages
  '推播', '回覆', '电子信箱', '验证信箱', '封锁',
  // devices and media
  '影片', '视讯', '行动装置', '行动支付', '行动电话', '行动网路', '行动版', '智慧型', '桌上型', '笔记型电脑', '邮递区号', '县市', '讯号', '时间戳记', '西元',
  // actions
  '点选', '复制贴上', '剪下', '拖曳', '支援', '检视',
  // reports, time and quality
  '仪表板', '最佳化', '机率', '字型', '字级', '渐层', '币别', '点阅率', '不重复访客', '疑难排解', '逾时', '国定假日', '特休', '育婴假',
  // the corner quotation marks: the mainland standard is “”
  '「', '」',
];
/** Lines that keep a listed word because it is the mainland word there too. */
const TAIWAN_WORD_THAT_STAYS = new Set(['个人资料', '员工权限档案', '快速预设']);

/**
 * Characters that exist in Traditional only (the 382 the repo's own 繁體中文 text uses; every one of them becomes
 * another character in 简体中文). A character that is both — 著, 乾, 覆 — is not among them.
 */
const TRADITIONAL_ONLY = '遊戲統計個雜湊隨機瀏覽標識帳號線獨時長數與當資還區間內無關聯沒篩選顯紀錄開後這裡會現條暫請確認掛裝並啟載動鐘領兌換碼戶訂閱單結發貨總變體過狀態給敗錯誤譜國際義問監鍵轉構於頁蓋尋蟲點語設優銷規則評價儲圖絡對話郵驗證務蹤約遞運實讀綁庫匯網訪從來麼別虛擬錢餘額員夥薦歸駐費註冊連飛書預佇鑰詞歡隱稱測試範純產憑貼準權欄簽頭應複製環鹽繼輪詢攬傳視彙東劃許報記廣細藍續達經錶寶陽紋盤帶針蠟燭鈷燒極簡啞筆攤絲籤緻電為場録創搶見詳適參擁輸礎該減兩張種類項終併濫詐買賣購質們獲靈輕鬆較擇團隊協題幫護營訊檔據獎復屬組織聲觀車紹編輯刪閉處檢論財離頻嗎捨棄剛韓說備側進將術掃幾擊鈕決稅級穩顆熱議緒維賴儀願調彈暢嘗門樣圍亞歐亂佈難讓幣違滿盡邊軟專業順貴鎖頂証採攜僅責損擔傭審須寫況階縫賬雙診斷諾臨辦響繫歷華週陸灣馬賓驟説淪牆補乾淨檻釋樂畫棧導夾學繪斂氣縮強駕馭習覺驚豔節敘趨勢嚮聰風絕紅嚴肅';

/** Every line of 简体中文 the admin can show: the shared dictionaries it and the storefront read, and its own Chinese overlay. */
const SHARED_I18N = path.resolve(ADMIN, '../../packages/shared/src/i18n');
const SIMPLIFIED_SOURCES: Array<{ root: string; file: string; tables?: Set<string> }> = [
  ...['merchant', 'common', 'shop', 'whiteLabel'].map((name) => ({ root: SHARED_I18N, file: `messages/zh-Hans/${name}.ts` })),
  ...['admin', 'common', 'shop'].map((name) => ({ root: SHARED_I18N, file: `locales/zh-Hans/${name}.json` })),
  { root: ADMIN, file: 'lib/extension-catalog-zh.ts', tables: new Set(['ZH_HANS', 'CONFIG_FIELDS_ZH_HANS', 'CONFIG_OPTIONS_ZH_HANS']) },
];

/** Every string a source holds as a value, with its key path: a dictionary line, or — with `tables` — a line of the named tables. */
function valuesOf(source: { root: string; file: string; tables?: Set<string> }): Array<{ key: string; text: string }> {
  const full = path.join(source.root, source.file);
  const text = fs.readFileSync(full, 'utf8');
  if (full.endsWith('.json')) return [...flatten(JSON.parse(text))].map(([key, value]) => ({ key, text: value }));
  const ast = ts.createSourceFile(full, text, ts.ScriptTarget.Latest, true);
  const values: Array<{ key: string; text: string }> = [];
  const inNamedTable = (node: ts.Node) => {
    for (let cur: ts.Node | undefined = node.parent; cur; cur = cur.parent) {
      if (ts.isVariableDeclaration(cur) && ts.isIdentifier(cur.name)) return !source.tables || source.tables.has(cur.name.text);
    }
    return !source.tables;
  };
  const visit = (node: ts.Node) => {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !(ts.isPropertyAssignment(node.parent) && node.parent.name === node) && inNamedTable(node)) {
      const parts: string[] = [];
      for (let child: ts.Node = node, cur: ts.Node | undefined = node.parent; cur; child = cur, cur = cur.parent) {
        if (ts.isPropertyAssignment(cur)) parts.unshift(cur.name.getText(ast).replace(/^['"]|['"]$/g, ''));
        else if (ts.isArrayLiteralExpression(cur)) parts.unshift(String(cur.elements.indexOf(child as ts.Expression)));
        if (ts.isSourceFile(cur)) break;
      }
      values.push({ key: parts.join('.'), text: node.text });
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return values;
}
const simplifiedLines = SIMPLIFIED_SOURCES.flatMap((source) => valuesOf(source).map((line) => ({ file: source.file, ...line })));

interface Read {
  asked: Map<string, { english: string[]; where: Set<string> }>;
  hardcoded: Array<{ file: string; line: number; kind: string; text: string }>;
}

// "AI assistant", "eSIM plans" — a short token and a word — are English too; a code in capitals (USD, SKU, ID) is not
const hasWords = (text: string) => /[A-Za-z]{3,}/.test(text)
  && (/[A-Za-z]{3,}\s+[A-Za-z]{2,}/.test(text) || /[A-Z][a-z]{2,}/.test(text) || /(^|\s)[A-Za-z]{1,2}\s+[A-Za-z]{3,}/.test(text) || /(^|\s)[A-Za-z]{3,}\s+[A-Za-z]{1,2}($|\s)/.test(text))
  && !/^\/|:\/\//.test(text);
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

  const mainland = (read: (line: { key: string; text: string }) => string | undefined) => simplifiedLines
    .map((line) => ({ line, found: read(line) }))
    .filter((entry) => entry.found !== undefined);

  it('writes every line of 简体中文 the mainland way', () => {
    const worded = mainland((line) => TAIWAN_STYLE_WORDS.find((word) => line.text.includes(word) && !TAIWAN_WORD_THAT_STAYS.has(line.text)));
    expect(worded.map((entry) => `  ${entry.line.file} ${entry.line.key} = ${entry.line.text}  ← ${entry.found}`), 'Taiwan-style wording in 简体中文:\n').toEqual([]);
  });

  it('keeps Traditional characters out of 简体中文', () => {
    const traditional = mainland((line) => [...line.text].find((character) => TRADITIONAL_ONLY.includes(character)));
    expect(traditional.map((entry) => `  ${entry.line.file} ${entry.line.key} = ${entry.line.text}  ← ${entry.found}`), 'Traditional characters in 简体中文:\n').toEqual([]);
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
