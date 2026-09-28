export type ThemeFontFace = {
  id: string;
  family: string;
  url: string;
  weight: number;
  style: 'normal' | 'italic';
};

export function themeFontFaces(fonts: ThemeFontFace[]): string {
  return fonts.flatMap((font) => {
    if (!/^[A-Za-z][A-Za-z0-9 -]{0,99}$/.test(font.family)
      || !/^\/api\/v1\/themes\/[a-z][a-z0-9-]+\/[0-9]+\.[0-9]+\.[0-9]+\/fonts\/[a-zA-Z0-9_/-]+\.woff2$/.test(font.url)
      || !Number.isInteger(font.weight) || font.weight < 100 || font.weight > 900
      || !['normal', 'italic'].includes(font.style)) return [];
    return [`@font-face{font-family:"${font.family}";src:url("${font.url}") format("woff2");font-weight:${font.weight};font-style:${font.style};font-display:swap;}`];
  }).join('\n');
}
