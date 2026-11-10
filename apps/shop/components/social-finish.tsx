'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { ShopLocale } from '@/lib/locale';
import { storefrontMessages } from '@/lib/storefront-messages';
import { safeNextPath } from '@/lib/auth-contract';
import { identityHandoffCode } from '@/lib/social-auth';

export function SocialFinish({ locale, error }: { locale: ShopLocale; error?: string }) {
  const t = storefrontMessages(locale).socialAuth;
  const started = useRef(false);
  const failure = error === 'IDENTITY_EMAIL_IN_USE' ? t.existingAccount : error === 'IDENTITY_CANCELLED' ? t.cancelled : t.failed;
  const [message, setMessage] = useState(error ? failure : t.finishing);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = error ? '' : identityHandoffCode(window.location.hash);
    window.history.replaceState(null, '', window.location.pathname);
    void (async () => {
      try {
        const response = await fetch('/bff/auth/identity/exchange', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
        const body = await response.json() as { data?: { returnTo: string }; error?: { code: string } };
        if (response.ok && body.data && !error) window.location.assign(safeNextPath(body.data.returnTo, locale));
        else setMessage(error ? failure : body.error?.code === 'IDENTITY_EMAIL_IN_USE' ? t.existingAccount : t.failed);
      } catch { setMessage(t.failed); }
    })();
  }, [error, locale, t, failure]);
  return <main className="mx-auto max-w-md space-y-5 px-4 py-16"><h1 className="text-xl font-semibold">{t.signIn}</h1><p role="status">{message}</p><Link href={`/${locale}/login`} className="underline">{t.backLogin}</Link></main>;
}
