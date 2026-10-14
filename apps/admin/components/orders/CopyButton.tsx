'use client';
import { useEffect, useRef, useState } from 'react';
import { Copy } from 'lucide-react';
import { useT } from 'shared/src/i18n/react';
import { Button } from '@/components/ui/button';

export function CopyButton({ value, name, label, variant, buttonClassName = '' }: { value: string; name: string; label?: string; variant?: 'default' | 'outline' | 'ghost'; buttonClassName?: string }) {
  const t = useT(), [copied, setCopied] = useState(false), [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return <span className="inline-flex flex-wrap items-center gap-1.5">
    <Button type="button" variant={variant ?? (label ? 'outline' : 'ghost')} size={label ? 'sm' : 'icon'} className={(label ? 'h-[26px] px-2 text-xs' : 'size-7 shrink-0') + ' ' + buttonClassName} aria-label={name} onClick={async () => {
      clearTimeout(timer.current); setCopied(false); setFailed(false);
      try { await navigator.clipboard.writeText(value); setCopied(true); timer.current = setTimeout(() => setCopied(false), 2200); }
      catch { setFailed(true); }
    }}>{label ?? <Copy aria-hidden="true" className="size-3.5" />}</Button>
    {copied && <span role="status" className="text-xs text-muted-foreground">{t('merchant.orders.detailView.copied')}</span>}
    {failed && <span role="alert" className="text-xs text-destructive">{t('merchant.orders.detailView.copyError')}</span>}
  </span>;
}
