import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import Color from 'color';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import tailwindcss from 'tailwindcss';

const require = createRequire(import.meta.url);
const css = readFileSync('apps/admin/app/default-tokens.css', 'utf8');
const tokens = Object.fromEntries([...css.matchAll(/--admin-([\w-]+):\s*(#[\da-f]{3,8});/gi)]
  .map(([, key, value]) => [key, value]));
const oldPresetSource = execFileSync('git', ['show', '5d58e881:apps/admin/tailwind.preset.js'], { encoding: 'utf8' });
const oldConfigSource = execFileSync('git', ['show', '5d58e881:apps/admin/tailwind.config.js'], { encoding: 'utf8' });
const presetModule = { exports: {} };
vm.runInNewContext(oldPresetSource, { module: presetModule });
const configModule = { exports: {} };
vm.runInNewContext(
  oldConfigSource,
  {
    module: configModule,
    require: (name) => name === './tailwind.preset' ? presetModule.exports : require(name),
  },
);
const currentConfig = require('../apps/admin/tailwind.config.js');
const currentPreset = require('../apps/admin/tailwind.preset.js');
const prefixes = ['placeholder', 'decoration', 'divide', 'border', 'stroke', 'shadow', 'from', 'via', 'fill', 'ring', 'text', 'bg', 'to'];
const classPattern = /(?<![\w-])(?:[\w[\]!:&_.-]+:)*(?:placeholder|decoration|divide|border|stroke|shadow|from|via|fill|ring|text|bg|to)-(?:\[[^\]]+\]|[\w.-]+)(?:\/(?:\d+|\[[^\]]+\]))?/g;
const literalPattern = /(?<![\w-])#[\da-f]{3,8}\b|rgb\(from var\(--admin-[\w-]+\) r g b \/ [\d.]+\)|hsl\(var\(--[\w-]+\)\)|(?:rgba?|hsla?)\([^)]*\)|var\(--admin-[\w-]+\)/gi;
const ignored = new Set(['transparent', 'current', 'inherit']);
const diff = execFileSync('git', [
  '-c', 'core.safecrlf=false', 'diff', '--unified=0', '5d58e881', '--', 'apps/admin',
], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
let file = '';
let oldLine = 0;
let oldBlock = [];
let newBlock = [];
const rows = [];
const unresolved = [];
const removedDark = [];
const manual = [];
const auditClasses = [];

function auditClass(key) {
  const name = key.slice('colors.'.length).replace(/\.DEFAULT$/, '').replaceAll('.', '-');
  const prefix = name === 'border' || name === 'input' ? 'border'
    : name === 'ring' ? 'ring' : name.endsWith('-foreground') || name === 'foreground' ? 'text' : 'bg';
  return `${prefix}-${name}`;
}

function collectAuditClasses(value, key = 'colors') {
  if (typeof value === 'string') {
    auditClasses.push(auditClass(key));
    return;
  }
  for (const [name, child] of Object.entries(value)) collectAuditClasses(child, `${key}.${name}`);
}
collectAuditClasses(configModule.exports.theme.extend.colors);

const classNames = new Set(auditClasses);
for (const line of diff.split(/\r?\n/)) {
  if (!line.startsWith('-') && !line.startsWith('+')) continue;
  for (const [name] of line.matchAll(classPattern)) classNames.add(name);
}
for (const name of ['text-primary-foreground', 'text-destructive-foreground']) classNames.add(name);

async function compiledColors(config) {
  const source = `<div class="${[...classNames].join(' ')}"></div>`;
  const result = await postcss([tailwindcss({
    ...config, content: [{ raw: source, extension: 'html' }],
  })]).process('@tailwind utilities;', { from: undefined });
  const declarations = new Map();
  result.root.walkRules((rule) => {
    const names = new Set();
    selectorParser((selectors) => selectors.walkClasses((node) => names.add(node.value)))
      .processSync(rule.selector);
    for (const name of names) {
      const values = declarations.get(name) ?? {};
      rule.walkDecls((declaration) => { values[declaration.prop] = declaration.value; });
      declarations.set(name, values);
    }
  });
  return declarations;
}
const oldCompiled = await compiledColors(configModule.exports);
const newCompiled = await compiledColors(currentConfig);

function flattenColors(value, prefix = '', entries = new Map()) {
  if (typeof value === 'string' || typeof value === 'function') {
    entries.set(prefix, value);
  } else if (value && typeof value === 'object') {
    for (const [name, child] of Object.entries(value)) {
      flattenColors(child, name === 'DEFAULT' ? prefix : prefix ? `${prefix}-${name}` : name, entries);
    }
  }
  return entries;
}
const oldPresetKeys = flattenColors(presetModule.exports.theme.extend.colors);
const oldConfigKeys = flattenColors(configModule.exports.theme.extend.colors);
console.log('HEAD preset/config overlapping color classes:');
for (const [name, presetValue] of oldPresetKeys) {
  if (!oldConfigKeys.has(name)) continue;
  console.log(`OVERLAP ${name} | preset ${presetValue} | config ${oldConfigKeys.get(name)} | compiled ${JSON.stringify(oldCompiled.get(`text-${name}`) ?? oldCompiled.get(`bg-${name}`))}`);
}
console.log(`HEAD overlapping classes: ${[...oldPresetKeys.keys()].filter((key) => oldConfigKeys.has(key)).length}`);

function rgba(value, opacity = 1) {
  try {
    const color = Color(value);
    return [...color.rgb().array().slice(0, 3).map((channel) => Math.round(channel)), +(color.alpha() * opacity).toFixed(4)];
  } catch {
    return null;
  }
}

function classColor(value, isOld) {
  const bare = value.replace(/^(?:[\w[\]!:&_.-]+:)+/, '');
  const prefix = prefixes.find((name) => bare.startsWith(`${name}-`));
  if (!prefix) return null;
  const part = bare.slice(prefix.length + 1).replace(/^(?:t|b|l|r|x|y)-(?=[a-z])/, '');
  const slash = part.lastIndexOf('/');
  const name = slash === -1 ? part : part.slice(0, slash);
  if (ignored.has(name)) return { value, rgba: null, reason: 'non-RGBA keyword' };
  const declarations = (isOld ? oldCompiled : newCompiled).get(value);
  const direction = bare.slice(prefix.length + 1).match(/^(?:t|b|l|r|x|y)-/)?.[0] ?? '';
  const property = {
    bg: 'background-color', text: 'color', border: 'border-color', ring: '--tw-ring-color',
    shadow: '--tw-shadow-color', from: '--tw-gradient-from', via: '--tw-gradient-stops',
    to: '--tw-gradient-to', fill: 'fill', stroke: 'stroke', divide: 'border-color',
    placeholder: 'color', decoration: 'text-decoration-color',
  }[prefix];
  const resolvedProperty = prefix === 'border' && direction
    ? `border-${{ t: 'top', b: 'bottom', l: 'left', r: 'right', x: 'left', y: 'top' }[direction[0]]}-color`
    : property;
  let color = declarations?.[resolvedProperty];
  if (prefix === 'via') color = color?.split(',')[1]?.trim();
  if (color) {
    color = color.replace(/var\(--tw-[\w-]+-opacity,\s*1\)/g, '1')
      .replace(/\s+var\(--tw-gradient-[\w-]+-position\)/g, '')
      .replace(/var\(--admin-([\w-]+)-rgb\)/g, (_, role) =>
        tokens[role]?.match(/[\da-f]{2}/gi).map((channel) => Number.parseInt(channel, 16)).join(' ') ?? 'invalid')
      .replace(/var\(--admin-([\w-]+)\)/g, (_, role) => tokens[role] ?? 'invalid');
  }
  const valueRgba = color ? rgba(color) : null;
  const variant = value.slice(0, value.length - bare.length);
  return { value, key: `${variant}${prefix}-${direction}`, rgba: valueRgba,
    reason: valueRgba ? null : `unresolved compiled ${isOld ? 'HEAD' : 'current'} class (${resolvedProperty}: ${declarations?.[resolvedProperty] ?? 'missing'})` };
}

function atoms(line, isOld) {
  const classes = [...line.matchAll(classPattern)];
  const matches = classes.map(([value]) => classColor(value, isOld)).filter(Boolean);
  for (const match of line.matchAll(literalPattern)) {
    const value = match[0];
    if (classes.some((item) => match.index >= item.index && match.index < item.index + item[0].length)) continue;
    const relative = value.match(/^rgb\(from var\(--admin-([\w-]+)\) r g b \/ ([\d.]+)\)$/);
    const invalidHsl = isOld && /^hsl\(var\(--(?:border|muted-foreground)\)\)$/.test(value);
    const color = relative ? tokens[relative[1]] : value.startsWith('var(') ? tokens[value.slice(12, -1)] : value;
    const valueRgba = invalidHsl ? [0, 0, 0, 0] : color ? rgba(color, relative ? Number(relative[2]) : 1) : null;
    matches.push({ value, key: 'literal', rgba: valueRgba, reason: valueRgba ? null : 'unresolved literal or token variable' });
  }
  if (isOld && /(?:background|color):\s*white\s*;/.test(line)) {
    matches.push({ value: 'white', key: 'literal', rgba: rgba('#fff') });
  }
  return matches;
}

function record(oldAtom, newAtom, location) {
  if (!oldAtom || !newAtom || !oldAtom.rgba || !newAtom.rgba) {
    unresolved.push(`${location} | ${oldAtom?.value ?? '(missing)'} | ${newAtom?.value ?? '(missing)'} | ${oldAtom?.reason ?? newAtom?.reason ?? 'unpaired changed color'}`);
    return;
  }
  const equal = JSON.stringify(oldAtom.rgba) === JSON.stringify(newAtom.rgba);
  rows.push({ location, old: oldAtom.value, oldRgba: oldAtom.rgba, next: newAtom.value, newRgba: newAtom.rgba, equal });
}

function flush() {
  if (!oldBlock.length && !newBlock.length) return;
  if (file === 'apps/admin/tailwind.config.js' || file === 'apps/admin/tailwind.preset.js') {
    oldBlock = [];
    newBlock = [];
    return;
  }
  for (let lineIndex = 0; lineIndex < Math.max(oldBlock.length, newBlock.length); lineIndex++) {
    const old = oldBlock[lineIndex];
    const next = newBlock[lineIndex];
    const oldAtoms = old ? atoms(old.text, true) : [];
    const newAtoms = next ? atoms(next.text, false) : [];
    for (let i = oldAtoms.length - 1; i >= 0; i--) {
      if (oldAtoms[i].value.includes('dark:')) {
        removedDark.push(`${file}:${old.line} | ${oldAtoms[i].value} | intentionally removed dark appearance`);
        oldAtoms.splice(i, 1);
      }
    }
    for (let i = oldAtoms.length - 1; i >= 0; i--) {
      const match = newAtoms.findIndex((atom) => atom.value === oldAtoms[i].value);
      if (match !== -1) {
        oldAtoms.splice(i, 1);
        newAtoms.splice(match, 1);
      }
    }
    for (const oldAtom of oldAtoms) {
      const match = newAtoms.findIndex((atom) => atom.key === oldAtom.key);
      const newAtom = match === -1 ? null : newAtoms.splice(match, 1)[0];
      record(oldAtom, newAtom, `${file}:${old?.line ?? oldBlock[0]?.line ?? 0}`);
    }
    for (const newAtom of newAtoms) {
      record(null, newAtom, `${file}:${old?.line ?? oldBlock[0]?.line ?? 0}`);
    }
  }
  oldBlock = [];
  newBlock = [];
}

for (const line of diff.split(/\r?\n/)) {
  if (line.startsWith('diff --git ')) {
    flush();
    file = line.slice(line.indexOf(' b/') + 3);
  } else if (line.startsWith('@@ ')) {
    flush();
    oldLine = Number(line.match(/@@ -(\d+)/)?.[1]);
  } else if (line.startsWith('--- ') || line.startsWith('+++ ')) {
    continue;
  } else if (line.startsWith('-')) {
    oldBlock.push({ line: oldLine++, text: line.slice(1) });
  } else if (line.startsWith('+')) {
    newBlock.push({ text: line.slice(1) });
  } else if (line.startsWith(' ')) {
    flush();
    oldLine++;
  }
}
flush();

function sourceLine(source, literal) {
  return source.slice(0, source.indexOf(literal)).split(/\r?\n/).length;
}

function auditConfig(oldValue, currentValue, key) {
  if (typeof oldValue === 'string') {
    const name = auditClass(key);
    record(classColor(name, true), classColor(name, false),
      `apps/admin/tailwind.config.js:${sourceLine(oldConfigSource, oldValue)} (${key})`);
    return;
  }
  for (const [name, value] of Object.entries(oldValue)) {
    auditConfig(value, currentValue?.[name], `${key}.${name}`);
  }
}
auditConfig(configModule.exports.theme.extend.colors, currentConfig.theme.extend.colors, 'colors');
for (const name of ['text-primary-foreground', 'text-destructive-foreground']) {
  record(classColor(name, true), classColor(name, false),
    `apps/admin/tailwind.config.js:${sourceLine(oldConfigSource, name === 'text-primary-foreground' ? 'hsl(210 40% 98%)' : 'hsl(210 40% 98%)')} (${name} compiled)`);
}

const absentShades = {
  '#1E3A8A': 'brand-900', '#172554': 'brand-950',
  '#334155': 'neutral-700', '#1E293B': 'neutral-800', '#FDE68A': 'warning-100',
};
const oldPresetLines = oldPresetSource.split(/\r?\n/);
for (const [index, line] of oldPresetLines.entries()) {
  for (const [literal] of line.matchAll(/#[\da-f]{6}\b/gi)) {
    const oldRgba = rgba(literal);
    const role = Object.keys(tokens).find((name) => JSON.stringify(rgba(tokens[name])) === JSON.stringify(oldRgba));
    const location = `apps/admin/tailwind.preset.js:${index + 1}`;
    if (role) {
      record({ value: literal, rgba: oldRgba },
        { value: `var(--admin-${role})`, rgba: rgba(tokens[role]) }, location);
    } else {
      const shade = absentShades[literal.toUpperCase()];
      if (!shade) {
        unresolved.push(`${location} | ${literal} | no matching token or classified unused shade`);
        continue;
      }
      const usage = spawnSync('git', [
        'grep', '-n', '-E', `(^|[^\\w-])${shade}([^\\w-]|$)`,
        '5d58e881', '--', 'apps/admin/app', 'apps/admin/components', 'apps/admin/lib',
      ], { encoding: 'utf8' });
      if (usage.status !== 0 && usage.status !== 1) throw usage.error ?? new Error(usage.stderr);
      if (usage.status === 0) unresolved.push(`${location} | ${literal} | ${shade} was used: ${usage.stdout.trim()}`);
      else manual.push(`${location} | ${literal} | ${oldRgba.join(',')} | no replacement (unused ${shade}; git grep 5d58e881 -- apps/admin/app apps/admin/components apps/admin/lib)`);
    }
  }
}
for (const [name, oldShadow] of Object.entries(presetModule.exports.theme.extend.boxShadow)) {
  const currentShadow = currentPreset.theme.extend.boxShadow[name];
  const oldValues = [...oldShadow.matchAll(/rgba?\([^)]+\)/g)].map(([value]) => value);
  const currentValues = [...currentShadow.matchAll(/rgb\(from var\(--admin-([\w-]+)\) r g b \/ ([\d.]+)\)/g)];
  if (oldValues.length !== currentValues.length) {
    unresolved.push(`apps/admin/tailwind.preset.js:${sourceLine(oldPresetSource, `'${name}'`)} | ${name} shadow stop count changed`);
  }
  for (let index = 0; index < oldValues.length; index++) {
    const [, role, alpha] = currentValues[index] ?? [];
    record({ value: oldValues[index], rgba: rgba(oldValues[index]) },
      { value: currentValues[index]?.[0], rgba: role ? rgba(tokens[role], Number(alpha)) : null },
      `apps/admin/tailwind.preset.js:${sourceLine(oldPresetSource, `'${name}'`)} (${name})`);
  }
}
for (const row of rows) {
  console.log(`${row.location} | ${row.old} | ${row.oldRgba.join(',')} | ${row.next} | ${row.newRgba.join(',')} | ${row.equal}`);
}
console.log(`Resolved rows: ${rows.length}; unequal: ${rows.filter((row) => !row.equal).length}; unresolved: ${unresolved.length}`);
for (const row of unresolved) console.log(`UNRESOLVED ${row}`);
console.log(`Manually verified removed unused shades: ${manual.length}`);
for (const row of manual) console.log(`MANUAL ${row}`);
console.log(`Intentionally removed dark variants: ${removedDark.length}`);
for (const row of removedDark) console.log(`REMOVED_DARK ${row}`);
if (rows.some((row) => !row.equal) || unresolved.length) process.exitCode = 1;
