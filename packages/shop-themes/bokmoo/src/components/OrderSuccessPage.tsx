import React from 'react';
import { AlertTriangle, CheckCircle2, Copy, Loader2, RefreshCw } from 'lucide-react';
import type { OrderSuccessPageProps } from 'shared/src/types/theme';
import { getBokmooInstallSession, getOrderIdFromLocation, type BokmooInstallSession } from '../lib/api';
import { InstallSessionPanel } from './InstallSessionPanel';
import { resolveBokmooSiteConfig } from '../site';

function copyToClipboard(value: string) {
  if (!value || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
  navigator.clipboard.writeText(value).catch(() => undefined);
}

function getPollDelay(attempt: number): number {
  if (attempt < 10) return 3000;
  if (attempt < 22) return 10000;
  return 0;
}

export const OrderSuccessPage = React.memo(function OrderSuccessPage({
  orderNumber,
  isVerifying,
  onContinueShopping,
  onViewOrders,
  config,
  order,
}: OrderSuccessPageProps & { order?: { id?: string } | null }) {
  const site = resolveBokmooSiteConfig(config);
  const orderId = order?.id || getOrderIdFromLocation() || '';

  const [installSession, setInstallSession] = React.useState<BokmooInstallSession | null>(null);
  const [status, setStatus] = React.useState<'idle' | BokmooInstallSession['status']>(
    isVerifying ? 'processing' : 'idle'
  );
  const [errorMessage, setErrorMessage] = React.useState<string>('');
  const [attempt, setAttempt] = React.useState(0);

  const loadInstallSession = React.useCallback(async () => {
    if (!orderId) return;

    try {
      const session = await getBokmooInstallSession(
        {
          baseUrl: site.apiBaseUrl,
        },
        orderId
      );
      setInstallSession(session);
      setStatus(session.status);
      setErrorMessage('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load install session.';
      setErrorMessage(message);
      setStatus('failed');
    }
  }, [orderId, site.apiBaseUrl]);

  React.useEffect(() => {
    if (!orderId) return;
    void loadInstallSession();
  }, [loadInstallSession, orderId]);

  React.useEffect(() => {
    if (!orderId) return;
    if (status !== 'processing' && status !== 'idle') return;

    const delay = getPollDelay(attempt);
    if (delay <= 0) {
      setErrorMessage('Fulfillment is taking longer than expected. Please refresh or contact support.');
      return;
    }

    const timer = window.setTimeout(() => {
      setAttempt((current) => current + 1);
      void loadInstallSession();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [attempt, loadInstallSession, orderId, status]);

  const isReady = status === 'ready' || status === 'installed';
  const supportEmail = installSession?.support?.email || site.supportEmail;
  return (
    <div className="min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-24 pt-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[520px]">
        <div className="rounded-[1.6rem] border border-[var(--bokmoo-line)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--bokmoo-bg-elevated)_96%,white),var(--bokmoo-bg-elevated))] p-6 text-center shadow-[var(--bokmoo-shadow)] sm:p-8">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_36%,transparent)] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_10%,transparent)] text-[var(--bokmoo-gold)]">
            {status === 'failed' || status === 'expired' ? (
              <AlertTriangle className="h-11 w-11" />
            ) : status === 'processing' || isVerifying ? (
              <Loader2 className="h-11 w-11 animate-spin" />
            ) : (
              <CheckCircle2 className="h-11 w-11" />
            )}
          </div>

          <h1 className="mt-8 text-[clamp(2.2rem,4vw,3.6rem)] font-semibold tracking-[-0.05em] text-[var(--bokmoo-ink)]">
            {status === 'failed'
              ? 'Fulfillment Needs Attention'
              : status === 'expired'
                ? 'Activation Expired'
                : status === 'processing' || isVerifying
                  ? 'Preparing your eSIM...'
                  : 'Payment Successful!'}
          </h1>

          <p className="mt-4 text-base leading-8 text-[var(--bokmoo-copy)]">
            {status === 'failed'
              ? errorMessage || 'We could not prepare your install session yet.'
              : status === 'expired'
                ? 'Your activation session expired before installation completed.'
                : status === 'processing' || isVerifying
                  ? 'Your order is paid. We are preparing the install session now.'
                  : 'Your eSIM is ready to use.'}
          </p>

          {installSession?.packageTitle ? (
            <div className="mx-auto mt-8 max-w-[320px] rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] p-4 text-left">
              <div className="flex gap-3">
                <div className="h-16 w-20 overflow-hidden rounded-[0.8rem] bg-[linear-gradient(160deg,#924a57_0%,#261922_44%,#0f1115_100%)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--bokmoo-ink)]">{installSession.packageTitle}</p>
                  <p className="mt-1 text-xs text-[var(--bokmoo-copy-soft)]">{installSession.smdpAddress || 'eSIM activation'}</p>
                  <p className="mt-1 text-xs text-[var(--bokmoo-copy-soft)]">
                    {installSession.expiresAt ? `Expires ${new Date(installSession.expiresAt).toLocaleDateString()}` : 'Ready to install'}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {isReady && installSession ? (
            <InstallSessionPanel className="mt-8" session={installSession} />
          ) : null}

          <div className="mt-8 space-y-3">
            <button
              onClick={isReady ? onViewOrders : () => void loadInstallSession()}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[0.95rem] bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_68%,black))] px-5 text-sm font-semibold text-[var(--bokmoo-bg)]"
              type="button"
            >
              {isReady ? 'View eSIM Details' : 'Refresh Status'}
              {!isReady ? <RefreshCw className="h-4 w-4" /> : null}
            </button>
            <button
              onClick={onContinueShopping}
              className="flex min-h-12 w-full items-center justify-center rounded-[0.95rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-5 text-sm font-medium text-[var(--bokmoo-ink)]"
              type="button"
            >
              Back to Store
            </button>
          </div>

          <div className="mt-6 space-y-2 text-sm text-[var(--bokmoo-copy-soft)]">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--bokmoo-line)] px-4 py-2">
              Order reference
              <code className="font-semibold text-[var(--bokmoo-ink)]">{orderNumber}</code>
              <button
                onClick={() => copyToClipboard(orderNumber)}
                className="text-[var(--bokmoo-gold)]"
                type="button"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>

            <p>
              Support: <a className="text-[var(--bokmoo-ink)] underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});
