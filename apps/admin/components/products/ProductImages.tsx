'use client';
import { useRef, useState } from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useT } from 'shared/src/i18n/react';
import { useUploadProductImage } from '@/lib/hooks/use-api';
import { resolveApiErrorMessage } from '@/lib/error-utils';
import { moveImage } from '@/lib/product-editor';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';

export function ProductImages({ images, onChange, onPending, disabled = false }: { images: string[]; onChange: (update: (current: string[]) => string[]) => void; onPending: (pending: boolean) => void; disabled?: boolean }) {
  const t = useT(), c = (key: string, values?: Record<string, string | number>) => t('merchant.catalog.' + key, values), upload = useUploadProductImage();
  const input = useRef<HTMLInputElement>(null), dragged = useRef<number | null>(null);
  const uploading = useRef(false);
  const [errors, setErrors] = useState<{ name: string; message: string }[]>([]);
  const files = async (selected: File[]) => {
    if (uploading.current || disabled) return;
    uploading.current = true;
    setErrors([]); onPending(true);
    try {
      for (const file of selected) {
        try {
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error(c('imageType'));
          const result = await upload.mutateAsync(file); onChange(current => [...current, result.url]);
        } catch (error) { setErrors(current => [...current, { name: file.name, message: error instanceof Error && error.message === c('imageType') ? error.message : resolveApiErrorMessage(error, t) }]); }
      }
    } finally { uploading.current = false; onPending(false); }
  };
  return <section className="space-y-3 rounded-lg border border-border p-4" aria-labelledby="images-title"><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="images-title" className="font-semibold">{c('images')}</h2><p className="text-xs text-faint">{c('imageOrderHint')}</p></div>
    <div className="flex flex-wrap gap-2.5">{images.map((url, index) => <div key={url + ':' + index} draggable={!disabled} className="relative size-24 shrink-0 cursor-grab rounded-md border border-border bg-raised" onDragStart={event => { dragged.current = index; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index)); }} onDragEnd={() => { dragged.current = null; }} onDragOver={event => { if (dragged.current !== null) event.preventDefault(); }} onDrop={event => { if (dragged.current === null) return; event.preventDefault(); event.stopPropagation(); const from = dragged.current; dragged.current = null; onChange(current => moveImage(current, from, index)); }}>
      <img draggable={false} src={url} alt={c('productImage', { n: index + 1 })} className="size-full rounded-md object-cover" />{index === 0 && <span className="absolute bottom-1 left-1 rounded bg-foreground px-1.5 py-0.5 text-[11px] text-ground">{c('cover')}</span>}
      <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 size-[22px] bg-ground" aria-label={c('imageActions', { n: index + 1 })}><MoreHorizontal aria-hidden="true" className="size-3" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
        <DropdownMenuItem disabled={disabled || index === 0} onSelect={() => onChange(current => moveImage(current, index, 0))}>{c('setCover')}</DropdownMenuItem>
        <DropdownMenuItem disabled={disabled || index === 0} onSelect={() => onChange(current => moveImage(current, index, index - 1))}>{c('moveEarlier')}</DropdownMenuItem>
        <DropdownMenuItem disabled={disabled || index === images.length - 1} onSelect={() => onChange(current => moveImage(current, index, index + 1))}>{c('moveLater')}</DropdownMenuItem>
        <DropdownMenuItem disabled={disabled} onSelect={() => onChange(current => current.filter((_, i) => i !== index))}>{c('remove')}</DropdownMenuItem>
      </DropdownMenuContent></DropdownMenu>
    </div>)}<div className="min-w-0 flex-[1_1_200px]" onDragOver={event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); }} onDrop={event => { if (!event.dataTransfer.files.length) return; event.preventDefault(); void files(Array.from(event.dataTransfer.files)); }}>
      <label htmlFor="product-images" role="button" tabIndex={0} aria-label={c('imageDrop')} className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border px-3 text-center text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring" onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.current?.click(); } }}><Plus aria-hidden="true" className="size-4" /><span>{c('imageDrop')}</span><span className="text-xs text-faint">{c('imageType')}</span></label>
      <input ref={input} id="product-images" aria-label={c('upload')} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={event => { const selected = Array.from(event.target.files ?? []); event.target.value = ''; void files(selected); }} />
    </div></div>{errors.map((error, index) => <p role="alert" key={index} className="break-words text-xs text-destructive">{error.name}: {error.message}</p>)}
  </section>;
}
