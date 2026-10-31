'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { listPreferencesApi, unwrapApiResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface ListColumn {
  key: string;
  label: string;
  alwaysVisible?: boolean;
}

/**
 * Loads the signed-in administrator's column preference for one list and
 * persists every toggle. The preference is per user and per list, so the
 * server derives the owner from the session.
 */
export function useListColumns(listKey: string, columnKeys: string[]) {
  const allKey = columnKeys.join(',');
  const [visible, setVisible] = useState<string[]>(columnKeys);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const allowed = allKey.split(',').filter(Boolean);
    const load = async () => {
      try {
        const response = await listPreferencesApi.getPreference(listKey);
        if (!active) return;
        const stored = unwrapApiResponse(response).columns ?? [];
        const kept = stored.filter(key => allowed.includes(key));
        setVisible(kept.length ? kept : allowed);
      } catch { if (active) setVisible(allowed); }
    };
    void load();
    return () => { active = false; };
  }, [allKey, listKey]);

  const toggle = (key: string) => {
    const next = visible.includes(key) ? visible.filter(entry => entry !== key) : [...visible, key];
    if (!next.length) return;
    setVisible(next);
    setSaving(true);
    setFailed(false);
    listPreferencesApi.setPreference(listKey, next)
      .then(() => setSaving(false))
      .catch(() => { setSaving(false); setFailed(true); });
  };

  return { visible, toggle, saving, failed };
}

export function ColumnPicker({ label, columns, visible, onToggle, disabled = false }: {
  label: string;
  columns: ListColumn[];
  visible: string[];
  onToggle: (key: string) => void;
  disabled?: boolean;
}) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="outline" aria-label={label} disabled={disabled} className="h-[34px] gap-2 bg-raised px-3">
        <Columns3 aria-hidden="true" className="size-3.5 text-faint" />{label}<ChevronDown aria-hidden="true" className="size-3 text-faint" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" aria-label={label} className="w-auto min-w-44 p-1">
      {columns.map(column => {
        const checked = visible.includes(column.key);
        return <DropdownMenuItem key={column.key} role="menuitemcheckbox" aria-checked={checked} disabled={column.alwaysVisible} onSelect={() => onToggle(column.key)} className="flex items-center gap-2">
          <span aria-hidden="true" className={cn('flex size-3.5 shrink-0 items-center justify-center rounded-sm border', checked ? 'border-foreground bg-foreground text-background' : 'border-border')}>{checked ? <Check className="size-3" /> : null}</span>
          {column.label}
        </DropdownMenuItem>;
      })}
    </DropdownMenuContent>
  </DropdownMenu>;
}
