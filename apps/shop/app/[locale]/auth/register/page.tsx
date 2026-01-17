/**
 * Register Page for Shop Application
 *
 * Handles user registration with email/password and OAuth.
 * Supports i18n through the translation function.
 */

'use client';

import React from 'react';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/hooks/use-toast';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useShopTheme } from '@/lib/themes/provider';
import { useT } from 'shared/src/i18n/react';

export default function RegisterPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const { toast } = useToast();
  const { register, isLoading, error, clearError, googleLogin } = useAuthStore();
  const t = useT();

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  if (themeLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!theme?.components?.RegisterPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-6">
          <h1 className="text-xl font-bold text-red-600">{getText('common.errors.componentUnavailable', 'Register Page Not Found')}</h1>
          <p className="mt-2 text-sm text-gray-600">{getText('common.errors.componentUnavailable', 'The register page component is not available in the current theme.')}</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (formData: any) => {
    try {
      clearError();
      if (formData.password !== formData.confirmPassword) {
        toast({
          title: getText('common.errors.validation', 'Validation Error'),
          description: getText('shop.auth.register.passwordMismatch', 'Passwords do not match'),
          variant: 'destructive',
        });
        return;
      }
      await register({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
      });
      toast({
        title: getText('shop.auth.register.success', 'Registration successful'),
        description: getText('shop.auth.register.welcomeMessage', 'Welcome! You have been registered and logged in successfully.'),
      });
      nav.push('/');
    } catch (error: any) {
      toast({
        title: getText('shop.auth.register.failed', 'Registration failed'),
        description: error.message || getText('common.errors.tryAgain', 'Please try again'),
        variant: 'destructive',
      });
    }
  };

  const handleOAuthClick = async (provider: 'google') => {
    try {
      if (provider === 'google') {
        await googleLogin();
      }
    } catch (error: any) {
      toast({
        title: getText('shop.auth.register.oauthFailed', 'OAuth registration failed'),
        description: error.message || getText('common.errors.tryAgain', 'Please try again'),
        variant: 'destructive',
      });
    }
  };

  const handleNavigateToLogin = () => {
    nav.push('/auth/login');
  };

  const RegisterPageComponent = theme.components.RegisterPage;

  return (
    <RegisterPageComponent
      isLoading={isLoading}
      error={error}
      config={config}
      locale={nav.locale}
      t={t}
      onSubmit={handleSubmit}
      onOAuthClick={handleOAuthClick}
      onNavigateToLogin={handleNavigateToLogin}
    />
  );
}
