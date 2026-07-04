'use client';

import { AlertCircle, ArrowRight, CheckCircle2, Coins, LoaderCircle, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { StudioBadge, StudioMain, StudioPage, StudioPanel, StudioSectionIntro } from './StudioShell';

const WALLET_API_BASE = '/api/extensions/plugin/wallet/api/api';

type CreditPack = {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  badge?: string;
  description: string;
};

type CreditsResponse = {
  balance: number;
  currencyName?: string;
};

type WalletPackagesResponse = {
  items?: Array<{
    id: string;
    name: string;
    description?: string | null;
    points: number;
    price: number | string;
    currency: string;
    metadata?: Record<string, unknown> | null;
  }>;
  total?: number;
};

type CheckoutResponse = {
  checkoutUrl?: string;
  sessionId?: string;
  checkoutId?: string;
};

type CheckoutVerifyResponse = {
  status: string;
  balance?: number;
  points?: number;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    message?: string;
  };
};

function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem('auth_token');
  } catch {
    return null;
  }
}

async function requestWallet<T>(path: string, options: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> {
  const token = getStoredAuthToken();
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(`${WALLET_API_BASE}${path}`, {
    method: options.method || 'GET',
    credentials: 'include',
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message || `Request failed (${response.status})`);
  }
  return payload.data as T;
}

function mapWalletPackage(item: NonNullable<WalletPackagesResponse['items']>[number], index: number): CreditPack {
  const badge = typeof item.metadata?.badge === 'string' ? item.metadata.badge : index === 1 ? 'Popular' : undefined;
  return {
    id: item.id,
    name: item.name,
    credits: item.points,
    price: Number(item.price),
    currency: item.currency,
    badge,
    description: item.description || 'Creator credits for image generation and visual iteration.',
  };
}

const fallbackPacks: CreditPack[] = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 80,
    price: 9,
    currency: 'USD',
    description: 'Enough for quick concept checks, thumbnails, and prompt experiments.',
  },
  {
    id: 'creator',
    name: 'Creator',
    credits: 260,
    price: 24,
    currency: 'USD',
    badge: 'Popular',
    description: 'A practical pack for campaign visuals, product directions, and iterations.',
  },
  {
    id: 'studio',
    name: 'Studio',
    credits: 720,
    price: 59,
    currency: 'USD',
    description: 'For heavier visual production runs and repeated client-facing experiments.',
  },
];

export function PricingPage() {
  const [packs, setPacks] = useState<CreditPack[]>(fallbackPacks);
  const [credits, setCredits] = useState<CreditsResponse | null>(null);
  const [status, setStatus] = useState<{ phase: 'idle' | 'loading' | 'success' | 'error'; message?: string }>({ phase: 'idle' });
  const token = useMemo(() => getStoredAuthToken(), []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const loadedPacks = await requestWallet<WalletPackagesResponse>('/packages');
        const mapped = Array.isArray(loadedPacks.items) ? loadedPacks.items.map(mapWalletPackage) : [];
        if (mounted && mapped.length > 0) setPacks(mapped);
      } catch {
        if (mounted) setPacks(fallbackPacks);
      }

      if (!token) return;
      try {
        const balance = await requestWallet<CreditsResponse>('/balance');
        if (mounted) setCredits(balance);
      } catch {
        if (mounted) setCredits(null);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id') || params.get('wallet_session_id');
    const checkoutState = params.get('wallet_checkout');
    if (!sessionId || checkoutState !== 'success') return;

    let cancelled = false;
    async function verifyCheckout() {
      setStatus({ phase: 'loading', message: 'Verifying Stripe checkout and crediting your wallet...' });
      try {
        const result = await requestWallet<CheckoutVerifyResponse>('/checkout/verify', {
          method: 'POST',
          body: { sessionId },
        });
        if (cancelled) return;
        if (result.status === 'paid') {
          setCredits((current) => ({ ...(current || { balance: 0 }), balance: result.balance ?? current?.balance ?? 0 }));
          setStatus({
            phase: 'success',
            message: `${result.points || 'Purchased'} credits added. Balance is now ${result.balance ?? 'updated'}.`,
          });
          const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
          window.history.replaceState({}, '', cleanUrl);
          return;
        }
        setStatus({ phase: 'error', message: `Checkout is ${result.status}. No credits were added yet.` });
      } catch (error) {
        if (!cancelled) {
          setStatus({ phase: 'error', message: error instanceof Error ? error.message : 'Unable to verify checkout.' });
        }
      }
    }

    void verifyCheckout();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleCheckout(pack: CreditPack) {
    if (!token) {
      window.location.href = '/auth/login';
      return;
    }

    setStatus({ phase: 'loading', message: `Preparing ${pack.name} credits...` });
    try {
      const currentUrl =
        typeof window === 'undefined'
          ? undefined
          : `${window.location.origin}${window.location.pathname}`;
      const result = await requestWallet<CheckoutResponse>(`/packages/${pack.id}/checkout`, {
        method: 'POST',
        body: currentUrl
          ? {
              successUrl: `${currentUrl}?wallet_checkout=success&session_id={CHECKOUT_SESSION_ID}`,
              cancelUrl: `${currentUrl}?wallet_checkout=cancelled`,
            }
          : undefined,
      });
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }

      setStatus({
        phase: 'error',
        message: 'Stripe checkout did not return a session URL. Please verify the official wallet + stripe checkout bridge.',
      });
    } catch (error) {
      setStatus({
        phase: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Official checkout is not connected yet. Enable wallet + stripe checkout before selling credits.',
      });
    }
  }

  return (
    <StudioPage activeNav="pricing">
      <StudioMain className="space-y-8">
        <StudioPanel>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <StudioSectionIntro
              eyebrow="Pricing"
              title="Get credits for image + magic = imagic."
              body="Credits power generation runs. Balance and packs come from the official wallet plugin; paid checkout is handed to the official Stripe bridge."
            />
            <div className="rounded-[1.4rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--imagic-muted)]">Current balance</p>
              <p className="mt-2 flex items-center gap-2 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--imagic-ink)]">
                <Coins className="h-6 w-6 text-[color:var(--imagic-primary)]" />
                {credits ? credits.balance : token ? '—' : 'Sign in'}
              </p>
            </div>
          </div>
        </StudioPanel>

        <div className="grid gap-4 lg:grid-cols-3">
          {packs.map((pack) => (
            <StudioPanel key={pack.id} className={pack.badge ? 'ring-2 ring-[color:var(--imagic-primary)]' : undefined}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  {pack.badge ? <StudioBadge>{pack.badge}</StudioBadge> : null}
                  <h2 className="mt-4 text-3xl font-semibold tracking-[-0.06em] text-[color:var(--imagic-ink)]">{pack.name}</h2>
                </div>
                <Sparkles className="h-6 w-6 text-[color:var(--imagic-primary)]" />
              </div>
              <p className="mt-5 text-5xl font-semibold tracking-[-0.08em] text-[color:var(--imagic-ink)]">
                ${pack.price}
                <span className="ml-2 text-sm font-medium tracking-normal text-[color:var(--imagic-muted)]">{pack.currency}</span>
              </p>
              <p className="mt-4 text-base leading-7 text-[color:var(--imagic-ink-soft)]">{pack.description}</p>
              <div className="mt-5 rounded-[1.2rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--imagic-muted)]">Included credits</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--imagic-ink)]">{pack.credits}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleCheckout(pack)}
                disabled={status.phase === 'loading'}
                className="imagic-button-primary mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white shadow-[var(--imagic-primary-shadow)] disabled:opacity-60"
              >
                {status.phase === 'loading' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {token ? 'Get credits' : 'Sign in to continue'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </StudioPanel>
          ))}
        </div>

        {status.phase !== 'idle' ? (
          <StudioPanel className={status.phase === 'error' ? 'border-red-200' : undefined}>
            <div className="flex items-center gap-3 text-sm font-semibold text-[color:var(--imagic-ink)]">
              {status.phase === 'loading' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {status.phase === 'success' ? <CheckCircle2 className="h-4 w-4 text-[color:var(--imagic-primary)]" /> : null}
              {status.phase === 'error' ? <AlertCircle className="h-4 w-4 text-red-500" /> : null}
              {status.message}
            </div>
          </StudioPanel>
        ) : null}
      </StudioMain>
    </StudioPage>
  );
}
