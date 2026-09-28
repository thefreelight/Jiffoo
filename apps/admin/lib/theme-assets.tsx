'use client';

import { createContext, useContext } from 'react';

export const ThemeAssets = createContext<{ logo: string | null; loginBackground: string | null }>({
  logo: null, loginBackground: null,
});

export const useThemeAssets = () => useContext(ThemeAssets);
