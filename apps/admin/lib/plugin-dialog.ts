'use client';

import { usePreferences } from '@/lib/preferences-provider';

const placements = {
  install: 'top-4 max-h-[calc(100dvh-32px)] max-w-[520px] translate-y-0 overflow-y-auto sm:top-24 sm:max-h-[calc(100dvh-112px)]',
  confirm: 'top-20 max-h-[calc(100dvh-96px)] max-w-[440px] translate-y-0 overflow-y-auto sm:top-40 sm:max-h-[calc(100dvh-176px)]',
  leave: 'top-20 max-h-[calc(100dvh-96px)] max-w-[520px] translate-y-0 overflow-y-auto sm:top-40 sm:max-h-[calc(100dvh-176px)]',
} as const;

export function usePluginDialogLayout(kind: keyof typeof placements) {
  const { collapsed } = usePreferences();
  return {
    overlayClassName: `z-[90] bg-[rgb(from_var(--admin-extras-overlay)_r_g_b_/_0.32)] ${collapsed ? 'min-[769px]:left-[56px]' : 'min-[769px]:left-[240px]'}`,
    className: `z-[100] w-[calc(100%-32px)] gap-3.5 rounded-xl p-5 sm:rounded-xl ${collapsed ? 'min-[769px]:left-[calc(50%+28px)]' : 'min-[769px]:left-[calc(50%+120px)]'} ${placements[kind]}`,
  };
}
