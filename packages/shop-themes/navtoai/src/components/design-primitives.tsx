import React from 'react';
import { BarChart3, Boxes, Code2, ImageIcon, MessageCircle, MoreHorizontal, PenLine, Send, Sparkles, Star, TrendingUp, Video } from 'lucide-react';

export function NavtoAiLogo({ tagline }: { tagline?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
        <Send className="h-8 w-8 -rotate-12 fill-[#e8edff] text-[#2f6bff]" strokeWidth={2.4} />
        <span className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full bg-[#53d6ff] shadow-[0_0_16px_rgba(83,214,255,0.5)]" />
      </div>
      <div className="min-w-0">
        <div className="text-[1.4rem] font-black leading-none tracking-tight text-[#12172f]">
          navto<span className="text-[#2f6bff]">ai</span>
        </div>
        {tagline ? <div className="mt-1 text-[0.72rem] font-semibold leading-none text-[#6f7890]">{tagline}</div> : null}
      </div>
    </div>
  );
}

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

export function HeroArch({ locale }: { locale?: string }) {
  const words =
    locale === 'en'
      ? ['EXPLORE', 'LEARN', 'CREATE', 'SHARE']
      : locale === 'zh-Hant'
        ? ['探索', '學習', '創造', '分享']
        : ['探索', '学习', '创造', '分享'];
  return (
    <div className="relative h-full min-h-[22rem] w-full overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(160deg,#eef4ff_0%,#e7eefc_45%,#dfe9fb_100%)]" />
      {/* arch */}
      <div className="absolute right-[6%] top-[6%] h-[88%] w-[52%] overflow-hidden rounded-t-[999px] border border-white/70 shadow-[0_40px_80px_-40px_rgba(47,107,255,0.45)]">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#bfe0ff_0%,#e8f4ff_38%,#cfe3d8_55%,#9fb8c9_70%,#7e97ab_100%)]" />
        {/* sun */}
        <div className="absolute left-[18%] top-[30%] h-10 w-10 rounded-full bg-[#ffe9c4] blur-[2px]" />
        {/* mountains */}
        <div className="absolute bottom-[30%] left-[-6%] h-[34%] w-[70%] rotate-[8deg] rounded-[50%] bg-[#a8bcc9]/70" />
        <div className="absolute bottom-[28%] right-[-10%] h-[38%] w-[75%] -rotate-[6deg] rounded-[50%] bg-[#8ba3b5]/80" />
        {/* water */}
        <div className="absolute bottom-0 left-0 right-0 h-[30%] bg-[linear-gradient(180deg,#9db6c6_0%,#7d99ad_100%)]" />
        <div className="absolute bottom-[12%] left-[10%] right-[10%] h-px bg-white/40" />
        <div className="absolute bottom-[20%] left-[16%] right-[16%] h-px bg-white/30" />
        {/* text inside arch */}
        <div className="absolute left-[12%] top-[14%] max-w-[70%]">
          <p className="text-[1.05rem] font-black leading-snug text-[#1b2b4a]">
            A More
            <br />
            Creative
            <br />
            Tomorrow
          </p>
          <div className="mt-3 h-px w-8 bg-[#1b2b4a]/60" />
          <p className="mt-3 text-[0.68rem] font-semibold uppercase leading-5 tracking-[0.18em] text-[#24405f]">
            Tools
            <br />
            People
            <br />
            Possibilities
          </p>
        </div>
      </div>
      {/* floating words */}
      <div className="absolute right-[2%] top-[10%] hidden text-right xl:block">
        {words.map((w) => (
          <p key={w} className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-[#5b7397]">
            {w}
          </p>
        ))}
      </div>
    </div>
  );
}
