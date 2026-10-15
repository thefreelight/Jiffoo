'use client';

import { createContext, useContext } from 'react';

export const ThemeAssets = createContext<{ logo: string | null; loginBackground: string | null; storeName?: string }>({
  logo: null, loginBackground: null, storeName: '',
});

export const useThemeAssets = () => useContext(ThemeAssets);
