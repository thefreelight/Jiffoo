import { unzipSync } from 'fflate';
import { extractText as extractPdfText } from 'unpdf';

const textDecoder = new TextDecoder();
const latin1Decoder = new TextDecoder('latin1');

export type ResumeFormat = 'pdf' | 'docx' | 'odt' | 'rtf' | 'html' | 'text';

// Canonical content-type per detected format, stored with the document so
// extraction downstream never depends on the (often empty or octet-stream)
// content-type a browser happens to send for .md/.rtf/.htm files.
export const RESUME_CONTENT_TYPES: Record<ResumeFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  html: 'text/html',
  text: 'text/plain',
};

const EXTENSION_FORMATS: Record<string, ResumeFormat> = {
  pdf: 'pdf',
  docx: 'docx',
  odt: 'odt',
  rtf: 'rtf',
  txt: 'text',
  text: 'text',
  md: 'text',
  markdown: 'text',
  mdown: 'text',
  htm: 'html',
  html: 'html',
  xhtml: 'html',
};

const CONTENT_TYPE_FORMATS: Record<string, ResumeFormat> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/rtf': 'rtf',
  'text/rtf': 'rtf',
  'text/html': 'html',
  'application/xhtml+xml': 'html',
  'text/plain': 'text',
  'text/markdown': 'text',
};

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function asciiPrefix(bytes: Uint8Array, length: number): string {
  return latin1Decoder.decode(bytes.subarray(0, length));
}

// A payload may only be treated as text/markdown when it actually reads like
// text; this keeps renamed binaries out of the text fallback.
function looksTextLike(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, 8192);
  if (sample.length === 0) return false;
  if (sample.includes(0)) return false;
  let control = 0;
  for (const byte of sample) {
    if (byte === 9 || byte === 10 || byte === 13) continue;
    if (byte < 32 || byte === 127) control += 1;
  }
  return control / sample.length < 0.15;
}

// Magic bytes win over the declared content-type: browsers frequently send an
// empty type or application/octet-stream for Markdown/RTF/HTML resumes, and a
// mislabelled file must still parse by what it actually is. Returns null when
// the payload is none of the supported resume formats.
export function detectResumeFormat(bytes: Uint8Array, declaredContentType: string, filename: string): ResumeFormat | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return 'pdf'; // %PDF
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06])) {
    // DOCX and ODT are both zipped office documents; the manifest entry tells
    // them apart. A zip that declares neither is not a supported resume.
    try {
      const entries = unzipSync(bytes, { filter: (file) => /^(mimetype|word\/document\.xml)$/.test(file.name) });
      if (entries['word/document.xml']) return 'docx';
      if (entries['mimetype'] && latin1Decoder.decode(entries['mimetype']).includes('opendocument.text')) return 'odt';
    } catch {
      // fall through to the declared-format hint below
    }
    // A corrupt DOCX/ODT (valid zip, missing part) should still surface the
    // specific *_MISSING extraction error, so honor an explicit declaration.
    const zipExtension = filename.includes('.') ? filename.slice(filename.lastIndexOf('.') + 1).toLowerCase() : '';
    const zipDeclared = declaredContentType.split(';')[0]!.trim().toLowerCase();
    const hint = EXTENSION_FORMATS[zipExtension] ?? CONTENT_TYPE_FORMATS[zipDeclared];
    if (hint === 'docx' || hint === 'odt') return hint;
    return null;
  }
  const head = asciiPrefix(bytes, 512).trimStart();
  if (head.startsWith('{\\rtf')) return 'rtf';
  if (/^<\?xml[^>]*\?>?\s*<!doctype\s+html/i.test(head) || /^<\!doctype\s+html/i.test(head) || /^<html[\s>]/i.test(head) || /^<body[\s>]/i.test(head)) return 'html';
  const extension = filename.includes('.') ? filename.slice(filename.lastIndexOf('.') + 1).toLowerCase() : '';
  const declared = declaredContentType.split(';')[0]!.trim().toLowerCase();
  const resolved = EXTENSION_FORMATS[extension] ?? CONTENT_TYPE_FORMATS[declared] ?? 'text';
  if (resolved === 'text' && !looksTextLike(bytes)) return null;
  return resolved;
}

function stripHtml(html: string): string {
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6]|tr|section|article|table|ul|ol)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
}

const RTF_DESTINATIONS = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'header', 'footer', 'headerl', 'headerr', 'footerl', 'footerr', 'pict', 'nonshppict', 'object', 'latentstyles', 'listtable', 'listoverridetable', 'generator', 'xmlnstbl', 'filetbl', 'themedata', 'colorschememapping', 'datastore', 'buptim', 'mmath']);

// Character-level RTF reader: skips destination groups (fonts, styles,
// metadata), converts control words (par/line/tab/cell/row), resolves \'hh and
// \uN escapes, and keeps \\ \{ \} literals.
function stripRtf(rtf: string): string {
  let out = '';
  let i = 0;
  // Called with i just after a '{'; advances past the matching '}'.
  const skipGroup = () => {
    let depth = 1;
    while (i < rtf.length && depth > 0) {
      const ch = rtf[i]!;
      if (ch === '\\') {
        i += 1;
        const next = rtf[i];
        if (next === "'") i += 3;
        else if (next !== undefined && /[a-z]/i.test(next)) {
          while (i < rtf.length && /[a-z0-9]/i.test(rtf[i]!)) i += 1;
          while (i < rtf.length && /[+-]|\d/.test(rtf[i]!)) i += 1;
          if (rtf[i] === ' ') i += 1;
        } else i += 1;
        continue;
      }
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      i += 1;
    }
  };
  while (i < rtf.length) {
    const ch = rtf[i]!;
    if (ch === '{') {
      i += 1;
      if (rtf[i] === '\\' && rtf[i + 1] === '*') { skipGroup(); continue; }
      const word = /^\\([a-z]+)/i.exec(rtf.slice(i, i + 40));
      if (word && RTF_DESTINATIONS.has(word[1]!.toLowerCase())) { skipGroup(); continue; }
      continue;
    }
    if (ch === '}') { i += 1; continue; }
    if (ch !== '\\') { out += ch; i += 1; continue; }
    i += 1;
    const next = rtf[i];
    if (next === undefined) break;
    if (/[\\{}]/.test(next)) { out += next; i += 1; continue; }
    if (next === "'") {
      const code = Number.parseInt(rtf.slice(i + 1, i + 3), 16);
      if (Number.isFinite(code)) out += String.fromCharCode(code);
      i += 3;
      continue;
    }
    if (next === '~' || next === '-') { out += next === '~' ? ' ' : '-'; i += 1; continue; }
    if (!/[a-z]/i.test(next)) { out += next; i += 1; continue; }
    // i still points at the control word's first letter (next); start there.
    let word = '';
    while (i < rtf.length && /[a-z]/i.test(rtf[i]!)) { word += rtf[i]!.toLowerCase(); i += 1; }
    let arg = '';
    while (i < rtf.length && (/[+-]|\d/.test(rtf[i]!))) { arg += rtf[i]!; i += 1; }
    if (rtf[i] === ' ') i += 1;
    if (word === 'par' || word === 'line' || word === 'page' || word === 'row' || word === 'cell' || word === 'nestcell') out += '\n';
    else if (word === 'tab') out += '\t';
    else if (word === 'u') {
      let code = Number(arg);
      if (Number.isFinite(code)) {
        if (code < 0) code += 0x10000;
        out += String.fromCharCode(code);
        // The ANSI fallback char is left in place: for fact extraction a
        // possible duplicate glyph is harmless, while blindly skipping one can
        // eat a legitimate space that follows the \uN delimiter.
      }
    }
  }
  return out;
}

function decodeXml(value: string): string {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)) || ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)) || ' ');
}

export function normalizeExtractedText(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/[\t ]+/g, ' ').split('\n').map((line) => line.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 200_000);
}

export async function extractResumeDocumentText(bytes: Uint8Array, contentType: string, filenameHint = ''): Promise<string> {
  const format = detectResumeFormat(bytes, contentType, filenameHint);
  if (format === null) throw new Error('RESUME_FORMAT_UNSUPPORTED');
  if (format === 'text') return normalizeExtractedText(textDecoder.decode(bytes));
  if (format === 'html') return normalizeExtractedText(decodeEntities(decodeXml(stripHtml(textDecoder.decode(bytes)))));
  if (format === 'rtf') return normalizeExtractedText(decodeEntities(stripRtf(latin1Decoder.decode(bytes))));
  if (format === 'docx') {
    const documentXml = unzipSync(bytes)['word/document.xml'];
    if (!documentXml) throw new Error('DOCX_DOCUMENT_XML_MISSING');
    const xml = textDecoder.decode(documentXml);
    return normalizeExtractedText(decodeXml(xml.replace(/<w:tab\s*\/>/g, '\t').replace(/<w:br\s*\/>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')));
  }
  if (format === 'odt') {
    const contentXml = unzipSync(bytes)['content.xml'];
    if (!contentXml) throw new Error('ODT_CONTENT_XML_MISSING');
    const xml = textDecoder.decode(contentXml);
    // Paragraph/heading ends become newlines; tabs and line breaks carry over.
    return normalizeExtractedText(decodeXml(xml.replace(/<\/text:(p|h)>/g, '\n').replace(/<text:line-break\s*\/>/g, '\n').replace(/<text:tab\s*\/>/g, '\t').replace(/<[^>]+>/g, '')));
  }
  const result = await extractPdfText(bytes, { mergePages: true });
  return normalizeExtractedText(result.text);
}

export function buildResumeFactCandidates(text: string): Array<{ kind: string; label: string; value: string; confidence: number }> {
  const candidates: Array<{ kind: string; label: string; value: string; confidence: number }> = [];
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = text.match(/(?:\+?\d[\d ()-]{7,}\d)/)?.[0]?.trim();
  const links = [...text.matchAll(/https?:\/\/[^\s)\]}>,]+/gi)].map((match) => match[0]).slice(0, 5);
  if (email) candidates.push({ kind: 'contact', label: 'email', value: email, confidence: 0.99 });
  if (phone) candidates.push({ kind: 'contact', label: 'phone', value: phone, confidence: 0.9 });
  links.forEach((value, index) => candidates.push({ kind: 'contact', label: `link_${index + 1}`, value, confidence: 0.9 }));
  text.split('\n').map((line) => line.trim()).filter((line) => line.length >= 3 && line.length <= 500).slice(0, 80).forEach((value, index) => {
    candidates.push({ kind: 'source_line', label: `line_${String(index + 1).padStart(3, '0')}`, value, confidence: 0.65 });
  });
  return candidates;
}
