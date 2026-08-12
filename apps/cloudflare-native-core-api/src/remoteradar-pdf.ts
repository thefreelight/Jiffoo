const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 48;
const TOP_Y = 744;
const BOTTOM_Y = 48;
const FONT_SIZE = 10;
const LINE_HEIGHT = 15;
const MAX_LINE_UNITS = 92;

function characterUnits(character: string): number {
  const codePoint = character.codePointAt(0) ?? 0;
  if (character === '\t') return 4;
  if (codePoint >= 0x2e80 || codePoint > 0xffff) return 2;
  return 1;
}

function wrapLine(line: string): string[] {
  if (!line) return [''];
  const wrapped: string[] = [];
  let current = '';
  let units = 0;
  for (const character of line) {
    const nextUnits = characterUnits(character);
    if (current && units + nextUnits > MAX_LINE_UNITS) {
      wrapped.push(current);
      current = '';
      units = 0;
    }
    current += character;
    units += nextUnits;
  }
  wrapped.push(current);
  return wrapped;
}

function utf16Hex(value: string): string {
  let hex = 'FEFF';
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    hex += codeUnit.toString(16).padStart(4, '0').toUpperCase();
  }
  return hex;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function renderRemoteRadarPdf(lines: string[]): Uint8Array {
  const visualLines = lines.flatMap((line) => wrapLine(line.replace(/\r/g, '')));
  const linesPerPage = Math.floor((TOP_Y - BOTTOM_Y) / LINE_HEIGHT) + 1;
  const pages = Array.from({ length: Math.max(1, Math.ceil(visualLines.length / linesPerPage)) }, (_, index) =>
    visualLines.slice(index * linesPerPage, (index + 1) * linesPerPage));

  const pageObjectIds = pages.map((_, index) => 7 + index * 2);
  const objects = new Map<number, string>();
  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objects.set(2, `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  objects.set(3, '<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UTF16-H /DescendantFonts [4 0 R] /ToUnicode 6 0 R >>');
  objects.set(4, '<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo 5 0 R /DW 1000 >>');
  objects.set(5, '<< /Registry (Adobe) /Ordering (GB1) /Supplement 5 >>');
  const toUnicode = '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /RemoteRadarUnicode def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n1 beginbfrange\n<0000> <FFFF> <0000>\nendbfrange\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend';
  objects.set(6, `<< /Length ${byteLength(toUnicode)} >>\nstream\n${toUnicode}\nendstream`);

  pages.forEach((pageLines, index) => {
    const pageId = pageObjectIds[index]!;
    const contentId = pageId + 1;
    const commands = [
      'BT',
      `/F1 ${FONT_SIZE} Tf`,
      `${MARGIN_X} ${TOP_Y} Td`,
      ...pageLines.flatMap((line, lineIndex) => [lineIndex === 0 ? `<${utf16Hex(line)}> Tj` : `0 -${LINE_HEIGHT} Td <${utf16Hex(line)}> Tj`]),
      'ET',
    ].join('\n');
    objects.set(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.set(contentId, `<< /Length ${byteLength(commands)} >>\nstream\n${commands}\nendstream`);
  });

  const objectCount = Math.max(...objects.keys());
  const chunks: string[] = ['%PDF-1.4\n'];
  const offsets = new Array<number>(objectCount + 1).fill(0);
  let offset = byteLength(chunks[0]!);
  for (let id = 1; id <= objectCount; id += 1) {
    const object = `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
    offsets[id] = offset;
    chunks.push(object);
    offset += byteLength(object);
  }
  const xrefOffset = offset;
  chunks.push(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
  chunks.push(`${offsets.slice(1).map((item) => `${String(item).padStart(10, '0')} 00000 n `).join('\n')}\n`);
  chunks.push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return new TextEncoder().encode(chunks.join(''));
}
