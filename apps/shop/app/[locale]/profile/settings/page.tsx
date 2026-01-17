/**
 * Profile Settings Page for Shop Application
 *
 * Allows users to update their profile and change password.
 * Supports i18n through the translation function.
 */

'use client';

import React from 'react';
import { useShopTheme } from '@/lib/themes/provider';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/hooks/use-toast';
import { accountApi, authApi } from '@/lib/api';
import { useT } from 'shared/src/i18n/react';

export default function ProfileSettingsPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const { user, isAuthenticated } = useAuthStore();
  const { toast } = useToast();
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
  if (!theme?.components?.ProfileSettingsPage) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold">{getText('common.errors.componentUnavailable', 'Component Not Found')}</h1>
          <p className="text-muted-foreground">
            {getText('common.errors.componentUnavailable', 'The ProfileSettingsPage component is not available in the current theme.')}
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

  // Handle save profile
  const handleSaveProfile = async (data: {
    name?: string;
    phone?: string;
    dateOfBirth?: string;
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    preferredLanguage?: string;
    timezone?: string;
  }) => {
    try {
      const response = await accountApi.updateProfile(data);
      if (response.success) {
        toast({
          title: getText('common.status.success', 'Success'),
          description: getText('shop.profile.settings.profileUpdated', 'Profile updated successfully'),
        });
      } else {
        throw new Error(response.message || getText('shop.profile.settings.profileUpdateFailed', 'Failed to update profile'));
      }
    } catch (error) {
      toast({
        title: getText('common.errors.error', 'Error'),
        description: error instanceof Error ? error.message : getText('shop.profile.settings.profileUpdateFailed', 'Failed to update profile'),
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Handle change password
  const handleChangePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const response = await authApi.changePassword({ currentPassword, newPassword });
      if (response.success) {
        toast({
          title: getText('common.status.success', 'Success'),
          description: getText('shop.profile.settings.passwordChanged', 'Password changed successfully'),
        });
      } else {
        throw new Error(response.message || getText('shop.profile.settings.passwordChangeFailed', 'Failed to change password'));
      }
    } catch (error) {
      toast({
        title: getText('common.errors.error', 'Error'),
        description: error instanceof Error ? error.message : getText('shop.profile.settings.passwordChangeFailed', 'Failed to change password'),
        variant: 'destructive',
      });
      throw error;
    }
  };

  const ProfileSettingsPageComponent = theme.components.ProfileSettingsPage;

  return (
    <ProfileSettingsPageComponent
      user={user ? {
        id: user.id,
        email: user.email,
        name: user.username || user.email,
        avatar: user.avatar,
        phone: (user as any).phone,
        dateOfBirth: (user as any).dateOfBirth,
        gender: (user as any).gender,
        preferredLanguage: (user as any).preferredLanguage,
        timezone: (user as any).timezone,
      } : null}
      isLoading={false}
      isAuthenticated={isAuthenticated}
      config={config}
      locale={nav.locale}
      t={t}
      onSaveProfile={handleSaveProfile}
      onChangePassword={handleChangePassword}
      onNavigateBack={() => nav.push('/profile')}
      onNavigateToLogin={() => nav.push('/auth/login')}
    />
  );
}
