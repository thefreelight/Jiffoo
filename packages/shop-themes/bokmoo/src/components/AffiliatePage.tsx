import React from 'react';
import { ArrowLeft, Check, Copy, Link2, Plus, RefreshCw, UserPlus, UsersRound, WalletCards } from 'lucide-react';
import type { AffiliatePageProps } from 'shared/src/types/theme';
import {
  addBokmooAffiliateMember,
  applyForBokmooAffiliateOrganization,
  BokmooApiError,
  getBokmooAffiliateApplication,
  getBokmooAffiliateCommissions,
  getBokmooAffiliateOrganization,
  getBokmooAffiliatePartner,
  getBokmooOrganizationCommissions,
  getBokmooAffiliateScreenshot,
  registerBokmooAffiliatePartner,
  uploadBokmooAffiliateScreenshot,
  type BokmooAffiliateApplication,
  type BokmooAffiliateCommission,
  type BokmooAffiliateOrganization,
  type BokmooAffiliatePartner,
} from '../lib/api';
import { AFFILIATE, affiliateErrorText, affiliateText, commissionStatusText, fill, memberRoleText, scopeText, type AffiliateCopy } from '../lib/affiliate-copy';
import { AUTH, headlineStyle, pageLocale } from '../lib/auth-copy';
import { resolveBokmooSiteConfig } from '../site';

type View = 'partner' | 'organization';

const EMPTY_APPLICATION = { organizationName: '', contactName: '', email: '', phone: '', website: '', message: '' };

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
  const lang = pageLocale(locale);
  const t = (copy: AffiliateCopy) => affiliateText(lang, copy);
  const [view, setView] = React.useState<View>('partner');
  const [partner, setPartner] = React.useState<BokmooAffiliatePartner | null>(null);
  const [commissions, setCommissions] = React.useState<BokmooAffiliateCommission[]>([]);
  const [organization, setOrganization] = React.useState<BokmooAffiliateOrganization | null>(null);
  const [organizationCommissions, setOrganizationCommissions] = React.useState<BokmooAffiliateCommission[]>([]);
  // The shopper's request to open an organization. The store answers it.
  const [application, setApplication] = React.useState<BokmooAffiliateApplication | null>(null);
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
      Promise.all([getBokmooAffiliatePartner(api), getBokmooAffiliateCommissions(api)]),
      Promise.all([
        getBokmooAffiliateOrganization(api),
        getBokmooOrganizationCommissions(api).catch((cause) => {
          if (cause instanceof BokmooApiError && cause.status === 404) return [];
          throw cause;
        }),
      ]),
      getBokmooAffiliateApplication(api),
    ]);
    if (partnerResult.status === 'fulfilled') {
      setPartner(partnerResult.value[0]);
      setCommissions(partnerResult.value[1]);
    } else if (!(partnerResult.reason instanceof BokmooApiError && (partnerResult.reason.status === 404 || partnerResult.reason.code === 'SIGN_IN_REQUIRED'))) {
      setError(partnerResult.reason instanceof BokmooApiError ? affiliateErrorText(lang, partnerResult.reason) : t(AFFILIATE.loadFailed));
    }
    if (organizationResult.status === 'fulfilled') {
      setOrganization(organizationResult.value[0]);
      setOrganizationCommissions(organizationResult.value[1]);
    } else if (!(organizationResult.reason instanceof BokmooApiError && (organizationResult.reason.status === 404 || organizationResult.reason.code === 'SIGN_IN_REQUIRED'))) {
      setError(organizationResult.reason instanceof BokmooApiError ? affiliateErrorText(lang, organizationResult.reason) : t(AFFILIATE.loadFailed));
    }
    // An older core knows no applications: the form is then shown, and its answer explains.
    if (applicationResult.status === 'fulfilled') setApplication(applicationResult.value);
    const partnerCause = partnerResult.status === 'rejected' ? partnerResult.reason : null;
    setSignInRequired(partnerCause instanceof BokmooApiError && partnerCause.status === 403 && partnerCause.code === 'SIGN_IN_REQUIRED');
    // the screenshot the account sent with an application, if they sent one
    const attached = applicationResult.status === 'fulfilled' && applicationResult.value
      ? await getBokmooAffiliateScreenshot(api).then((blob) => (blob ? URL.createObjectURL(blob) : null)).catch(() => null)
      : null;
    setScreenshotAttached(attached);
    setScreenshotSent(attached !== null);
    setLoading(false);
  }, [api, isAuthenticated, lang]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  // What the server said, in the shopper's language.
  const sayError = (cause: unknown, fallback: string) => {
    if (cause instanceof BokmooApiError) setError(affiliateErrorText(lang, cause));
    else setError(fallback);
  };

  const sendScreenshot = async (file: File | undefined) => {
    if (!file) return;
    setScreenshotError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setScreenshotError(affiliateErrorText(lang, { code: 'INVALID_FILE_TYPE' })); return; }
    if (file.size > 5 * 1024 * 1024) { setScreenshotError(affiliateErrorText(lang, { code: 'FILE_TOO_LARGE' })); return; }
    setScreenshotUploading(true);
    try {
      await uploadBokmooAffiliateScreenshot(api, file);
      setScreenshotSent(true);
      setScreenshotAttached(null);
      setScreenshotPreview(URL.createObjectURL(file));
    } catch (cause) {
      // only what has words in the shopper's language is passed on as such; anything else is the one sentence
      setScreenshotError(cause instanceof BokmooApiError && ['INVALID_FILE_TYPE', 'FILE_TOO_LARGE', 'VALIDATION_ERROR', 'SIGN_IN_REQUIRED'].includes(cause.code)
        ? affiliateErrorText(lang, cause) : t(AFFILIATE.screenshotFailed));
    } finally {
      setScreenshotUploading(false);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-[var(--bokmoo-bg)]" />;
  if (!isAuthenticated || signInRequired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bokmoo-bg)] px-5">
        <div className="max-w-md border-y border-[var(--bokmoo-line)] py-10 text-center">
          <WalletCards className="mx-auto h-7 w-7 text-[var(--bokmoo-gold)]" />
          <h1 className="mt-5 text-3xl text-[var(--bokmoo-ink)]">{t(AFFILIATE.signInTitle)}</h1>
          {signInRequired ? <p className="mt-4 max-w-sm text-sm leading-6 text-[var(--bokmoo-copy)]">{t(AFFILIATE.signInRequired)}</p> : null}
          <button onClick={onNavigateToLogin} className="mt-7 min-h-11 bg-[var(--bokmoo-gold)] px-6 text-sm font-semibold text-[var(--bokmoo-bg)]" type="button">{t(AUTH.signIn)}</button>
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
      const sent = await applyForBokmooAffiliateOrganization(api, applicationForm);
      setApplication(sent);
      setApplyAgain(false);
    } catch (cause) {
      sayError(cause, t(AFFILIATE.applyFailed));
    } finally {
      setLoading(false);
    }
  };

  const inputClassName = 'h-12 w-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none';
  const labelClassName = 'mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--bokmoo-copy-soft)]';

  return (
    <main className="min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-20 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--bokmoo-line)] pb-6">
          <button onClick={onNavigateBack} className="inline-flex h-10 w-10 items-center justify-center border border-[var(--bokmoo-line)] text-[var(--bokmoo-copy)]" aria-label={t(AFFILIATE.back)} type="button"><ArrowLeft className="h-4 w-4" /></button>
          <div className="flex border border-[var(--bokmoo-line)] p-1" role="tablist" aria-label={t(AFFILIATE.signInTitle)}>
            <button onClick={() => setView('partner')} className={`min-h-9 px-4 text-xs font-semibold ${view === 'partner' ? 'bg-[var(--bokmoo-gold)] text-[var(--bokmoo-bg)]' : 'text-[var(--bokmoo-copy)]'}`} type="button">{t(AFFILIATE.tabPartner)}</button>
            <button onClick={() => setView('organization')} className={`min-h-9 px-4 text-xs font-semibold ${view === 'organization' ? 'bg-[var(--bokmoo-gold)] text-[var(--bokmoo-bg)]' : 'text-[var(--bokmoo-copy)]'}`} type="button">{t(AFFILIATE.tabOrganization)}</button>
          </div>
          <button onClick={() => void refresh()} className="inline-flex h-10 w-10 items-center justify-center border border-[var(--bokmoo-line)] text-[var(--bokmoo-copy)]" aria-label={t(AFFILIATE.refresh)} type="button"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>

        {error ? <div role="alert" className="mt-5 border border-[color:color-mix(in_oklab,var(--bokmoo-danger)_55%,transparent)] bg-[color:color-mix(in_oklab,var(--bokmoo-danger)_10%,transparent)] px-4 py-3 text-sm text-[var(--bokmoo-ink)]">{error}</div> : null}

        {view === 'partner' ? (
          <section className="pt-10">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--bokmoo-copy-soft)]">{t(AFFILIATE.partnerEyebrow)}</p>
                <h1 className="mt-3 max-w-2xl text-4xl text-[var(--bokmoo-ink)] sm:text-5xl" style={headlineStyle(lang)}>{t(AFFILIATE.partnerTitle)}</h1>
                {partner ? (
                  <div className="mt-10 border-y border-[var(--bokmoo-line)] py-6">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="min-w-0 flex-1 border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 py-3 text-sm text-[var(--bokmoo-copy)]"><span className="block truncate">{shareUrl}</span></div>
                      <button onClick={async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }} className="inline-flex min-h-11 items-center justify-center gap-2 bg-[var(--bokmoo-gold)] px-5 text-sm font-semibold text-[var(--bokmoo-bg)]" type="button">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? t(AFFILIATE.copied) : t(AFFILIATE.copyLink)}</button>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-x-10 gap-y-4 text-sm">
                      <span><b className="text-2xl text-[var(--bokmoo-ink)]">{money(commissions)}</b><small className="ml-2 text-[var(--bokmoo-copy-soft)]">{t(AFFILIATE.earned)}</small></span>
                      <span><b className="text-2xl text-[var(--bokmoo-ink)]">{partner.commissionRate}%</b><small className="ml-2 text-[var(--bokmoo-copy-soft)]">{t(AFFILIATE.rate)}</small></span>
                      <span><b className="text-2xl text-[var(--bokmoo-ink)]">{commissions.length}</b><small className="ml-2 text-[var(--bokmoo-copy-soft)]">{t(AFFILIATE.orders)}</small></span>
                    </div>
                    {/* which products the store let this code reach */}
                    <p data-purpose="partner-scope" className="mt-5 text-sm text-[var(--bokmoo-copy-soft)]">{scopeText(lang, partner)}</p>
                  </div>
                ) : (
                  <form data-purpose="affiliate-register-form" onSubmit={async (event) => { event.preventDefault(); setLoading(true); setError(''); try { await registerBokmooAffiliatePartner(api, { displayName, organizationCode: organizationCode || undefined }); await refresh(); } catch (cause) { sayError(cause, t(AFFILIATE.registerFailed)); } finally { setLoading(false); } }} className="mt-10 grid max-w-xl gap-4 border-y border-[var(--bokmoo-line)] py-7">
                    <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={t(AFFILIATE.displayName)} aria-label={t(AFFILIATE.displayName)} required className={inputClassName} />
                    <input value={organizationCode} onChange={(event) => setOrganizationCode(event.target.value.toUpperCase())} placeholder={t(AFFILIATE.organizationCode)} aria-label={t(AFFILIATE.organizationCode)} className={inputClassName} />
                    <button disabled={loading} className="min-h-12 bg-[var(--bokmoo-gold)] px-5 text-sm font-semibold text-[var(--bokmoo-bg)] disabled:opacity-50" type="submit">{t(AFFILIATE.createAccount)}</button>
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
                <p className="text-xs font-semibold uppercase text-[var(--bokmoo-copy-soft)]">{t(AFFILIATE.organizationEyebrow)}</p>
                <h1 className="mt-3 max-w-2xl text-4xl text-[var(--bokmoo-ink)] sm:text-5xl" style={headlineStyle(lang)}>{t(AFFILIATE.organizationTitle)}</h1>
                {organization ? (
                  <div data-purpose="affiliate-organization" className="mt-9">
                    <div className="flex flex-wrap items-end justify-between gap-5 border-y border-[var(--bokmoo-line)] py-6">
                      <div><p className="text-sm text-[var(--bokmoo-copy-soft)]">{organization.code}</p><h2 className="mt-2 text-2xl text-[var(--bokmoo-ink)]">{organization.name}</h2></div>
                      <div className="text-right"><p className="text-2xl font-semibold text-[var(--bokmoo-ink)]">{money(organizationCommissions)}</p><p className="text-xs text-[var(--bokmoo-copy-soft)]">{fill(t(AFFILIATE.organizationRate), { rate: organization.commissionRate })}</p></div>
                    </div>
                    <form style={organization.canManageMembers === false ? { display: 'none' } : undefined} onSubmit={async (event) => { event.preventDefault(); setLoading(true); setError(''); try { await addBokmooAffiliateMember(api, organization.id, { email: memberEmail, role: memberRole }); setMemberEmail(''); await refresh(); } catch (cause) { sayError(cause, t(AFFILIATE.memberFailed)); } finally { setLoading(false); } }} className="mt-7 flex flex-col gap-3 sm:flex-row">
                      <input type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder={t(AFFILIATE.memberEmail)} aria-label={t(AFFILIATE.memberEmail)} required className="h-11 min-w-0 flex-1 border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" />
                      <select value={memberRole} onChange={(event) => setMemberRole(event.target.value as 'INFLUENCER' | 'MANAGER')} aria-label={t(AFFILIATE.members)} className="h-11 border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-3 text-sm text-[var(--bokmoo-ink)]"><option value="INFLUENCER">{t(AFFILIATE.roleInfluencer)}</option><option value="MANAGER">{t(AFFILIATE.roleManager)}</option></select>
                      <button className="inline-flex h-11 items-center justify-center gap-2 bg-[var(--bokmoo-gold)] px-5 text-sm font-semibold text-[var(--bokmoo-bg)]" type="submit"><UserPlus className="h-4 w-4" />{t(AFFILIATE.addMember)}</button>
                    </form>
                    <h3 style={organization.canManageMembers === false ? { display: 'none' } : undefined} className="mt-7 text-xs font-semibold uppercase text-[var(--bokmoo-copy-soft)]">{t(AFFILIATE.members)}</h3>
                    <p data-purpose="member-of" style={organization.canManageMembers === false ? undefined : { display: 'none' }} className="mt-7 text-sm leading-6 text-[var(--bokmoo-copy)]">
                      {t(AFFILIATE.memberOf)} · {memberRoleText(lang, organization.viewerRole)}
                    </p>
                    <div className="mt-3 divide-y divide-[var(--bokmoo-line)] border-y border-[var(--bokmoo-line)]">
                      {organization.members.map((member) => <div key={member.id} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--bokmoo-ink)]">{member.username || member.email}</p><p className="mt-1 truncate text-xs text-[var(--bokmoo-copy-soft)]">{member.email}</p></div><span className="text-xs font-semibold text-[var(--bokmoo-gold)]">{memberRoleText(lang, member.role)}</span></div>)}
                    </div>
                  </div>
                ) : application && !applyAgain ? (
                  // sent, waiting for the store's answer — or answered
                  <div data-purpose="application-status" data-status={application.status} className="mt-10 border-y border-[var(--bokmoo-line)] py-8">
                    <p className="text-xs font-semibold uppercase text-[var(--bokmoo-gold)]">{t(application.status === 'rejected' ? AFFILIATE.rejectedTitle : application.status === 'approved' ? AFFILIATE.statusApproved : AFFILIATE.statusPending)}</p>
                    <h2 className="mt-3 text-2xl text-[var(--bokmoo-ink)]">{t(application.status === 'rejected' ? AFFILIATE.rejectedTitle : application.status === 'approved' ? AFFILIATE.statusApproved : AFFILIATE.pendingTitle)}</h2>
                    <p className="mt-3 text-sm text-[var(--bokmoo-copy)]">
                      {application.status === 'pending'
                        ? fill(t(AFFILIATE.pendingBody), { name: application.organizationName, email: application.email })
                        : application.status !== 'rejected'
                          ? ''
                          : application.reviewNote
                            ? fill(t(AFFILIATE.reviewNote), { note: application.reviewNote })
                            : t(AFFILIATE.rejectedBody)}
                    </p>
                    {screenshotAttached ? <img data-purpose="application-screenshot" src={screenshotAttached} alt={t(AFFILIATE.followersScreenshot)} className="mt-6 max-h-40 rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] object-contain" /> : null}
                    <dl className="mt-6 divide-y divide-[var(--bokmoo-line)] border border-[var(--bokmoo-line)]">
                      <Detail label={t(AFFILIATE.organizationName)} value={application.organizationName} />
                      <Detail label={t(AFFILIATE.contactName)} value={application.contactName} />
                      <Detail label={t(AUTH.email)} value={application.email} />
                      <Detail label={t(AFFILIATE.phone)} value={application.phone} />
                      <Detail label={t(AFFILIATE.website)} value={application.website} />
                      <Detail label={t(AFFILIATE.message)} value={application.message} />
                      {application.createdAt ? <Detail label={t(AFFILIATE.submittedAt)} value={new Date(application.createdAt).toLocaleDateString(locale)} /> : null}
                    </dl>
                    {application.status === 'rejected' ? (
                      <button onClick={() => { setApplicationForm({ ...applicationForm, organizationName: application.organizationName }); setApplyAgain(true); setError(''); }} className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 bg-[var(--bokmoo-gold)] px-5 text-sm font-semibold text-[var(--bokmoo-bg)]" type="button"><Plus className="h-4 w-4" />{t(AFFILIATE.applyAgain)}</button>
                    ) : null}
                  </div>
                ) : (
                  <form data-purpose="application-form" onSubmit={submitApplication} className="mt-10 grid max-w-xl gap-4 border-y border-[var(--bokmoo-line)] py-7">
                    <p className="text-sm leading-6 text-[var(--bokmoo-copy)]">{t(AFFILIATE.applyIntro)}</p>
                    <div>
                      <label className={labelClassName} htmlFor="bokmoo-affiliate-organization-name">{t(AFFILIATE.organizationName)}</label>
                      <input id="bokmoo-affiliate-organization-name" name="organizationName" value={applicationForm.organizationName} onChange={(event) => setApplicationForm({ ...applicationForm, organizationName: event.target.value })} required minLength={2} maxLength={120} className={inputClassName} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className={labelClassName} htmlFor="bokmoo-affiliate-contact-name">{t(AFFILIATE.contactName)}</label>
                        <input id="bokmoo-affiliate-contact-name" name="contactName" value={applicationForm.contactName} onChange={(event) => setApplicationForm({ ...applicationForm, contactName: event.target.value })} required maxLength={120} autoComplete="name" className={inputClassName} />
                      </div>
                      <div>
                        <label className={labelClassName} htmlFor="bokmoo-affiliate-email">{t(AUTH.email)}</label>
                        <input id="bokmoo-affiliate-email" name="email" type="email" value={applicationForm.email} onChange={(event) => setApplicationForm({ ...applicationForm, email: event.target.value })} required maxLength={160} autoComplete="email" className={inputClassName} />
                      </div>
                      <div>
                        <label className={labelClassName} htmlFor="bokmoo-affiliate-phone">{t(AFFILIATE.phone)}</label>
                        <input id="bokmoo-affiliate-phone" name="phone" type="tel" value={applicationForm.phone} onChange={(event) => setApplicationForm({ ...applicationForm, phone: event.target.value })} maxLength={40} autoComplete="tel" className={inputClassName} />
                      </div>
                      <div>
                        <label className={labelClassName} htmlFor="bokmoo-affiliate-website">{t(AFFILIATE.website)}</label>
                        <input id="bokmoo-affiliate-website" name="website" type="url" value={applicationForm.website} onChange={(event) => setApplicationForm({ ...applicationForm, website: event.target.value })} maxLength={200} inputMode="url" className={inputClassName} />
                      </div>
                    </div>
                    <div>
                      <label className={labelClassName} htmlFor="bokmoo-affiliate-message">{t(AFFILIATE.message)}</label>
                      <textarea id="bokmoo-affiliate-message" name="message" value={applicationForm.message} onChange={(event) => setApplicationForm({ ...applicationForm, message: event.target.value })} maxLength={1000} rows={4} className="bokmoo-affiliate-textarea w-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 py-3 text-sm text-[var(--bokmoo-ink)] outline-none" />
                    </div>
                    <div>
                      <label className={labelClassName} htmlFor="bokmoo-affiliate-screenshot">{t(AFFILIATE.followersScreenshot)}</label>
                      <p className="mb-2 text-xs leading-5 text-[var(--bokmoo-copy-soft)]">{t(AFFILIATE.followersHint)}</p>
                      <div className="flex flex-wrap items-center gap-3">
                        <input ref={screenshotInput} id="bokmoo-affiliate-screenshot" data-purpose="screenshot-input" type="file" accept="image/jpeg,image/png,image/webp" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}
                          onChange={(event) => { void sendScreenshot(event.target.files?.[0]); event.target.value = ''; }} />
                        <button type="button" disabled={screenshotUploading} onClick={() => screenshotInput.current?.click()} className="inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 text-sm font-semibold text-[var(--bokmoo-ink)] disabled:opacity-50">{screenshotSent ? t(AFFILIATE.replaceScreenshot) : t(AFFILIATE.uploadScreenshot)}</button>
                        {screenshotPreview ? <img src={screenshotPreview} alt="" className="h-12 w-20 rounded-[var(--bokmoo-radius-md)] border border-[var(--bokmoo-line)] object-cover" /> : null}
                        {screenshotSent ? <span data-purpose="screenshot-sent" className="inline-flex items-center gap-1 text-sm text-[var(--bokmoo-success)]"><Check className="h-4 w-4" />{t(AFFILIATE.screenshotAttached)}</span> : null}
                      </div>
                      {screenshotError ? <p role="alert" data-purpose="screenshot-error" className="mt-2 text-xs leading-5 text-[var(--bokmoo-danger)]">{screenshotError}</p> : null}
                    </div>
                    <button disabled={loading} className="inline-flex min-h-12 items-center justify-center gap-2 bg-[var(--bokmoo-gold)] px-5 text-sm font-semibold text-[var(--bokmoo-bg)] disabled:opacity-50" type="submit"><Plus className="h-4 w-4" />{loading ? t(AFFILIATE.submitting) : t(AFFILIATE.submitApplication)}</button>
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
      <dt className="text-[var(--bokmoo-copy-soft)]">{label}</dt>
      <dd className="min-w-0 text-right text-[var(--bokmoo-ink)]">{value}</dd>
    </div>
  );
}

function CommissionList({ items, title, lang, locale }: { items: BokmooAffiliateCommission[]; title: string; lang: string | undefined; locale?: string }) {
  return <aside className="border-l border-[var(--bokmoo-line)] pl-0 lg:pl-8"><div className="flex items-center gap-3"><Link2 className="h-4 w-4 text-[var(--bokmoo-gold)]" /><h2 className="text-sm font-semibold text-[var(--bokmoo-ink)]">{title}</h2></div><div className="mt-5 divide-y divide-[var(--bokmoo-line)] border-y border-[var(--bokmoo-line)]">{items.length ? items.map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto] gap-4 py-4"><div className="min-w-0"><p className="truncate text-sm text-[var(--bokmoo-ink)]">{orderId(item)}</p><p className="mt-1 text-xs text-[var(--bokmoo-copy-soft)]">{createdAt(item) ? new Date(createdAt(item)).toLocaleDateString(locale) : commissionStatusText(lang, item.status)}</p></div><div className="text-right"><p className="text-sm font-semibold text-[var(--bokmoo-ink)]">{item.currency} {Number(item.amount).toFixed(2)}</p><p className="mt-1 text-xs text-[var(--bokmoo-copy-soft)]">{commissionStatusText(lang, item.status)}</p></div></div>) : <div className="py-10 text-center"><UsersRound className="mx-auto h-5 w-5 text-[var(--bokmoo-copy-soft)]" /><p className="mt-3 text-sm text-[var(--bokmoo-copy-soft)]">{affiliateText(lang, AFFILIATE.noCommissions)}</p></div>}</div></aside>;
}
