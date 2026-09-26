'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function ImageCarousel({ slides }: {
  slides: Array<{ image: string; title: string; alt?: string; link?: string }>;
}) {
  const [index, setIndex] = useState(0);
  if (!slides.length) return null;
  const slide = slides[index];
  return <section aria-label={slide.title} className="relative overflow-hidden rounded-shop bg-highlight">
    <div className="relative aspect-[2/1]">
      <Image src={slide.image} alt={slide.alt ?? ''} fill unoptimized className="object-cover" />
    </div>
    <div className="absolute inset-x-0 bottom-0 bg-surface p-4">
      {slide.link ? <Link href={slide.link} className="font-semibold text-action">{slide.title}</Link>
        : <h2 className="font-semibold">{slide.title}</h2>}
      <div className="mt-2 flex gap-2">
        <button type="button" aria-label="Previous slide" onClick={() => setIndex((index + slides.length - 1) % slides.length)}
          className="rounded-shop border border-line p-2"><ChevronLeft size={18} /></button>
        <button type="button" aria-label="Next slide" onClick={() => setIndex((index + 1) % slides.length)}
          className="rounded-shop border border-line p-2"><ChevronRight size={18} /></button>
      </div>
    </div>
  </section>;
}
