import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HomePage } from '@shop-themes/bokmoo/src/components/HomePage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const componentsDir = path.resolve(__dirname, '../../../../packages/shop-themes/bokmoo/src/components');

const BLUETOOTH_MARK = 'M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11';
const SVG_TAG = /<svg\b([^>]*?)>([\s\S]*?)<\/svg>/g;
const CLASS_ATTR = /className="([^"]*)"/;

/**
 * An outline icon is `fill="none"` plus a stroke. Without a stroke colour it
 * is still in the DOM, at the right place and size, but paints nothing. That
 * is how the hero card's Bluetooth mark shipped invisible: it was ported from
 * the design without the class that gives the stroke its colour.
 */
function hasStrokeColour(attrs: string, body: string): boolean {
  if (/\bstroke="[^"]+"/.test(attrs) || /\bstroke="[^"]+"/.test(body)) return true;
  const classes = CLASS_ATTR.exec(attrs)?.[1] ?? '';
  return /\bstroke-current\b/.test(classes);
}

function outlineIconsWithoutStroke(source: string): string[] {
  const offenders: string[] = [];
  for (const match of source.matchAll(SVG_TAG)) {
    const attrs = match[1] ?? '';
    const body = match[2] ?? '';
    // A fill class outranks the fill="none" attribute, so the icon is painted.
    const filledByClass = /\bfill-(?!none\b)[a-z]/.test(CLASS_ATTR.exec(attrs)?.[1] ?? '');
    if (/\bfill="none"/.test(attrs) && !filledByClass && !hasStrokeColour(attrs, body)) {
      const line = source.slice(0, match.index).split('\n').length;
      offenders.push(`line ${line}: ${attrs.trim().slice(0, 90)}`);
    }
  }
  return offenders;
}

describe('bokmoo hero card Bluetooth mark', () => {
  it('paints the mark in the top-right corner of the hero card', () => {
    const { container } = render(<HomePage locale="en" />);
    const heroCard = container.querySelector('.sim-metallic-body');
    const mark = heroCard?.querySelector<SVGSVGElement>(`path[d="${BLUETOOTH_MARK}"]`)?.ownerSVGElement;

    expect(mark, 'the hero card carries the Bluetooth mark').toBeTruthy();
    expect(hasStrokeColour(`className="${mark?.getAttribute('class') ?? ''}"`, mark?.innerHTML ?? '')).toBe(true);
  });

  it('gives every outline icon in the theme a stroke colour', () => {
    const offenders = readdirSync(componentsDir)
      .filter((file) => file.endsWith('.tsx'))
      .flatMap((file) =>
        outlineIconsWithoutStroke(readFileSync(path.join(componentsDir, file), 'utf8')).map(
          (icon) => `${file}:${icon}`,
        ),
      );

    expect(offenders, 'outline SVGs without a stroke colour render invisible').toEqual([]);
  });
});
