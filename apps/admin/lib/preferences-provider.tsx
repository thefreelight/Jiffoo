'use client';
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { COLOR_MODE_COOKIE, SIDEBAR_COOKIE, preferenceCookie, type ColorMode } from './preferences';
const Preferences = createContext({ mode: 'system' as ColorMode, collapsed: false, darkAvailable: true,
  setMode: (_mode: ColorMode) => {}, toggleSidebar: () => {} });
export function PreferencesProvider({ initialMode, initialCollapsed, darkAvailable, children }: {
  initialMode: ColorMode; initialCollapsed: boolean; darkAvailable: boolean; children: ReactNode;
}) {
  const [mode, updateMode] = useState(initialMode);
  const [collapsed, updateCollapsed] = useState(initialCollapsed);
  // Server refreshes update preferences without remounting page or navigation state.
  useEffect(() => updateMode(initialMode), [initialMode]);
  useEffect(() => updateCollapsed(initialCollapsed), [initialCollapsed]);
  const setMode = (next: ColorMode) => {
    if (next === 'dark' && !darkAvailable) return;
    document.cookie = preferenceCookie(COLOR_MODE_COOKIE, next, window.location.protocol === 'https:');
    document.documentElement.dataset.colorMode = next;
    updateMode(next);
  };
  const toggleSidebar = () => {
    const next = !collapsed;
    document.cookie = preferenceCookie(SIDEBAR_COOKIE, next ? '1' : '0', window.location.protocol === 'https:');
    updateCollapsed(next);
  };
  return <Preferences.Provider value={{ mode, collapsed, darkAvailable, setMode, toggleSidebar }}>{children}</Preferences.Provider>;
}
export const usePreferences = () => useContext(Preferences);
