import { describe, expect, it } from 'vitest';
import { renderRemoteRadarPdf } from './remoteradar-pdf';

describe('RemoteRadar PDF renderer', () => {
  it('encodes Chinese and Unicode text as UTF-16 instead of replacing it', () => {
    const text = new TextDecoder().decode(renderRemoteRadarPdf(['中文简历', 'TypeScript 工程师']));
    expect(text).toContain('/Encoding /UniGB-UTF16-H');
    expect(text).toContain('FEFF4E2D65877B805386');
    expect(text).not.toContain('(????)');
  });

  it('creates multiple pages for long application packs', () => {
    const text = new TextDecoder().decode(renderRemoteRadarPdf(Array.from({ length: 120 }, (_, index) => `第 ${index + 1} 行：项目经历与技能说明`)));
    expect(text).toMatch(/\/Count [3-9]/);
    expect((text.match(/\/Type \/Page\b/g) ?? [])).toHaveLength(3);
  });

  it('writes byte-correct cross-reference offsets when content contains Unicode', () => {
    const bytes = renderRemoteRadarPdf(['你好，RemoteRadar']);
    const text = new TextDecoder().decode(bytes);
    const objectOffset = Number(text.match(/\n(\d{10}) 00000 n \n/)?.[1]);
    expect(new TextDecoder().decode(bytes.slice(objectOffset, objectOffset + 7))).toBe('1 0 obj');
  });
});
