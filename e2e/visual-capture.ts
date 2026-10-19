import { writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { PRODUCT_CODE_GENERATION } from '../packages/shared/src/product-codes';

const storeTime = new RegExp([
  /\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?/,
  /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), /,
  /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?) \d{1,2},? \d{4}/,
  /\d{1,2}\/\d{1,2}\/\d{4}/,
  /\d{4}\u5e74\d{1,2}\u6708\d{1,2}\u65e5/,
  /(?:Last checked|Last heartbeat):/,
].map(pattern => pattern.source).join('|'));

const maskRules = [
  { name: 'store time', pattern: storeTime },
  { name: 'UUID or test email', pattern: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b|\b[\w.+-]*[0-9a-fA-F]{12,}[\w.+-]*@e2e\.example\b/ },
  { name: 'internal ID', pattern: /\bc[a-z0-9]{24}\b/ },
  { name: 'order number', pattern: /\b[A-Z]{2,6}-\d{8}-\d{4,}\b/ },
  { name: 'uptime', pattern: /\d+ days \d+ hours \d+ minutes\b|\d+ \u5929 \d+ \u5c0f[\u65f6\u6642] \d+ \u5206[\u949f\u9418]/ },
  { name: 'product code', pattern: new RegExp('^[' + PRODUCT_CODE_GENERATION.alphabet + ']{' + PRODUCT_CODE_GENERATION.length + '}(?:-\\d{2,})?$') },
] as const;

export async function captureVisual(page: Page, options: NonNullable<Parameters<Page['screenshot']>[0]>) {
  if (options.path && basename(options.path).startsWith('board-')) return page.screenshot(options);
  const selections: Array<{ name: string; locator: Locator }> = [];
  for (const rule of maskRules) {
    const elements = await page.getByText(rule.pattern).filter({ visible: true }).all();
    elements.forEach((locator, index) => selections.push({
      name: 'mask: ' + rule.name + ' ' + (index + 1), locator,
    }));
  }
  let formIndex = 0;
  for (const locator of await page.getByRole('textbox', { name: /.+/ }).filter({ visible: true }).all()) {
    const value = await locator.inputValue();
    if (maskRules.some(rule => rule.pattern.test(value))) {
      selections.push({ name: 'mask: form value ' + (++formIndex), locator });
    }
  }
  const image = await page.screenshot({
    ...options, mask: selections.map(item => item.locator), maskColor: '#000000',
  });
  if (options.path?.endsWith('.png')) {
    const boxes = [];
    for (const { name, locator } of selections) {
      boxes.push({ name, ...await paintedBounds(locator, Boolean(options.fullPage)) });
    }
    await writeFile(options.path.replace(/\.png$/, '.boxes.json'), JSON.stringify(boxes, null, 2), 'utf8');
  }
  return image;
}

export async function paintedBounds(locator: Locator, fullPage = false) {
  return locator.evaluate((element, fullPage) => {
    const origin = fullPage ? element.ownerDocument.documentElement.getBoundingClientRect() : { x: 0, y: 0 };
    type Box = { x: number; y: number; width: number; height: number };
    type Extents = { left: number; top: number; right: number; bottom: number };
    const union = (boxes: Box[]): Box => {
      const left = Math.min(...boxes.map((box) => box.x));
      const top = Math.min(...boxes.map((box) => box.y));
      const right = Math.max(...boxes.map((box) => box.x + box.width));
      const bottom = Math.max(...boxes.map((box) => box.y + box.height));
      return { x: left, y: top, width: right - left, height: bottom - top };
    };
    const split = (value: string, delimiter: ',' | ' ') => {
      let depth = 0;
      let start = 0;
      const parts: string[] = [];
      for (let index = 0; index < value.length; index++) {
        if (value[index] === '(') depth++;
        else if (value[index] === ')') depth--;
        else if (!depth && (delimiter === ',' ? value[index] === ',' : /\s/.test(value[index]))) {
          if (value.slice(start, index).trim()) parts.push(value.slice(start, index).trim());
          start = index + 1;
        }
      }
      if (value.slice(start).trim()) parts.push(value.slice(start).trim());
      return parts;
    };
    const shadows = (value: string, text: boolean): Extents[] => {
      if (value === 'none') return [];
      return split(value, ',').flatMap((shadow) => {
        const tokens = split(shadow, ' ');
        if (tokens.includes('inset')) return [];
        const lengths = tokens.filter((token) => /^-?(?:\d+\.?\d*|\.\d+)px$/.test(token)).map(Number.parseFloat);
        if (lengths.length < 2) throw new Error(`Unsupported computed shadow: ${shadow}`);
        const [x, y, blur = 0, spread = 0] = lengths;
        const radius = blur + (text ? 0 : spread);
        return [{
          left: Math.max(0, radius - x), right: Math.max(0, radius + x),
          top: Math.max(0, radius - y), bottom: Math.max(0, radius + y),
        }];
      });
    };
    const nodes = [element, ...element.querySelectorAll('*')].map((node, index) => {
      const rect = node.getBoundingClientRect();
      const css = getComputedStyle(node);
      const ownBox = { x: rect.x - origin.x, y: rect.y - origin.y, width: rect.width, height: rect.height };
      const boxShadows = shadows(css.boxShadow, false);
      const textShadows = shadows(css.textShadow, true);
      const outline = css.outlineStyle === 'none' ? 0
        : Math.max(0, Number.parseFloat(css.outlineWidth) + Number.parseFloat(css.outlineOffset));
      const overflow = {
        left: Math.max(outline, ...boxShadows.map((item) => item.left), ...textShadows.map((item) => item.left)),
        top: Math.max(outline, ...boxShadows.map((item) => item.top), ...textShadows.map((item) => item.top)),
        right: Math.max(outline, ...boxShadows.map((item) => item.right), ...textShadows.map((item) => item.right)),
        bottom: Math.max(outline, ...boxShadows.map((item) => item.bottom), ...textShadows.map((item) => item.bottom)),
      };
      return {
        index, ownBox, boxShadows, textShadows, outline, overflow,
        paintedBox: {
          x: ownBox.x - overflow.left, y: ownBox.y - overflow.top,
          width: ownBox.width + overflow.left + overflow.right,
          height: ownBox.height + overflow.top + overflow.bottom,
        },
      };
    }).filter((node) => node.ownBox.width > 0 && node.ownBox.height > 0);
    if (!nodes.length) throw new Error('Exclusion element has no painted box');
    const painted = union(nodes.map((node) => node.paintedBox));
    const x = Math.floor(painted.x);
    const y = Math.floor(painted.y);
    return {
      box: { x, y, width: Math.ceil(painted.x + painted.width) - x, height: Math.ceil(painted.y + painted.height) - y },
      breakdown: {
        ownBox: nodes[0].ownBox,
        descendantUnion: nodes.length > 1 ? union(nodes.slice(1).map((node) => node.ownBox)) : null,
        nodes,
      },
    };
  }, fullPage);
}
