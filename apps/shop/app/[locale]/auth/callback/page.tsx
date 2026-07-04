'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/hooks/use-toast';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useShopTheme } from '@/lib/themes/provider';
import { useT } from 'shared/src/i18n/react';
import { LoadingState, ErrorState } from '@/components/ui/state-components';

function readCallbackParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  const search = new URLSearchParams(window.location.search);
  const hash = window.location.hash.startsWith('#')
    ? new URLSearchParams(window.location.hash.slice(1))
    : new URLSearchParams();

  for (const [key, value] of hash.entries()) {
    if (!search.has(key)) search.set(key, value);
  }

  return search;
}

export default function AuthCallbackPage() {
  const { theme, config, isLoading: themeLoading } = useShopTheme();
  const { completeOAuthSession, isLoading, error } = useAuthStore();
  const router = useRouter();
  const nav = useLocalizedNavigation();
  const { toast } = useToast();
  const t = useT();
  const [callbackError, setCallbackError] = React.useState<string | null>(null);

  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  React.useEffect(() => {
    let cancelled = false;

    const complete = async () => {
      const params = readCallbackParams();
      const authError = params.get('auth_error') || params.get('error');
      if (authError) {
        setCallbackError(authError);
        return;
      }

      const accessToken = params.get('access_token') || params.get('accessToken');
      if (!accessToken) {
        setCallbackError(getText('shop.auth.login.failed', 'Login failed'));
        return;
      }

      try {
        await completeOAuthSession({
          accessToken,
          refreshToken: params.get('refresh_token') || params.get('refreshToken'),
        });
        if (cancelled) return;

        toast({
          title: getText('shop.auth.login.success', 'Login successful'),
          description: getText('shop.auth.login.welcomeBack', 'Welcome back!'),
        });

        const redirectPath = sessionStorage.getItem('redirectAfterLogin');
        if (redirectPath) {
          sessionStorage.removeItem('redirectAfterLogin');
          router.replace(redirectPath);
        } else {
          nav.replace('/');
        }
      } catch (err: any) {
        if (!cancelled) {
          setCallbackError(err.message || getText('common.errors.tryAgain', 'Please try again'));
        }
      }
    };

    complete();

    return () => {
      cancelled = true;
    };
  }, [completeOAuthSession, getText, nav, router, toast]);

  if (themeLoading) {
    return (
      <LoadingState
        type="spinner"
        message={getText('common.actions.loading', 'Loading...')}
        fullPage
      />
    );
  }

  const AuthCallbackComponent = theme?.components?.AuthCallbackPage;
  if (AuthCallbackComponent) {
    return (
      <AuthCallbackComponent
        provider="oauth"
        isLoading={isLoading && !callbackError}
        error={callbackError || error}
        config={config}
        locale={nav.locale}
        t={t}
        onRetry={() => nav.replace('/auth/login')}
        onNavigateToHome={() => nav.replace('/')}
      />
    );
  }

  return (
    <ErrorState
      title={callbackError ? getText('shop.auth.login.failed', 'Login failed') : getText('common.actions.loading', 'Loading...')}
      message={callbackError || error || getText('shop.auth.login.welcomeBack', 'Welcome back!')}
      onGoHome={() => nav.replace('/')}
      fullPage
    />
  );
}
