'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { accountApi } from '@/lib/api';
import { useLocalizedNavigation } from '@/hooks/use-localized-navigation';
import { useShopTheme } from '@/lib/themes/provider';
import { useT } from 'shared/src/i18n/react';

function readCallbackParams(): URLSearchParams {
  const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
  const search = typeof window !== 'undefined' ? window.location.search.replace(/^\?/, '') : '';
  return new URLSearchParams(hash || search);
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const { getHref, push, locale } = useLocalizedNavigation();
  const { theme, config } = useShopTheme();
  const { setUser, setAuthenticated, setLoading } = useAuthStore();
  const t = useT();
  const [error, setError] = React.useState<string | null>(null);
  const [isCompleting, setIsCompleting] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    async function completeAuth() {
      setIsCompleting(true);
      setLoading(true);

      try {
        const params = readCallbackParams();
        const authError = params.get('auth_error');
        if (authError) {
          throw new Error(authError);
        }

        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (!accessToken) {
          throw new Error('No authentication token was returned');
        }

        localStorage.setItem('auth_token', accessToken);
        if (refreshToken) {
          localStorage.setItem('refresh_token', refreshToken);
        }

        const profileResponse = await accountApi.getProfile();
        if (profileResponse.success && profileResponse.data) {
          setUser(profileResponse.data as any);
        }
        setAuthenticated(true);

        if (!cancelled) {
          const redirectPath = sessionStorage.getItem('redirectAfterLogin');
          sessionStorage.removeItem('redirectAfterLogin');
          router.replace(redirectPath || getHref('/'));
        }
      } catch (callbackError: any) {
        if (!cancelled) {
          setError(callbackError?.message || 'Authentication failed');
          setAuthenticated(false);
        }
      } finally {
        setLoading(false);
        if (!cancelled) {
          setIsCompleting(false);
        }
      }
    }

    void completeAuth();

    return () => {
      cancelled = true;
    };
  }, [getHref, router, setAuthenticated, setLoading, setUser]);

  const CallbackComponent = theme?.components?.AuthCallbackPage;
  if (!CallbackComponent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <h1 className="text-xl font-semibold">{error || 'Completing sign in'}</h1>
          <button className="mt-4 underline" type="button" onClick={() => push('/auth/login')}>
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <CallbackComponent
      provider="social"
      isLoading={isCompleting}
      error={error}
      config={config}
      locale={locale}
      t={t}
      onRetry={() => push('/auth/login')}
      onNavigateToHome={() => push('/')}
    />
  );
}
