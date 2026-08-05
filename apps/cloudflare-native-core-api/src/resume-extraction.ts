import { unzipSync } from 'fflate';
import { extractText as extractPdfText } from 'unpdf';

const textDecoder = new TextDecoder();

function normalizeExtractedText(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/[\t ]+/g, ' ').split('\n').map((line) => line.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 200_000);
}

function decodeXml(value: string): string {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

export async function extractResumeDocumentText(bytes: Uint8Array, contentType: string): Promise<string> {
  if (contentType === 'text/plain') return normalizeExtractedText(textDecoder.decode(bytes));
  if (contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const documentXml = unzipSync(bytes)['word/document.xml'];
    if (!documentXml) throw new Error('DOCX_DOCUMENT_XML_MISSING');
    const xml = textDecoder.decode(documentXml);
    return normalizeExtractedText(decodeXml(xml.replace(/<w:tab\s*\/>/g, '\t').replace(/<w:br\s*\/>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')));
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
