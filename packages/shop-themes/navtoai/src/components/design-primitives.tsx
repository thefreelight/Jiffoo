import React from 'react';
import { Boxes, Code2, ImageIcon, MessageCircle, PenLine, Send, Star, Video } from 'lucide-react';

export function NavtoAiLogo({ tagline }: { tagline?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
        <Send className="h-9 w-9 -rotate-12 fill-[#e8edff] text-[#6257ff]" strokeWidth={2.4} />
        <span className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full bg-[#53d6ff] shadow-[0_0_16px_rgba(83,214,255,0.5)]" />
      </div>
      <div className="min-w-0">
        <div className="text-[1.55rem] font-black leading-none text-[#12172f]">
          Navto<span className="text-[#5f55ff]">AI</span>
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
        logoClassByName[key] || 'bg-[#f3f5ff] text-[#6257ff]',
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

export const categoryIconMap = [MessageCircle, ImageIcon, Video, Code2, PenLine, Boxes];

export function HeroAiDevice() {
  return (
    <div className="relative h-[16rem] w-full min-w-[26rem] overflow-hidden rounded-r-[1.05rem]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_66%_48%,rgba(118,94,255,0.55),transparent_20%),radial-gradient(circle_at_74%_54%,rgba(86,213,255,0.32),transparent_24%)]" />
      <div className="absolute bottom-4 left-4 right-2 h-[9.5rem] rounded-[50%] border border-[#786dff]/25" />
      <div className="absolute bottom-8 left-16 right-12 h-[6.5rem] rounded-[50%] border border-[#8e85ff]/28" />
      <div className="absolute left-[45%] top-8 h-[9.8rem] w-[9.8rem] rotate-45 rounded-[1.35rem] border border-white/12 bg-[linear-gradient(135deg,rgba(65,69,149,0.76),rgba(16,19,59,0.96))] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_32px_70px_rgba(86,72,255,0.48)]" />
      <div className="absolute left-[45%] top-8 flex h-[9.8rem] w-[9.8rem] items-center justify-center rounded-[1.35rem] text-[4rem] font-black text-[#bfc7ff] [text-shadow:0_0_24px_rgba(118,104,255,0.9)]">
        AI
      </div>
      <div className="absolute left-[39%] top-[8.7rem] h-8 w-[11.5rem] rounded-[50%] bg-[#675bff]/40 blur-xl" />
      {[
        'left-[28%] top-[4.4rem]',
        'right-16 top-[2.5rem]',
        'right-8 bottom-[4.2rem]',
        'left-[33%] bottom-[3.2rem]',
      ].map((position, index) => (
        <span
          key={position}
          className={[
            'absolute flex h-10 w-10 items-center justify-center rounded-[0.7rem] border border-white/12 bg-[#20265d]/82 text-[#80e9ff] shadow-[0_16px_34px_rgba(13,17,55,0.36)]',
            position,
            index % 2 === 0 ? 'rotate-6' : '-rotate-6',
          ].join(' ')}
        >
          <span className="h-4 w-5 rounded-sm border border-current" />
        </span>
      ))}
    </div>
  );
}
