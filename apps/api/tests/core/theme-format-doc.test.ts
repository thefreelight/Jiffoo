import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SECTION_TYPES, themeSectionSchemas } from '@jiffoo/shared';

describe('theme format documentation', () => {
  it('documents every section type and setting in the shared schema table', () => {
    const doc = readFileSync(new URL('../../../../docs/agentra-003-theme-format.md', import.meta.url), 'utf8');
    const table = doc.split('| Section type | Settings (required unless marked ?) | Bounds |')[1]
      ?.split('\n\n')[0] ?? '';
    const rows = table.split('\n').filter((line) => /^\| `[^`]+` \|/.test(line));
    const documented = new Map(rows.map((row) => {
      const [, name, settings] = row.split('|');
      return [name.match(/`([^`]+)`/)?.[1], [...settings.matchAll(/`([^`]+)`/g)]
        .map((match) => match[1])];
    }));
    expect([...documented.keys()].sort()).toEqual([...SECTION_TYPES].sort());
    for (const type of SECTION_TYPES) {
      const properties = themeSectionSchemas[type].properties.settings.properties;
      const names = Object.keys(properties);
      const cells = documented.get(type) ?? [];
      for (const name of names) expect(cells, `${type}.${name}`).toContain(name);
      expect(cells.filter((name) => names.includes(name)).sort(), type).toEqual(names.sort());
      if (type === 'image-carousel') {
        const slideProperties = properties.slides.anyOf[0].items.properties;
        for (const name of Object.keys(slideProperties)) expect(cells, `slide.${name}`).toContain(name);
      }
    }
  });
});
