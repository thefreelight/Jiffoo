function svgToDataUri(svg: string): string {
  const normalized = svg.replace(/\s+/g, ' ').trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(normalized)}`;
}

export const YEVBI_HERO_VISUAL = svgToDataUri(`
  <svg width="1600" height="900" viewBox="0 0 1600 900" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="1600" height="900" fill="#05070B"/>
    <g opacity="0.16" stroke="#FFFFFF">
      <path d="M0 120H1600"/>
      <path d="M0 280H1600"/>
      <path d="M0 440H1600"/>
      <path d="M0 600H1600"/>
      <path d="M0 760H1600"/>
      <path d="M240 0V900"/>
      <path d="M520 0V900"/>
      <path d="M800 0V900"/>
      <path d="M1080 0V900"/>
      <path d="M1360 0V900"/>
    </g>
    <circle cx="1240" cy="190" r="210" fill="#1A3A8F" opacity="0.22"/>
    <circle cx="330" cy="710" r="260" fill="#0C1328" opacity="0.85"/>
    <path d="M180 620C360 540 530 520 690 560C840 600 980 590 1240 420" stroke="#E7ECF4" stroke-width="6" stroke-linecap="round" opacity="0.85"/>
    <path d="M960 210L1110 160L1230 250L1370 200" stroke="#7A90C2" stroke-width="5" stroke-linecap="round" opacity="0.9"/>
    <g opacity="0.95">
      <circle cx="180" cy="620" r="10" fill="#FFFFFF"/>
      <circle cx="690" cy="560" r="10" fill="#FFFFFF"/>
      <circle cx="1240" cy="420" r="10" fill="#FFFFFF"/>
      <circle cx="960" cy="210" r="8" fill="#9EB7F7"/>
      <circle cx="1230" cy="250" r="8" fill="#9EB7F7"/>
      <circle cx="1370" cy="200" r="8" fill="#9EB7F7"/>
    </g>
    <text x="122" y="160" fill="#FFFFFF" font-family="monospace" font-size="38" font-weight="700" letter-spacing="10">YEVBI</text>
    <text x="122" y="214" fill="#9AA7C8" font-family="monospace" font-size="20" letter-spacing="6">GLOBAL DATA NETWORK</text>
  </svg>
`);

export const YEVBI_CTA_VISUAL = svgToDataUri(`
  <svg width="1600" height="900" viewBox="0 0 1600 900" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="1600" height="900" fill="#0B0E14"/>
    <circle cx="1120" cy="450" r="360" fill="#1B2130" opacity="0.85"/>
    <circle cx="1120" cy="450" r="220" stroke="#E7ECF4" stroke-width="2" opacity="0.32"/>
    <circle cx="1120" cy="450" r="150" stroke="#E7ECF4" stroke-width="2" opacity="0.22"/>
    <path d="M650 455C820 395 930 344 1110 340C1260 336 1380 370 1500 452" stroke="#F5F7FB" stroke-width="5" stroke-linecap="round" opacity="0.8"/>
    <path d="M690 270C840 350 930 396 1110 398C1240 400 1340 360 1450 298" stroke="#8AA3DB" stroke-width="4" stroke-linecap="round" opacity="0.9"/>
    <g opacity="0.92">
      <circle cx="650" cy="455" r="9" fill="#FFFFFF"/>
      <circle cx="1110" cy="340" r="9" fill="#FFFFFF"/>
      <circle cx="1500" cy="452" r="9" fill="#FFFFFF"/>
      <circle cx="690" cy="270" r="8" fill="#9EB7F7"/>
      <circle cx="1110" cy="398" r="8" fill="#9EB7F7"/>
      <circle cx="1450" cy="298" r="8" fill="#9EB7F7"/>
    </g>
    <text x="150" y="676" fill="#FFFFFF" font-family="monospace" font-size="34" font-weight="700" letter-spacing="8">ALWAYS ONLINE</text>
  </svg>
`);

export const YEVBI_PRODUCT_FALLBACK_VISUAL = svgToDataUri(`
  <svg width="800" height="800" viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="800" height="800" fill="#0B0D12"/>
    <rect x="88" y="88" width="624" height="624" stroke="#1D2330" stroke-width="2"/>
    <circle cx="400" cy="312" r="128" stroke="#E7ECF4" stroke-width="10" opacity="0.9"/>
    <path d="M272 312H528" stroke="#E7ECF4" stroke-width="10" opacity="0.9"/>
    <path d="M400 184C446 228 468 271 468 312C468 353 446 396 400 440C354 396 332 353 332 312C332 271 354 228 400 184Z" stroke="#8AA3DB" stroke-width="10" opacity="0.95"/>
    <rect x="210" y="532" width="380" height="54" fill="#111826"/>
    <text x="244" y="567" fill="#FFFFFF" font-family="monospace" font-size="34" font-weight="700" letter-spacing="6">YEVBI PLAN</text>
  </svg>
`);

export const YEVBI_SEARCH_FALLBACK_VISUAL = svgToDataUri(`
  <svg width="800" height="800" viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="800" height="800" fill="#090B10"/>
    <g opacity="0.16" stroke="#FFFFFF">
      <path d="M0 160H800"/>
      <path d="M0 320H800"/>
      <path d="M0 480H800"/>
      <path d="M0 640H800"/>
      <path d="M160 0V800"/>
      <path d="M320 0V800"/>
      <path d="M480 0V800"/>
      <path d="M640 0V800"/>
    </g>
    <path d="M140 562C244 490 338 438 430 418C534 396 626 406 712 470" stroke="#F4F6FB" stroke-width="8" stroke-linecap="round"/>
    <circle cx="140" cy="562" r="9" fill="#FFFFFF"/>
    <circle cx="430" cy="418" r="9" fill="#FFFFFF"/>
    <circle cx="712" cy="470" r="9" fill="#FFFFFF"/>
    <text x="138" y="148" fill="#FFFFFF" font-family="monospace" font-size="32" font-weight="700" letter-spacing="8">SEARCH NODE</text>
  </svg>
`);

export const YEVBI_TESTIMONIAL_AVATARS = {
  sarah: svgToDataUri(`
    <svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="256" height="256" fill="#121722"/>
      <rect x="22" y="22" width="212" height="212" stroke="#E7ECF4" stroke-width="4"/>
      <circle cx="128" cy="98" r="40" fill="#8AA3DB"/>
      <path d="M64 198C77 156 99 136 128 136C157 136 179 156 192 198" fill="#E7ECF4"/>
      <text x="88" y="228" fill="#FFFFFF" font-family="monospace" font-size="24" font-weight="700" letter-spacing="4">SJ</text>
    </svg>
  `),
  michael: svgToDataUri(`
    <svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="256" height="256" fill="#0E1015"/>
      <rect x="22" y="22" width="212" height="212" stroke="#E7ECF4" stroke-width="4"/>
      <circle cx="128" cy="98" r="40" fill="#D3D9E6"/>
      <path d="M64 198C77 156 99 136 128 136C157 136 179 156 192 198" fill="#8096C8"/>
      <text x="88" y="228" fill="#FFFFFF" font-family="monospace" font-size="24" font-weight="700" letter-spacing="4">MC</text>
    </svg>
  `),
  alicia: svgToDataUri(`
    <svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="256" height="256" fill="#131722"/>
      <rect x="22" y="22" width="212" height="212" stroke="#E7ECF4" stroke-width="4"/>
      <circle cx="128" cy="98" r="40" fill="#A9B8D9"/>
      <path d="M64 198C77 156 99 136 128 136C157 136 179 156 192 198" fill="#F2F5FA"/>
      <text x="88" y="228" fill="#FFFFFF" font-family="monospace" font-size="24" font-weight="700" letter-spacing="4">AR</text>
    </svg>
  `),
} as const;

export function getFirstImageUrl(images: unknown, fallback: string): string {
  if (!Array.isArray(images) || images.length === 0) {
    return fallback;
  }

  const firstImage = images[0];

  if (typeof firstImage === 'string' && firstImage.trim().length > 0) {
    return firstImage;
  }

  if (firstImage && typeof firstImage === 'object') {
    const candidate = (firstImage as { url?: unknown; src?: unknown }).url
      ?? (firstImage as { url?: unknown; src?: unknown }).src;

    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return fallback;
}
