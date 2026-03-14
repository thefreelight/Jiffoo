'use client';

import * as React from 'react';
import { useShopTheme } from '@/lib/themes/provider';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useAuthStore } from '@/store/auth';
import { useT } from 'shared/src/i18n/react';
import { LoadingState, ErrorState } from '@/components/ui/state-components';

export default function ProfileSettingsPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const { user, isAuthenticated, isLoading, getProfile, updateProfile, changePassword } = useAuthStore();
  const t = useT();

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username || user.email
    : '';

  React.useEffect(() => {
    if (isAuthenticated) {
      getProfile();
    }
  }, [getProfile, isAuthenticated]);

  const getText = (key: string, fallback: string): string => (t ? t(key) : fallback);

  if (themeLoading) {
    return <LoadingState type="spinner" message={getText('common.actions.loading', 'Loading...')} fullPage />;
  }

  if (!theme?.components?.ProfileSettingsPage) {
    return (
      <ErrorState
        title={getText('common.errors.themeUnavailable', 'Theme Component Unavailable')}
        message={getText('common.errors.componentUnavailable', 'Unable to load profile settings page component')}
        onGoHome={() => nav.push('/')}
        fullPage
      />
    );
  }

  const ProfileSettingsPageComponent = theme.components.ProfileSettingsPage;

  return (
    <ProfileSettingsPageComponent
      user={user ? {
        id: user.id,
        email: user.email,
        name: displayName,
        avatar: user.avatar,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        preferredLanguage: user.preferredLanguage,
        timezone: user.timezone,
      } : null}
      isLoading={isLoading}
      isAuthenticated={isAuthenticated}
      config={config}
      locale={nav.locale}
      t={t}
      onSaveProfile={async (data) => {
        await updateProfile(data);
      }}
      onChangePassword={async (currentPassword, newPassword) => {
        await changePassword({ currentPassword, newPassword });
      }}
      onNavigateBack={() => nav.push('/profile')}
      onNavigateToLogin={() => nav.push('/auth/login')}
    />
  );
}
