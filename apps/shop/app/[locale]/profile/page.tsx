/**
 * Profile Page for Shop Application
 *
 * Displays user profile information and navigation to settings/orders.
 * Supports i18n through the translation function.
 */

'use client';

import React from 'react';
import { useShopTheme } from '@/lib/themes/provider';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useAuthStore } from '@/store/auth';
import { useT } from 'shared/src/i18n';

export default function ProfilePage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const { user, isAuthenticated } = useAuthStore();
  const t = useT();

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  // Theme loading state
  if (themeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">{getText('common.actions.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  // Check theme component availability
  if (!theme?.components?.ProfilePage) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold">{getText('common.errors.componentUnavailable', 'Component Not Found')}</h1>
          <p className="text-muted-foreground">
            {getText('common.errors.componentUnavailable', 'The ProfilePage component is not available in the current theme.')}
          </p>
          <button
            onClick={() => nav.push('/')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            {getText('common.actions.goHome', 'Go Home')}
          </button>
        </div>
      </div>
    );
  }

  const ProfilePageComponent = theme.components.ProfilePage;

  return (
    <ProfilePageComponent
      user={user ? {
        id: user.id,
        email: user.email,
        name: user.username || user.email,
        avatar: user.avatar,
        createdAt: user.createdAt,
      } : null}
      isLoading={false}
      isAuthenticated={isAuthenticated}
      config={config}
      locale={nav.locale}
      t={t}
      onNavigateToSettings={() => nav.push('/profile/settings')}
      onNavigateToOrders={() => nav.push('/orders')}
      onNavigateToLogin={() => nav.push('/auth/login')}
    />
  );
}
