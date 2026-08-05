import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { buildResumeFactCandidates, extractResumeDocumentText } from './resume-extraction';

describe('RemoteRadar resume extraction', () => {
  it('normalizes TXT and extracts high-confidence contact facts', async () => {
    const text = await extractResumeDocumentText(
      strToU8('Alex Example\r\n alex@example.com\t +1 (415) 555-0134\r\nhttps://example.com/alex'),
      'text/plain',
    );
    expect(text).toContain('Alex Example\nalex@example.com +1 (415) 555-0134');
    const facts = buildResumeFactCandidates(text);
    expect(facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'contact', label: 'email', value: 'alex@example.com', confidence: 0.99 }),
      expect.objectContaining({ kind: 'contact', label: 'phone', value: '+1 (415) 555-0134' }),
      expect.objectContaining({ kind: 'contact', label: 'link_1', value: 'https://example.com/alex' }),
    ]));
  });

  it('extracts paragraphs, tabs, breaks, and XML entities from DOCX', async () => {
    const docx = zipSync({
      'word/document.xml': strToU8('<w:document><w:body><w:p><w:r><w:t>Senior &amp; Staff</w:t></w:r></w:p><w:p><w:r><w:t>TypeScript</w:t><w:tab/><w:t>Cloudflare</w:t><w:br/><w:t>Workers</w:t></w:r></w:p></w:body></w:document>'),
    });
    await expect(extractResumeDocumentText(docx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
      .resolves.toBe('Senior & Staff\nTypeScript Cloudflare\nWorkers');
  });

  it('rejects malformed DOCX input', async () => {
    const docx = zipSync({ 'other.xml': strToU8('<xml/>') });
    await expect(extractResumeDocumentText(docx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
      .rejects.toThrow('DOCX_DOCUMENT_XML_MISSING');
  });
});
