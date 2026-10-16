import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const sourceDirectory = resolve(__dirname, '../docs/design/shop');
const fontStack = 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif';

// Interpret only the boards' static preview values; never execute their draft scripts.
async function board(name: string, state: string, mode: string, width: number, active = '', embedded = false): Promise<{ css: string; body: string }> {
  const source = await readFile(resolve(sourceDirectory, `${name}.dc.html`), 'utf8');
  const css = source.match(/<style>([\s\S]*?)<\/style>/)![1]
    .replaceAll("'Geist','Noto Sans SC',system-ui,sans-serif", fontStack)
    .replaceAll("'Geist Mono',monospace", 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace');
  const palettes = source.match(/const t = mode === 'dark' \? (\{[^\n]+?\}) : (\{[^\n]+?\});/)!;
  const palette: Record<string, string> = JSON.parse(palettes[mode === 'dark' ? 1 : 2]);
  const cats: Array<{ slug: string; name: string }> = JSON.parse(source.match(/cats: (\[[^\n]+?\]), active:/)![1]);
  let body = source.slice(source.indexOf('</helmet>') + 9, source.indexOf('</x-dc>'));
  body = body.replace(/<sc-if value="\{\{visible\.([^}]+)\}\}"[^>]*>([\s\S]*?)<\/sc-if>/g, (_match, key, content) => key === state ? content : '');
  body = body.replace(/<sc-for [^>]*>([\s\S]*?)<\/sc-for>/g, (_match, content) => cats.map((cat) => content.replaceAll('{{c.name}}', cat.name).replaceAll('{{c.className}}', cat.slug === active ? 'on' : '')).join(''));
  body = body.replace(/<sc-if [^>]*>([\s\S]*?)<\/sc-if>/g, '$1');
  const imports = [...body.matchAll(/<dc-import name="([^"]+)"([^>]*)><\/dc-import>/g)];
  for (const match of imports) {
    const child = await board(match[1], 'default', mode, width, match[2].match(/active="([^"]*)"/)?.[1], /embedded="\{\{\s*true\s*\}\}"/.test(match[2]));
    body = body.replace(match[0], child.body);
  }
  const values: Record<string, string> = {
    maxWidth: `${width}px`, count: '2', allClass: active === 'all' ? 'on' : '',
    menuPosition: embedded ? 'static' : 'relative', menuDisplay: embedded ? 'contents' : 'block', menuHeight: embedded ? '0' : '900px',
  };
  body = body.replace(/\{\{t\.([^}]+)\}\}/g, (_match, key) => palette[key] ?? '');
  body = body.replace(/\{\{([^}]+)\}\}/g, (_match, key) => values[key] ?? '');
  body = body.replace(/src="(img\/[^"]+)"/g, (_match, file) => `src="${pathToFileURL(resolve(sourceDirectory, file)).href}"`);
  body = body.replace(/\s+onClick="[^"]*"/gi, '');
  return { css, body };
}

export async function shopBoardReference(name: string, state: string, mode: string, width: number): Promise<string> {
  const rendered = await board(name, state, mode, width);
  const directory = resolve(__dirname, 'visual-results/reference-html');
  await mkdir(directory, { recursive: true });
  const file = resolve(directory, `${name}-${state}-${mode}-${width}.html`);
  await writeFile(file, `<!doctype html><html lang="zh-Hans"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${rendered.css}</style><body>${rendered.body}</body></html>`, 'utf8');
  return pathToFileURL(file).href;
}
