/**
 * Login Page for Shop Application
 *
 * Handles user authentication with email/password and OAuth.
 * Supports i18n through the translation function.
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/hooks/use-toast';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useShopTheme } from '@/lib/themes/provider';
import { useT } from 'shared/src/i18n/react';

export default function LoginPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const router = useRouter();
  const nav = useLocalizedNavigation();
  const { toast } = useToast();
  const { login, isLoading, error, clearError, googleLogin } = useAuthStore();
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

  if (!theme?.components?.LoginPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-6">
          <h1 className="text-xl font-bold text-red-600">{getText('common.errors.componentUnavailable', 'Login Page Not Found')}</h1>
          <p className="mt-2 text-sm text-gray-600">{getText('common.errors.componentUnavailable', 'The login page component is not available in the current theme.')}</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (email: string, password: string) => {
    try {
      clearError();
      await login(email, password);
      toast({
        title: getText('shop.auth.login.success', 'Login successful'),
        description: getText('shop.auth.login.welcomeBack', 'Welcome back!'),
      });
      const redirectPath = sessionStorage.getItem('redirectAfterLogin');
      if (redirectPath) {
        // redirectPath already contains /{locale} from nav.getHref()
        // Use for redirect after login
        sessionStorage.removeItem('redirectAfterLogin');
        router.push(redirectPath);
      } else {
        // Navigate to home with locale preserved
        nav.push('/');
      }
    } catch (error: any) {
      toast({
        title: getText('shop.auth.login.failed', 'Login failed'),
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
        title: getText('shop.auth.login.oauthFailed', 'OAuth login failed'),
        description: error.message || getText('common.errors.tryAgain', 'Please try again'),
        variant: 'destructive',
      });
    }
  };

  const handleNavigateToRegister = () => {
    nav.push('/auth/register');
  };

  const handleNavigateToForgotPassword = () => {
    nav.push('/auth/forgot-password');
  };

  const LoginPageComponent = theme.components.LoginPage;

  return (
    <LoginPageComponent
      isLoading={isLoading}
      error={error}
      config={config}
      locale={nav.locale}
      t={t}
      onSubmit={handleSubmit}
      onOAuthClick={handleOAuthClick}
      onNavigateToRegister={handleNavigateToRegister}
      onNavigateToForgotPassword={handleNavigateToForgotPassword}
    />
  );
}
