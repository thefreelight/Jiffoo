import React from 'react';
import { ArrowLeft, Check, Copy, Link2, Plus, RefreshCw, UserPlus, UsersRound, WalletCards } from 'lucide-react';
import type { AffiliatePageProps } from 'shared/src/types/theme';
import {
  addBokmooAffiliateMember,
  BokmooApiError,
  createBokmooAffiliateOrganization,
  getBokmooAffiliateCommissions,
  getBokmooAffiliateOrganization,
  getBokmooAffiliatePartner,
  getBokmooOrganizationCommissions,
  registerBokmooAffiliatePartner,
  type BokmooAffiliateCommission,
  type BokmooAffiliateOrganization,
  type BokmooAffiliatePartner,
} from '../lib/api';
import { resolveBokmooSiteConfig } from '../site';

type View = 'partner' | 'organization';

function money(items: BokmooAffiliateCommission[]): string {
  const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return `${items[0]?.currency || 'USD'} ${total.toFixed(2)}`;
}

function orderId(item: BokmooAffiliateCommission): string {
  return item.orderId || item.order_id || '';
}

function createdAt(item: BokmooAffiliateCommission): string {
  return item.createdAt || item.created_at || '';
}

export const AffiliatePage = React.memo(function AffiliatePage({
  isLoading,
  isAuthenticated,
  config,
  locale,
  onNavigateBack,
  onNavigateToLogin,
}: AffiliatePageProps) {
  const site = resolveBokmooSiteConfig(config);
  const api = React.useMemo(() => ({ baseUrl: site.apiBaseUrl }), [site.apiBaseUrl]);
  const [view, setView] = React.useState<View>('partner');
  const [partner, setPartner] = React.useState<BokmooAffiliatePartner | null>(null);
  const [commissions, setCommissions] = React.useState<BokmooAffiliateCommission[]>([]);
  const [organization, setOrganization] = React.useState<BokmooAffiliateOrganization | null>(null);
  const [organizationCommissions, setOrganizationCommissions] = React.useState<BokmooAffiliateCommission[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const [displayName, setDisplayName] = React.useState('');
  const [organizationCode, setOrganizationCode] = React.useState('');
  const [organizationName, setOrganizationName] = React.useState('');
  const [organizationRate, setOrganizationRate] = React.useState('2.5');
  const [memberEmail, setMemberEmail] = React.useState('');
  const [memberRole, setMemberRole] = React.useState<'INFLUENCER' | 'MANAGER'>('INFLUENCER');

  const refresh = React.useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError('');
    const [partnerResult, organizationResult] = await Promise.allSettled([
      Promise.all([getBokmooAffiliatePartner(api), getBokmooAffiliateCommissions(api)]),
      Promise.all([
        getBokmooAffiliateOrganization(api),
        getBokmooOrganizationCommissions(api).catch((cause) => {
          if (cause instanceof BokmooApiError && cause.status === 404) return [];
          throw cause;
        }),
      ]),
    ]);
    if (partnerResult.status === 'fulfilled') {
      setPartner(partnerResult.value[0]);
      setCommissions(partnerResult.value[1]);
    } else if (!(partnerResult.reason instanceof BokmooApiError && partnerResult.reason.status === 404)) {
      setError(partnerResult.reason instanceof Error ? partnerResult.reason.message : 'Affiliate data could not be loaded');
    }
    if (organizationResult.status === 'fulfilled') {
      setOrganization(organizationResult.value[0]);
      setOrganizationCommissions(organizationResult.value[1]);
    } else if (!(organizationResult.reason instanceof BokmooApiError && organizationResult.reason.status === 404)) {
      setError(organizationResult.reason instanceof Error ? organizationResult.reason.message : 'Organization data could not be loaded');
    }
    setLoading(false);
  }, [api, isAuthenticated]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  if (isLoading) return <div className="min-h-screen bg-[var(--bokmoo-bg)]" />;
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bokmoo-bg)] px-5">
        <div className="max-w-md border-y border-[var(--bokmoo-line)] py-10 text-center">
          <WalletCards className="mx-auto h-7 w-7 text-[var(--bokmoo-gold)]" />
          <h1 className="mt-5 text-3xl text-[var(--bokmoo-ink)]">Affiliate workspace</h1>
          <button onClick={onNavigateToLogin} className="mt-7 min-h-11 bg-[var(--bokmoo-gold)] px-6 text-sm font-semibold text-[var(--bokmoo-bg)]" type="button">Sign in</button>
        </div>
      </div>
    );
  }

  const shareUrl = partner && typeof window !== 'undefined'
    ? `${window.location.origin}/${locale || 'en'}/r/${encodeURIComponent(partner.code)}`
    : '';

  return (
    <main className="min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-20 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--bokmoo-line)] pb-6">
          <button onClick={onNavigateBack} className="inline-flex h-10 w-10 items-center justify-center border border-[var(--bokmoo-line)] text-[var(--bokmoo-copy)]" aria-label="Back" type="button"><ArrowLeft className="h-4 w-4" /></button>
          <div className="flex border border-[var(--bokmoo-line)] p-1" role="tablist" aria-label="Affiliate view">
            <button onClick={() => setView('partner')} className={`min-h-9 px-4 text-xs font-semibold ${view === 'partner' ? 'bg-[var(--bokmoo-gold)] text-[var(--bokmoo-bg)]' : 'text-[var(--bokmoo-copy)]'}`} type="button">Partner</button>
            <button onClick={() => setView('organization')} className={`min-h-9 px-4 text-xs font-semibold ${view === 'organization' ? 'bg-[var(--bokmoo-gold)] text-[var(--bokmoo-bg)]' : 'text-[var(--bokmoo-copy)]'}`} type="button">Organization</button>
          </div>
          <button onClick={() => void refresh()} className="inline-flex h-10 w-10 items-center justify-center border border-[var(--bokmoo-line)] text-[var(--bokmoo-copy)]" aria-label="Refresh" type="button"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>

        {error ? <div className="mt-5 border border-[color:color-mix(in_oklab,var(--bokmoo-danger)_55%,transparent)] bg-[color:color-mix(in_oklab,var(--bokmoo-danger)_10%,transparent)] px-4 py-3 text-sm text-[var(--bokmoo-ink)]">{error}</div> : null}

        {view === 'partner' ? (
          <section className="pt-10">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--bokmoo-copy-soft)]">Personal affiliate</p>
                <h1 className="mt-3 max-w-2xl text-4xl text-[var(--bokmoo-ink)] sm:text-5xl">Your referral ledger.</h1>
                {partner ? (
                  <div className="mt-10 border-y border-[var(--bokmoo-line)] py-6">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="min-w-0 flex-1 border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 py-3 text-sm text-[var(--bokmoo-copy)]"><span className="block truncate">{shareUrl}</span></div>
                      <button onClick={async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }} className="inline-flex min-h-11 items-center justify-center gap-2 bg-[var(--bokmoo-gold)] px-5 text-sm font-semibold text-[var(--bokmoo-bg)]" type="button">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy link'}</button>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-x-10 gap-y-4 text-sm">
                      <span><b className="text-2xl text-[var(--bokmoo-ink)]">{money(commissions)}</b><small className="ml-2 text-[var(--bokmoo-copy-soft)]">earned</small></span>
                      <span><b className="text-2xl text-[var(--bokmoo-ink)]">{partner.commissionRate}%</b><small className="ml-2 text-[var(--bokmoo-copy-soft)]">rate</small></span>
                      <span><b className="text-2xl text-[var(--bokmoo-ink)]">{commissions.length}</b><small className="ml-2 text-[var(--bokmoo-copy-soft)]">orders</small></span>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={async (event) => { event.preventDefault(); setLoading(true); setError(''); try { await registerBokmooAffiliatePartner(api, { displayName, organizationCode: organizationCode || undefined }); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Registration failed'); } finally { setLoading(false); } }} className="mt-10 grid max-w-xl gap-4 border-y border-[var(--bokmoo-line)] py-7">
                    <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Display name" required className="h-12 border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" />
                    <input value={organizationCode} onChange={(event) => setOrganizationCode(event.target.value.toUpperCase())} placeholder="Organization code (optional)" className="h-12 border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" />
                    <button disabled={loading} className="min-h-12 bg-[var(--bokmoo-gold)] px-5 text-sm font-semibold text-[var(--bokmoo-bg)] disabled:opacity-50" type="submit">Create affiliate account</button>
                  </form>
                )}
              </div>
              <CommissionList items={commissions} title="Partner commissions" />
            </div>
          </section>
        ) : (
          <section className="pt-10">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--bokmoo-copy-soft)]">Organization affiliate</p>
                <h1 className="mt-3 max-w-2xl text-4xl text-[var(--bokmoo-ink)] sm:text-5xl">Creator network.</h1>
                {organization ? (
                  <div className="mt-9">
                    <div className="flex flex-wrap items-end justify-between gap-5 border-y border-[var(--bokmoo-line)] py-6">
                      <div><p className="text-sm text-[var(--bokmoo-copy-soft)]">{organization.code}</p><h2 className="mt-2 text-2xl text-[var(--bokmoo-ink)]">{organization.name}</h2></div>
                      <div className="text-right"><p className="text-2xl font-semibold text-[var(--bokmoo-ink)]">{money(organizationCommissions)}</p><p className="text-xs text-[var(--bokmoo-copy-soft)]">{organization.commissionRate}% organization rate</p></div>
                    </div>
                    <form onSubmit={async (event) => { event.preventDefault(); setLoading(true); setError(''); try { await addBokmooAffiliateMember(api, organization.id, { email: memberEmail, role: memberRole }); setMemberEmail(''); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Member could not be added'); } finally { setLoading(false); } }} className="mt-7 flex flex-col gap-3 sm:flex-row">
                      <input type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder="Member email" required className="h-11 min-w-0 flex-1 border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" />
                      <select value={memberRole} onChange={(event) => setMemberRole(event.target.value as 'INFLUENCER' | 'MANAGER')} className="h-11 border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-3 text-sm text-[var(--bokmoo-ink)]"><option value="INFLUENCER">Influencer</option><option value="MANAGER">Manager</option></select>
                      <button className="inline-flex h-11 items-center justify-center gap-2 bg-[var(--bokmoo-gold)] px-5 text-sm font-semibold text-[var(--bokmoo-bg)]" type="submit"><UserPlus className="h-4 w-4" />Add</button>
                    </form>
                    <div className="mt-7 divide-y divide-[var(--bokmoo-line)] border-y border-[var(--bokmoo-line)]">
                      {organization.members.map((member) => <div key={member.id} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--bokmoo-ink)]">{member.username || member.email}</p><p className="mt-1 truncate text-xs text-[var(--bokmoo-copy-soft)]">{member.email}</p></div><span className="text-xs font-semibold text-[var(--bokmoo-gold)]">{member.role}</span></div>)}
                    </div>
                  </div>
                ) : (
                  <form onSubmit={async (event) => { event.preventDefault(); setLoading(true); setError(''); try { await createBokmooAffiliateOrganization(api, { name: organizationName, commissionRate: Number(organizationRate) }); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Organization could not be created'); } finally { setLoading(false); } }} className="mt-10 grid max-w-xl gap-4 border-y border-[var(--bokmoo-line)] py-7">
                    <input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="Organization name" required className="h-12 border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" />
                    <label className="flex items-center gap-4"><span className="text-sm text-[var(--bokmoo-copy)]">Commission rate</span><input type="number" min="0" max="90" step="0.1" value={organizationRate} onChange={(event) => setOrganizationRate(event.target.value)} className="h-12 w-28 border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" /></label>
                    <button disabled={loading} className="inline-flex min-h-12 items-center justify-center gap-2 bg-[var(--bokmoo-gold)] px-5 text-sm font-semibold text-[var(--bokmoo-bg)] disabled:opacity-50" type="submit"><Plus className="h-4 w-4" />Create organization</button>
                  </form>
                )}
              </div>
              <CommissionList items={organizationCommissions} title="Organization commissions" />
            </div>
          </section>
        )}
      </div>
    </main>
  );
});

function CommissionList({ items, title }: { items: BokmooAffiliateCommission[]; title: string }) {
  return <aside className="border-l border-[var(--bokmoo-line)] pl-0 lg:pl-8"><div className="flex items-center gap-3"><Link2 className="h-4 w-4 text-[var(--bokmoo-gold)]" /><h2 className="text-sm font-semibold text-[var(--bokmoo-ink)]">{title}</h2></div><div className="mt-5 divide-y divide-[var(--bokmoo-line)] border-y border-[var(--bokmoo-line)]">{items.length ? items.map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto] gap-4 py-4"><div className="min-w-0"><p className="truncate text-sm text-[var(--bokmoo-ink)]">{orderId(item)}</p><p className="mt-1 text-xs text-[var(--bokmoo-copy-soft)]">{createdAt(item) ? new Date(createdAt(item)).toLocaleDateString() : item.status}</p></div><div className="text-right"><p className="text-sm font-semibold text-[var(--bokmoo-ink)]">{item.currency} {Number(item.amount).toFixed(2)}</p><p className="mt-1 text-xs uppercase text-[var(--bokmoo-copy-soft)]">{item.status}</p></div></div>) : <div className="py-10 text-center"><UsersRound className="mx-auto h-5 w-5 text-[var(--bokmoo-copy-soft)]" /><p className="mt-3 text-sm text-[var(--bokmoo-copy-soft)]">No commissions yet</p></div>}</div></aside>;
}
