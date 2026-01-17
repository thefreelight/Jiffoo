/**
 * Google OAuth Callback Page for Shop Application
 *
 * Handles Google OAuth callback and redirects user after authentication.
 * Supports i18n through the translation function.
 */

'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/hooks/use-toast';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useShopTheme } from '@/lib/themes/provider';
import { useT } from 'shared/src/i18n/react';

export default function GoogleCallbackPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const nav = useLocalizedNavigation();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const { handleGoogleCallback, isLoading, error } = useAuthStore();
  const [callbackError, setCallbackError] = React.useState<string | null>(null);
  const t = useT();

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  React.useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        if (!code) {
          setCallbackError(getText('shop.auth.login.oauthFailed', 'No authorization code received'));
          return;
        }

        await handleGoogleCallback(code, state || '');

        toast({
          title: getText('shop.auth.login.success', 'Login successful'),
          description: getText('shop.auth.login.welcomeBack', 'Welcome back!'),
        });

        const redirectPath = sessionStorage.getItem('redirectAfterLogin');
        if (redirectPath) {
          sessionStorage.removeItem('redirectAfterLogin');
          // redirectPath should already include locale from login page
          nav.push(redirectPath.replace(`/${nav.locale}`, ''));
        } else {
          nav.push('/');
        }
      } catch (error: any) {
        setCallbackError(error.message || getText('shop.auth.login.oauthFailed', 'Authentication failed'));
        toast({
          title: getText('shop.auth.login.oauthFailed', 'Authentication failed'),
          description: error.message || getText('common.errors.tryAgain', 'Please try again'),
          variant: 'destructive',
        });
      }
    };

    handleCallback();
  }, [searchParams, handleGoogleCallback, nav, toast, getText]);

  // Theme loading state
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

  // Check theme component availability
  if (!theme?.components?.AuthCallbackPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-6">
          <h1 className="text-xl font-bold text-red-600">{getText('common.errors.componentUnavailable', 'Auth Callback Page Not Found')}</h1>
          <p className="mt-2 text-sm text-gray-600">{getText('common.errors.componentUnavailable', 'The auth callback page component is not available in the current theme.')}</p>
        </div>
      </div>
    );
  }

  const AuthCallbackPageComponent = theme.components.AuthCallbackPage;

  const handleRetry = () => {
    setCallbackError(null);
    window.location.reload();
  };

  const handleNavigateToHome = () => {
    nav.push('/');
  };

  return (
    <AuthCallbackPageComponent
      provider="google"
      isLoading={isLoading}
      error={callbackError || error}
      config={config}
      locale={nav.locale}
      t={t}
      onRetry={handleRetry}
      onNavigateToHome={handleNavigateToHome}
    />
  );
}
