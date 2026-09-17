import React from 'react';
import { BarChart3, Boxes, Code2, ImageIcon, MessageCircle, MoreHorizontal, PenLine, Sparkles, Star, TrendingUp, Video } from 'lucide-react';

// Reference-design mark: the blue angular "A" glyph from the navtoai logo.
const NAVTOAI_MARK_SRC = '/theme-assets/navtoai/navtoai-mark.png';

export function NavtoAiLogo({ tagline }: { tagline?: string }) {
  return (
    <div className="flex items-center gap-3">
      <img src={NAVTOAI_MARK_SRC} alt="" className="h-9 w-9 shrink-0 object-contain" />
      <div className="min-w-0">
        <div className="text-[1.4rem] font-black leading-none tracking-tight text-[#12172f]">
          navto<span className="text-[#2f6bff]">ai</span>
        </div>
        {tagline ? <div className="mt-1 text-[0.72rem] font-semibold leading-none text-[#6f7890]">{tagline}</div> : null}
      </div>
    </div>
  );
}

// Brand marks cropped from the reference design; served from shop public assets.
const brandAssetByName: Record<string, string> = {
  chatgpt: '/theme-assets/navtoai/brand-chatgpt.png',
  midjourney: '/theme-assets/navtoai/brand-midjourney.png',
  claude: '/theme-assets/navtoai/brand-claude.png',
  'notion ai': '/theme-assets/navtoai/brand-notion-ai.png',
  runway: '/theme-assets/navtoai/brand-runway.png',
  perplexity: '/theme-assets/navtoai/brand-perplexity.png',
  sora: '/theme-assets/navtoai/trend-sora.png',
  lovable: '/theme-assets/navtoai/trend-lovable.png',
  cursor: '/theme-assets/navtoai/trend-cursor.png',
  suno: '/theme-assets/navtoai/trend-suno.png',
  elevenlabs: '/theme-assets/navtoai/trend-elevenlabs.png',
};

const logoClassByName: Record<string, string> = {
  chatgpt: 'bg-[#32b284] text-white',
  midjourney: 'bg-white text-[#1f2937]',
  'notion ai': 'bg-white text-[#151515]',
  cursor: 'bg-[#10131d] text-white',
  sora: 'bg-[#2e73e8] text-white',
  'claude 3': 'bg-[#e7c0a0] text-[#1d1712]',
  gemini: 'bg-white text-[#4977ff]',
  'bing ai': 'bg-white text-[#1986c9]',
  'dall-e 3': 'bg-[#e8fff6] text-[#1fa778]',
  'stable diffusion': 'bg-white text-[#6654ff]',
  runway: 'bg-white text-[#111827]',
  pika: 'bg-[#111827] text-[#f6d99c]',
  synthesia: 'bg-white text-[#5570ff]',
  perplexity: 'bg-[#071e25] text-[#3de7d1]',
};

function getInitials(name: string): string {
  const compact = name.replace(/[^a-zA-Z0-9\u3400-\u9fff]/g, '').trim();
  if (!compact) return 'AI';
  if (/[\u3400-\u9fff]/.test(compact)) return compact.slice(0, 1);
  return compact.slice(0, 1).toUpperCase();
}

export function ToolLogo({
  name,
  imageUrl,
  size = 'md',
}: {
  name: string;
  imageUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const key = name.toLowerCase();
  const sizeClass =
    size === 'xl'
      ? 'h-[5.75rem] w-[5.75rem] rounded-[1.35rem] text-4xl'
      : size === 'lg'
        ? 'h-14 w-14 rounded-[1rem] text-2xl'
        : size === 'sm'
          ? 'h-9 w-9 rounded-[0.65rem] text-sm'
          : 'h-12 w-12 rounded-[0.85rem] text-xl';

  if (imageUrl && imageUrl !== '/placeholder-product.svg') {
    return (
      <span className={`flex shrink-0 items-center justify-center overflow-hidden ${sizeClass}`}>
        <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
      </span>
    );
  }

  const brandSrc = brandAssetByName[key];
  if (brandSrc) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center overflow-hidden shadow-[0_12px_24px_-20px_rgba(24,31,68,0.4)] ${sizeClass}`}
      >
        <img src={brandSrc} alt={name} className="h-full w-full object-cover" />
      </span>
    );
  }

  return (
    <span
      className={[
        'flex shrink-0 items-center justify-center border border-[#edf0f7] font-black shadow-[0_12px_24px_-20px_rgba(24,31,68,0.4)]',
        sizeClass,
        logoClassByName[key] || 'bg-[#f3f5ff] text-[#2f6bff]',
      ].join(' ')}
    >
      {getInitials(name)}
    </span>
  );
}

export function Rating({ value, compact = false }: { value: string | number; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 font-semibold text-[#f5a11a] ${compact ? 'text-xs' : 'text-sm'}`}>
      <Star className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} fill-current`} />
      {value}
    </span>
  );
}

export const categoryIconMap = [MessageCircle, ImageIcon, Video, PenLine, Boxes, Code2, BarChart3, MoreHorizontal];
export const trendingIcon = TrendingUp;
export const sparkIcon = Sparkles;

export function HeroArt() {
  // Reference-design hero artwork (arch scene), cropped from the approved
  // design and served from shop public assets. The left fade blends the art
  // into the CSS gradient that continues behind the hero copy.
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 hidden select-none lg:block">
      <img
        src="/theme-assets/navtoai/hero-arch.png"
        alt=""
        className="h-full w-auto object-cover object-right [mask-image:linear-gradient(to_right,transparent_0%,black_26%)]"
      />
    </div>
  );
}
