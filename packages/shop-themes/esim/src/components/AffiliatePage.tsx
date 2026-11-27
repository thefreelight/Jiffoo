import React from 'react';
import { ArrowLeft, Check, Copy, Link2, Plus, RefreshCw, UserPlus, UsersRound, WalletCards } from 'lucide-react';
import type { AffiliatePageProps } from 'shared/src/types/theme';
import { formatOrderDate } from '../lib/esim/order-copy';
import {
  addEsimAffiliateMember,
  applyForEsimAffiliateOrganization,
  EsimApiError,
  getEsimAffiliateApplication,
  getEsimAffiliateCommissions,
  getEsimAffiliateOrganization,
  getEsimAffiliatePartner,
  getEsimOrganizationCommissions,
  getEsimAffiliateScreenshot,
  registerEsimAffiliatePartner,
  uploadEsimAffiliateScreenshot,
  type EsimAffiliateApplication,
  type EsimAffiliateCommission,
  type EsimAffiliateOrganization,
  type EsimAffiliatePartner,
} from '../lib/api';
import { AFFILIATE, affiliateErrorText, affiliateText, commissionStatusText, fill, headlineStyle, memberRoleText, pageLocale, scopeText, type AffiliateCopy } from '../lib/esim/affiliate-copy';
import { resolveEsimSiteConfig } from '../site';

type View = 'partner' | 'organization';

const EMPTY_APPLICATION = { organizationName: '', contactName: '', email: '', phone: '', website: '', message: '' };

function money(items: EsimAffiliateCommission[]): string {
  const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return `${items[0]?.currency || 'USD'} ${total.toFixed(2)}`;
}

function orderId(item: EsimAffiliateCommission): string {
  return item.orderId || item.order_id || '';
}

function createdAt(item: EsimAffiliateCommission): string {
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
  const site = resolveEsimSiteConfig(config, pageLocale(locale));
  const api = React.useMemo(() => ({ baseUrl: site.apiBaseUrl }), [site.apiBaseUrl]);
  const lang = pageLocale(locale);
  const t = (copy: AffiliateCopy) => affiliateText(lang, copy);
  const [view, setView] = React.useState<View>('partner');
  const [partner, setPartner] = React.useState<EsimAffiliatePartner | null>(null);
  const [commissions, setCommissions] = React.useState<EsimAffiliateCommission[]>([]);
  const [organization, setOrganization] = React.useState<EsimAffiliateOrganization | null>(null);
  const [organizationCommissions, setOrganizationCommissions] = React.useState<EsimAffiliateCommission[]>([]);
  // The shopper's request to open an organization. The store answers it.
  const [application, setApplication] = React.useState<EsimAffiliateApplication | null>(null);
  const [applicationForm, setApplicationForm] = React.useState(EMPTY_APPLICATION);
  const [applyAgain, setApplyAgain] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const [displayName, setDisplayName] = React.useState('');
  const [organizationCode, setOrganizationCode] = React.useState('');
  const [memberEmail, setMemberEmail] = React.useState('');
  const [memberRole, setMemberRole] = React.useState<'INFLUENCER' | 'MANAGER'>('INFLUENCER');
  // A guest session — checking out without an account — has no partner account: the core asks for a sign-in.
  const [signInRequired, setSignInRequired] = React.useState(false);
  // the screenshot of the follower counts that goes with an application
  const screenshotInput = React.useRef<HTMLInputElement | null>(null);
  const [screenshotSent, setScreenshotSent] = React.useState(false);
  const [screenshotUploading, setScreenshotUploading] = React.useState(false);
  const [screenshotError, setScreenshotError] = React.useState('');
  const [screenshotPreview, setScreenshotPreview] = React.useState<string | null>(null);
  const [screenshotAttached, setScreenshotAttached] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError('');
    const [partnerResult, organizationResult, applicationResult] = await Promise.allSettled([
      Promise.all([getEsimAffiliatePartner(api), getEsimAffiliateCommissions(api)]),
      Promise.all([
        getEsimAffiliateOrganization(api),
        getEsimOrganizationCommissions(api).catch((cause) => {
          if (cause instanceof EsimApiError && cause.status === 404) return [];
          throw cause;
        }),
      ]),
      getEsimAffiliateApplication(api),
    ]);
    if (partnerResult.status === 'fulfilled') {
      setPartner(partnerResult.value[0]);
      setCommissions(partnerResult.value[1]);
    } else if (!(partnerResult.reason instanceof EsimApiError && (partnerResult.reason.status === 404 || partnerResult.reason.code === 'SIGN_IN_REQUIRED'))) {
      setError(partnerResult.reason instanceof EsimApiError ? affiliateErrorText(lang, partnerResult.reason) : t(AFFILIATE.loadFailed));
    }
    if (organizationResult.status === 'fulfilled') {
      setOrganization(organizationResult.value[0]);
      setOrganizationCommissions(organizationResult.value[1]);
    } else if (!(organizationResult.reason instanceof EsimApiError && (organizationResult.reason.status === 404 || organizationResult.reason.code === 'SIGN_IN_REQUIRED'))) {
      setError(organizationResult.reason instanceof EsimApiError ? affiliateErrorText(lang, organizationResult.reason) : t(AFFILIATE.loadFailed));
    }
    // An older core knows no applications: the form is then shown, and its answer explains.
    if (applicationResult.status === 'fulfilled') setApplication(applicationResult.value);
    const partnerCause = partnerResult.status === 'rejected' ? partnerResult.reason : null;
    setSignInRequired(partnerCause instanceof EsimApiError && partnerCause.status === 403 && partnerCause.code === 'SIGN_IN_REQUIRED');
    // the screenshot the account sent, in this visit or an earlier one — it belongs to the account, not to one application
    const attached = partnerResult.status === 'fulfilled'
      ? await getEsimAffiliateScreenshot(api).then((blob) => (blob ? URL.createObjectURL(blob) : null)).catch(() => null)
      : null;
    setScreenshotAttached(attached);
    setScreenshotSent(attached !== null);
    setLoading(false);
  }, [api, isAuthenticated, lang]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  // What the server said, in the shopper's language.
  const sayError = (cause: unknown, fallback: string) => {
    if (cause instanceof EsimApiError) setError(affiliateErrorText(lang, cause));
    else setError(fallback);
  };

  const sendScreenshot = async (file: File | undefined) => {
    if (!file) return;
    setScreenshotError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setScreenshotError(affiliateErrorText(lang, { code: 'INVALID_FILE_TYPE' })); return; }
    if (file.size > 5 * 1024 * 1024) { setScreenshotError(affiliateErrorText(lang, { code: 'FILE_TOO_LARGE' })); return; }
    setScreenshotUploading(true);
    try {
      await uploadEsimAffiliateScreenshot(api, file);
      setScreenshotSent(true);
      setScreenshotAttached(null);
      setScreenshotPreview(URL.createObjectURL(file));
    } catch (cause) {
      // only what has words in the shopper's language is passed on as such; anything else is the one sentence
      setScreenshotError(cause instanceof EsimApiError && ['INVALID_FILE_TYPE', 'FILE_TOO_LARGE', 'VALIDATION_ERROR', 'SIGN_IN_REQUIRED'].includes(cause.code)
        ? affiliateErrorText(lang, cause) : t(AFFILIATE.screenshotFailed));
    } finally {
      setScreenshotUploading(false);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-[var(--esim-bg)]" />;
  if (!isAuthenticated || signInRequired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--esim-bg)] px-5">
        <div className="max-w-md border-y border-[var(--esim-line)] py-10 text-center">
          <WalletCards className="mx-auto h-7 w-7 text-[var(--esim-gold)]" />
          <h1 className="mt-5 text-3xl text-[var(--esim-ink)]">{t(AFFILIATE.signInTitle)}</h1>
          {signInRequired ? <p className="mt-4 max-w-sm text-sm leading-6 text-[var(--esim-copy)]">{t(AFFILIATE.signInRequired)}</p> : null}
          <button onClick={onNavigateToLogin} className="mt-7 min-h-11 bg-[var(--esim-gold)] px-6 text-sm font-semibold text-[var(--esim-bg)]" type="button">{t(AFFILIATE.signIn)}</button>
        </div>
      </div>
    );
  }

  const shareUrl = partner && typeof window !== 'undefined'
    ? `${window.location.origin}/${locale || 'en'}/r/${encodeURIComponent(partner.code)}`
    : '';

  const submitApplication = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const sent = await applyForEsimAffiliateOrganization(api, applicationForm);
      setApplication(sent);
      setApplyAgain(false);
      // the screenshot chosen just now stands on the waiting card at once, without a reload
      if (screenshotPreview) setScreenshotAttached(screenshotPreview);
    } catch (cause) {
      sayError(cause, t(AFFILIATE.applyFailed));
    } finally {
      setLoading(false);
    }
  };

  const inputClassName = 'h-12 w-full border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] px-4 text-sm text-[var(--esim-ink)] outline-none';
  const labelClassName = 'mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--esim-copy-soft)]';

  return (
    <main className="min-h-screen bg-[var(--esim-bg)] px-4 pb-20 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--esim-line)] pb-6">
          <button onClick={onNavigateBack} className="inline-flex h-10 w-10 items-center justify-center border border-[var(--esim-line)] text-[var(--esim-copy)]" aria-label={t(AFFILIATE.back)} type="button"><ArrowLeft className="h-4 w-4" /></button>
          <div className="flex border border-[var(--esim-line)] p-1" role="tablist" aria-label={t(AFFILIATE.signInTitle)}>
            <button onClick={() => setView('partner')} className={`min-h-9 px-4 text-xs font-semibold ${view === 'partner' ? 'bg-[var(--esim-gold)] text-[var(--esim-bg)]' : 'text-[var(--esim-copy)]'}`} type="button">{t(AFFILIATE.tabPartner)}</button>
            <button onClick={() => setView('organization')} className={`min-h-9 px-4 text-xs font-semibold ${view === 'organization' ? 'bg-[var(--esim-gold)] text-[var(--esim-bg)]' : 'text-[var(--esim-copy)]'}`} type="button">{t(AFFILIATE.tabOrganization)}</button>
          </div>
          <button onClick={() => void refresh()} className="inline-flex h-10 w-10 items-center justify-center border border-[var(--esim-line)] text-[var(--esim-copy)]" aria-label={t(AFFILIATE.refresh)} type="button"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>

        {error ? <div role="alert" className="mt-5 border border-[color:color-mix(in_oklab,var(--esim-danger)_55%,transparent)] bg-[color:color-mix(in_oklab,var(--esim-danger)_10%,transparent)] px-4 py-3 text-sm text-[var(--esim-ink)]">{error}</div> : null}

        {view === 'partner' ? (
          <section className="pt-10">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--esim-copy-soft)]">{t(AFFILIATE.partnerEyebrow)}</p>
                <h1 className="mt-3 max-w-2xl text-4xl text-[var(--esim-ink)] sm:text-5xl" style={headlineStyle(lang)}>{t(AFFILIATE.partnerTitle)}</h1>
                {partner ? (
                  <div className="mt-10 border-y border-[var(--esim-line)] py-6">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="min-w-0 flex-1 border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] px-4 py-3 text-sm text-[var(--esim-copy)]"><span className="block truncate">{shareUrl}</span></div>
                      <button onClick={async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }} className="inline-flex min-h-11 items-center justify-center gap-2 bg-[var(--esim-gold)] px-5 text-sm font-semibold text-[var(--esim-bg)]" type="button">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? t(AFFILIATE.copied) : t(AFFILIATE.copyLink)}</button>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-x-10 gap-y-4 text-sm">
                      <span><b className="text-2xl text-[var(--esim-ink)]">{money(commissions)}</b><small className="ml-2 text-[var(--esim-copy-soft)]">{t(AFFILIATE.earned)}</small></span>
                      <span><b className="text-2xl text-[var(--esim-ink)]">{partner.commissionRate}%</b><small className="ml-2 text-[var(--esim-copy-soft)]">{t(AFFILIATE.rate)}</small></span>
                      <span><b className="text-2xl text-[var(--esim-ink)]">{commissions.length}</b><small className="ml-2 text-[var(--esim-copy-soft)]">{t(AFFILIATE.orders)}</small></span>
                    </div>
                    {/* which products the store let this code reach */}
                    <p data-purpose="partner-scope" className="mt-5 text-sm text-[var(--esim-copy-soft)]">{scopeText(lang, partner)}</p>
                  </div>
                ) : (
                  <form data-purpose="affiliate-register-form" onSubmit={async (event) => { event.preventDefault(); setLoading(true); setError(''); try { await registerEsimAffiliatePartner(api, { displayName, organizationCode: organizationCode || undefined }); await refresh(); } catch (cause) { sayError(cause, t(AFFILIATE.registerFailed)); } finally { setLoading(false); } }} className="mt-10 grid max-w-xl gap-4 border-y border-[var(--esim-line)] py-7">
                    <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={t(AFFILIATE.displayName)} aria-label={t(AFFILIATE.displayName)} required className={inputClassName} />
                    <input value={organizationCode} onChange={(event) => setOrganizationCode(event.target.value.toUpperCase())} placeholder={t(AFFILIATE.organizationCode)} aria-label={t(AFFILIATE.organizationCode)} className={inputClassName} />
                    <button disabled={loading} className="min-h-12 bg-[var(--esim-gold)] px-5 text-sm font-semibold text-[var(--esim-bg)] disabled:opacity-50" type="submit">{t(AFFILIATE.createAccount)}</button>
                  </form>
                )}
              </div>
              <CommissionList items={commissions} title={t(AFFILIATE.partnerCommissions)} lang={lang} locale={locale} />
            </div>
          </section>
        ) : (
          <section className="pt-10">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--esim-copy-soft)]">{t(AFFILIATE.organizationEyebrow)}</p>
                <h1 className="mt-3 max-w-2xl text-4xl text-[var(--esim-ink)] sm:text-5xl" style={headlineStyle(lang)}>{t(AFFILIATE.organizationTitle)}</h1>
                {organization ? (
                  <div data-purpose="affiliate-organization" className="mt-9">
                    <div className="flex flex-wrap items-end justify-between gap-5 border-y border-[var(--esim-line)] py-6">
                      <div><p className="text-sm text-[var(--esim-copy-soft)]">{organization.code}</p><h2 className="mt-2 text-2xl text-[var(--esim-ink)]">{organization.name}</h2></div>
                      <div className="text-right"><p className="text-2xl font-semibold text-[var(--esim-ink)]">{money(organizationCommissions)}</p><p className="text-xs text-[var(--esim-copy-soft)]">{fill(t(AFFILIATE.organizationRate), { rate: organization.commissionRate })}</p></div>
                    </div>
                    <form style={organization.canManageMembers === false ? { display: 'none' } : undefined} onSubmit={async (event) => { event.preventDefault(); setLoading(true); setError(''); try { await addEsimAffiliateMember(api, organization.id, { email: memberEmail, role: memberRole }); setMemberEmail(''); await refresh(); } catch (cause) { sayError(cause, t(AFFILIATE.memberFailed)); } finally { setLoading(false); } }} className="mt-7 flex flex-col gap-3 sm:flex-row">
                      <input type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder={t(AFFILIATE.memberEmail)} aria-label={t(AFFILIATE.memberEmail)} required className="h-11 min-w-0 flex-1 border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] px-4 text-sm text-[var(--esim-ink)] outline-none" />
                      <select value={memberRole} onChange={(event) => setMemberRole(event.target.value as 'INFLUENCER' | 'MANAGER')} aria-label={t(AFFILIATE.members)} className="h-11 border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] px-3 text-sm text-[var(--esim-ink)]"><option value="INFLUENCER">{t(AFFILIATE.roleInfluencer)}</option><option value="MANAGER">{t(AFFILIATE.roleManager)}</option></select>
                      <button className="inline-flex h-11 items-center justify-center gap-2 bg-[var(--esim-gold)] px-5 text-sm font-semibold text-[var(--esim-bg)]" type="submit"><UserPlus className="h-4 w-4" />{t(AFFILIATE.addMember)}</button>
                    </form>
                    <h3 style={organization.canManageMembers === false ? { display: 'none' } : undefined} className="mt-7 text-xs font-semibold uppercase text-[var(--esim-copy-soft)]">{t(AFFILIATE.members)}</h3>
                    <p data-purpose="member-of" style={organization.canManageMembers === false ? undefined : { display: 'none' }} className="mt-7 text-sm leading-6 text-[var(--esim-copy)]">
                      {t(AFFILIATE.memberOf)} · {memberRoleText(lang, organization.viewerRole)}
                    </p>
                    <div className="mt-3 divide-y divide-[var(--esim-line)] border-y border-[var(--esim-line)]">
                      {organization.members.map((member) => <div key={member.id} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--esim-ink)]">{member.username || member.email}</p><p className="mt-1 truncate text-xs text-[var(--esim-copy-soft)]">{member.email}</p></div><span className="text-xs font-semibold text-[var(--esim-gold)]">{memberRoleText(lang, member.role)}</span></div>)}
                    </div>
                  </div>
                ) : application && !applyAgain ? (
                  // sent, waiting for the store's answer — or answered
                  <div data-purpose="application-status" data-status={application.status} className="mt-10 border-y border-[var(--esim-line)] py-8">
                    <p className="text-xs font-semibold uppercase text-[var(--esim-gold)]">{t(application.status === 'rejected' ? AFFILIATE.rejectedTitle : application.status === 'approved' ? AFFILIATE.statusApproved : AFFILIATE.statusPending)}</p>
                    <h2 className="mt-3 text-2xl text-[var(--esim-ink)]">{t(application.status === 'rejected' ? AFFILIATE.rejectedTitle : application.status === 'approved' ? AFFILIATE.statusApproved : AFFILIATE.pendingTitle)}</h2>
                    <p className="mt-3 text-sm text-[var(--esim-copy)]">
                      {application.status === 'pending'
                        ? fill(t(AFFILIATE.pendingBody), { name: application.organizationName, email: application.email })
                        : application.status !== 'rejected'
                          ? ''
                          : application.reviewNote
                            ? fill(t(AFFILIATE.reviewNote), { note: application.reviewNote })
                            : t(AFFILIATE.rejectedBody)}
                    </p>
                    {screenshotAttached ? <img data-purpose="application-screenshot" src={screenshotAttached} alt={t(AFFILIATE.followersScreenshot)} className="mt-6 max-h-40 rounded-[var(--esim-radius-md)] border border-[var(--esim-line)] object-contain" /> : null}
                    <dl className="mt-6 divide-y divide-[var(--esim-line)] border border-[var(--esim-line)]">
                      <Detail label={t(AFFILIATE.organizationName)} value={application.organizationName} />
                      <Detail label={t(AFFILIATE.contactName)} value={application.contactName} />
                      <Detail label={t(AFFILIATE.email)} value={application.email} />
                      <Detail label={t(AFFILIATE.phone)} value={application.phone} />
                      <Detail label={t(AFFILIATE.website)} value={application.website} />
                      <Detail label={t(AFFILIATE.message)} value={application.message} />
                      {application.createdAt ? <Detail label={t(AFFILIATE.submittedAt)} value={formatOrderDate(application.createdAt, locale, false)} /> : null}
                    </dl>
                    {application.status === 'rejected' ? (
                      <button onClick={() => { setApplicationForm({ ...applicationForm, organizationName: application.organizationName }); setApplyAgain(true); setError(''); }} className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 bg-[var(--esim-gold)] px-5 text-sm font-semibold text-[var(--esim-bg)]" type="button"><Plus className="h-4 w-4" />{t(AFFILIATE.applyAgain)}</button>
                    ) : null}
                  </div>
                ) : (
                  <form data-purpose="application-form" onSubmit={submitApplication} className="mt-10 grid max-w-xl gap-4 border-y border-[var(--esim-line)] py-7">
                    <p className="text-sm leading-6 text-[var(--esim-copy)]">{t(AFFILIATE.applyIntro)}</p>
                    <div>
                      <label className={labelClassName} htmlFor="esim-affiliate-organization-name">{t(AFFILIATE.organizationName)}</label>
                      <input id="esim-affiliate-organization-name" name="organizationName" value={applicationForm.organizationName} onChange={(event) => setApplicationForm({ ...applicationForm, organizationName: event.target.value })} required minLength={2} maxLength={120} className={inputClassName} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className={labelClassName} htmlFor="esim-affiliate-contact-name">{t(AFFILIATE.contactName)}</label>
                        <input id="esim-affiliate-contact-name" name="contactName" value={applicationForm.contactName} onChange={(event) => setApplicationForm({ ...applicationForm, contactName: event.target.value })} required maxLength={120} autoComplete="name" className={inputClassName} />
                      </div>
                      <div>
                        <label className={labelClassName} htmlFor="esim-affiliate-email">{t(AFFILIATE.email)}</label>
                        <input id="esim-affiliate-email" name="email" type="email" value={applicationForm.email} onChange={(event) => setApplicationForm({ ...applicationForm, email: event.target.value })} required maxLength={160} autoComplete="email" className={inputClassName} />
                      </div>
                      <div>
                        <label className={labelClassName} htmlFor="esim-affiliate-phone">{t(AFFILIATE.phone)}</label>
                        <input id="esim-affiliate-phone" name="phone" type="tel" value={applicationForm.phone} onChange={(event) => setApplicationForm({ ...applicationForm, phone: event.target.value })} maxLength={40} autoComplete="tel" className={inputClassName} />
                      </div>
                      <div>
                        <label className={labelClassName} htmlFor="esim-affiliate-website">{t(AFFILIATE.website)}</label>
                        <input id="esim-affiliate-website" name="website" type="url" value={applicationForm.website} onChange={(event) => setApplicationForm({ ...applicationForm, website: event.target.value })} maxLength={200} inputMode="url" className={inputClassName} />
                      </div>
                    </div>
                    <div>
                      <label className={labelClassName} htmlFor="esim-affiliate-message">{t(AFFILIATE.message)}</label>
                      <textarea id="esim-affiliate-message" name="message" value={applicationForm.message} onChange={(event) => setApplicationForm({ ...applicationForm, message: event.target.value })} maxLength={1000} rows={4} className="esim-affiliate-textarea w-full border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] px-4 py-3 text-sm text-[var(--esim-ink)] outline-none" />
                    </div>
                    <div>
                      <label className={labelClassName} htmlFor="esim-affiliate-screenshot">{t(AFFILIATE.followersScreenshot)}</label>
                      <p className="mb-2 text-xs leading-5 text-[var(--esim-copy-soft)]">{t(AFFILIATE.followersHint)}</p>
                      <div className="flex flex-wrap items-center gap-3">
                        <input ref={screenshotInput} id="esim-affiliate-screenshot" data-purpose="screenshot-input" type="file" accept="image/jpeg,image/png,image/webp" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
                          onChange={(event) => { void sendScreenshot(event.target.files?.[0]); event.target.value = ''; }} />
                        <button type="button" disabled={screenshotUploading} onClick={() => screenshotInput.current?.click()} className="inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] px-4 text-sm font-semibold text-[var(--esim-ink)] disabled:opacity-50">{screenshotSent ? t(AFFILIATE.replaceScreenshot) : t(AFFILIATE.uploadScreenshot)}</button>
                        {screenshotPreview ? <img src={screenshotPreview} alt="" className="h-12 w-20 rounded-[var(--esim-radius-md)] border border-[var(--esim-line)] object-cover" /> : null}
                        {screenshotSent ? <span data-purpose="screenshot-sent" className="inline-flex items-center gap-1 text-sm text-[var(--esim-success)]"><Check className="h-4 w-4" />{t(AFFILIATE.screenshotAttached)}</span> : null}
                      </div>
                      {screenshotError ? <p role="alert" data-purpose="screenshot-error" className="mt-2 text-xs leading-5 text-[var(--esim-danger)]">{screenshotError}</p> : null}
                    </div>
                    <button disabled={loading} className="inline-flex min-h-12 items-center justify-center gap-2 bg-[var(--esim-gold)] px-5 text-sm font-semibold text-[var(--esim-bg)] disabled:opacity-50" type="submit"><Plus className="h-4 w-4" />{loading ? t(AFFILIATE.submitting) : t(AFFILIATE.submitApplication)}</button>
                  </form>
                )}
              </div>
              <CommissionList items={organizationCommissions} title={t(AFFILIATE.organizationCommissions)} lang={lang} locale={locale} />
            </div>
          </section>
        )}
      </div>
    </main>
  );
});

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 px-4 py-3 text-sm">
      <dt className="text-[var(--esim-copy-soft)]">{label}</dt>
      <dd className="min-w-0 text-right text-[var(--esim-ink)]">{value}</dd>
    </div>
  );
}

function CommissionList({ items, title, lang, locale }: { items: EsimAffiliateCommission[]; title: string; lang: string | undefined; locale?: string }) {
  return <aside className="border-l border-[var(--esim-line)] pl-0 lg:pl-8"><div className="flex items-center gap-3"><Link2 className="h-4 w-4 text-[var(--esim-gold)]" /><h2 className="text-sm font-semibold text-[var(--esim-ink)]">{title}</h2></div><div className="mt-5 divide-y divide-[var(--esim-line)] border-y border-[var(--esim-line)]">{items.length ? items.map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto] gap-4 py-4"><div className="min-w-0"><p className="truncate text-sm text-[var(--esim-ink)]">{orderId(item)}</p><p className="mt-1 text-xs text-[var(--esim-copy-soft)]">{createdAt(item) ? formatOrderDate(createdAt(item), locale, false) : commissionStatusText(lang, item.status)}</p></div><div className="text-right"><p className="text-sm font-semibold text-[var(--esim-ink)]">{item.currency} {Number(item.amount).toFixed(2)}</p><p className="mt-1 text-xs text-[var(--esim-copy-soft)]">{commissionStatusText(lang, item.status)}</p></div></div>) : <div className="py-10 text-center"><UsersRound className="mx-auto h-5 w-5 text-[var(--esim-copy-soft)]" /><p className="mt-3 text-sm text-[var(--esim-copy-soft)]">{affiliateText(lang, AFFILIATE.noCommissions)}</p></div>}</div></aside>;
}
