'use client';

import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { ShopImage } from './shop-image';
import type { ShopLocale } from '@/lib/locale';
import { storefrontMessages } from '@/lib/storefront-messages';

export function ProductGallery({ images, name, locale }: { images: string[]; name: string; locale: ShopLocale }) {
  const [selected, setSelected] = useState(0);
  const t = storefrontMessages(locale);
  return <section aria-label={name}>
    <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-lg bg-highlight">
      {images[selected] ? <ShopImage src={images[selected]} alt={name} fill sizes="(max-width: 720px) 100vw, 55vw" priority className="object-cover" /> : <ImageOff aria-label={t.product.noImage} size={50} className="text-subtle" />}
    </div>
    {images.length > 1 && <div className="mt-3 flex flex-wrap gap-2">{images.map((image, index) => <button key={`${image}-${index}`} type="button" aria-label={t.shop.image.replace('{count}', String(index + 1))} aria-pressed={index === selected}
      onClick={() => setSelected(index)} className={`relative size-16 overflow-hidden rounded-md border ${index === selected ? 'border-action ring-1 ring-action' : 'border-line'}`}>
      <ShopImage src={image} alt="" fill sizes="64px" className="object-cover" /></button>)}</div>}
  </section>;
}
