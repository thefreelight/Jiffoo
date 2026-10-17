'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export function Choice({ id, label, value, options, onChange, className, prefix = false }: {
  id?: string; label: string; value: string; options: { value: string; label: string }[];
  onChange: (value: string) => void; className?: string; prefix?: boolean;
}) {
  return <Select value={JSON.stringify(value)} onValueChange={encoded => onChange(JSON.parse(encoded))}>
    <SelectTrigger id={id} aria-label={label} className={cn('h-[34px] w-auto min-w-0 gap-2 rounded-[7px] border-border bg-raised text-foreground ring-offset-ground focus:ring-foreground', className)}>
      {prefix && <span className="shrink-0 text-faint">{label}</span>}<SelectValue />
    </SelectTrigger>
    <SelectContent className="max-w-[calc(100vw-32px)] border-border bg-ground text-foreground">
      {options.map(option => <SelectItem key={option.value} value={JSON.stringify(option.value)} className="focus:bg-active focus:text-foreground">{option.label}</SelectItem>)}
    </SelectContent>
  </Select>;
}
