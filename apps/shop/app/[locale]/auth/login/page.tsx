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
import { LoadingState, ErrorState } from '@/components/ui/state-components';

export default function LoginPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const router = useRouter();
  const nav = useLocalizedNavigation();
  const { toast } = useToast();
  const { login, isLoading, error, clearError } = useAuthStore();
  const t = useT();

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  // Theme loading state - use unified LoadingState component
  if (themeLoading) {
    return (
      <LoadingState
        type="spinner"
        message={getText('common.actions.loading', 'Loading...')}
        fullPage
      />
    );
  }

  // If theme component is unavailable, use ErrorState fallback
  if (!theme?.components?.LoginPage) {
    const NotFoundComponent = theme?.components?.NotFound;
    if (NotFoundComponent) {
      return (
        <NotFoundComponent
          route="/auth/login"
          message={getText('common.errors.loginUnavailable', 'Login component unavailable')}
          config={config}
          onGoHome={() => nav.push('/')}
          t={t}
        />
      );
    }

    return (
      <ErrorState
        title={getText('common.errors.themeUnavailable', 'Theme Component Unavailable')}
        message={getText('common.errors.loginUnavailable', 'Unable to load login component')}
        onGoHome={() => nav.push('/')}
        fullPage
      />
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



  const handleNavigateToRegister = () => {
    nav.push('/auth/register');
  };

  const handleNavigateToForgotPassword = () => {
    nav.push('/auth/forgot-password');
  };

  const handleOAuthClick = async (provider: string) => {
    // OAuth feature not implemented
    console.log('OAuth not implemented:', provider);
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
      onNavigateToRegister={handleNavigateToRegister}
      onOAuthClick={handleOAuthClick}
      onNavigateToForgotPassword={handleNavigateToForgotPassword}
    />
  );
}
