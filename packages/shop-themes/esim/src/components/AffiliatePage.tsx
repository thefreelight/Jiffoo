import React from 'react';
import { ArrowLeft, Check, Copy, Link2, Plus, RefreshCw, UserPlus, UsersRound, WalletCards } from 'lucide-react';
import type { AffiliatePageProps } from 'shared/src/types/theme';
import { formatOrderDate } from '../lib/esim/order-copy';
import { pickCopy, type ThemeCopy } from '../site';
import {
  addEsimAffiliateMember,
  EsimApiError,
  createEsimAffiliateOrganization,
  getEsimAffiliateCommissions,
  getEsimAffiliateOrganization,
  getEsimAffiliatePartner,
  getEsimOrganizationCommissions,
  registerEsimAffiliatePartner,
  type EsimAffiliateCommission,
  type EsimAffiliateOrganization,
  type EsimAffiliatePartner,
} from '../lib/api';
import { resolveEsimSiteConfig } from '../site';

type View = 'partner' | 'organization';

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
  const site = resolveEsimSiteConfig(config, locale);
  const api = React.useMemo(() => ({ baseUrl: site.apiBaseUrl }), [site.apiBaseUrl]);
  const [view, setView] = React.useState<View>('partner');
  const [partner, setPartner] = React.useState<EsimAffiliatePartner | null>(null);
  const [commissions, setCommissions] = React.useState<EsimAffiliateCommission[]>([]);
  const [organization, setOrganization] = React.useState<EsimAffiliateOrganization | null>(null);
  const [organizationCommissions, setOrganizationCommissions] = React.useState<EsimAffiliateCommission[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const [displayName, setDisplayName] = React.useState('');
  const [organizationCode, setOrganizationCode] = React.useState('');
  const [organizationName, setOrganizationName] = React.useState('');
  const [organizationRate, setOrganizationRate] = React.useState('2.5');
  const [memberEmail, setMemberEmail] = React.useState('');
  const [memberRole, setMemberRole] = React.useState<'INFLUENCER' | 'MANAGER'>('INFLUENCER');

  const t = (copy: ThemeCopy) => pickCopy(locale, copy);

  const refresh = React.useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError('');
    const [partnerResult, organizationResult] = await Promise.allSettled([
      Promise.all([getEsimAffiliatePartner(api), getEsimAffiliateCommissions(api)]),
      Promise.all([
        getEsimAffiliateOrganization(api),
        getEsimOrganizationCommissions(api).catch((cause) => {
          if (cause instanceof EsimApiError && cause.status === 404) return [];
          throw cause;
        }),
      ]),
    ]);
    if (partnerResult.status === 'fulfilled') {
      setPartner(partnerResult.value[0]);
      setCommissions(partnerResult.value[1]);
    } else if (!(partnerResult.reason instanceof EsimApiError && partnerResult.reason.status === 404)) {
      setError(partnerResult.reason instanceof Error ? partnerResult.reason.message : pickCopy(locale, { en: 'Affiliate data could not be loaded', hans: '联盟推广数据加载失败', hant: '聯盟推廣資料載入失敗' }));
    }
    if (organizationResult.status === 'fulfilled') {
      setOrganization(organizationResult.value[0]);
      setOrganizationCommissions(organizationResult.value[1]);
    } else if (!(organizationResult.reason instanceof EsimApiError && organizationResult.reason.status === 404)) {
      setError(organizationResult.reason instanceof Error ? organizationResult.reason.message : pickCopy(locale, { en: 'Organization data could not be loaded', hans: '组织数据加载失败', hant: '組織資料載入失敗' }));
    }
    setLoading(false);
  }, [api, isAuthenticated, locale]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  if (isLoading) return <div className="min-h-screen bg-[var(--esim-bg)]" />;
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--esim-bg)] px-5">
        <div className="max-w-md border-y border-[var(--esim-line)] py-10 text-center">
          <WalletCards className="mx-auto h-7 w-7 text-[var(--esim-gold)]" />
          <h1 className="mt-5 text-3xl text-[var(--esim-ink)]">{t({ en: 'Affiliate workspace', hans: '联盟推广工作台', hant: '聯盟推廣工作台' })}</h1>
          <button onClick={onNavigateToLogin} className="mt-7 min-h-11 bg-[var(--esim-gold)] px-6 text-sm font-semibold text-[var(--esim-bg)]" type="button">{t({ en: 'Sign In', hans: '登入', hant: '登入' })}</button>
        </div>
      </div>
    );
  }

  const shareUrl = partner && typeof window !== 'undefined'
    ? `${window.location.origin}/${locale || 'en'}/r/${encodeURIComponent(partner.code)}`
    : '';

  return (
    <main className="min-h-screen bg-[var(--esim-bg)] px-4 pb-20 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--esim-line)] pb-6">
          <button onClick={onNavigateBack} className="inline-flex h-10 w-10 items-center justify-center border border-[var(--esim-line)] text-[var(--esim-copy)]" aria-label={t({ en: 'Back', hans: '返回', hant: '返回' })} type="button"><ArrowLeft className="h-4 w-4" /></button>
          <div className="flex border border-[var(--esim-line)] p-1" role="tablist" aria-label={t({ en: 'Affiliate view', hans: '联盟视图', hant: '聯盟檢視' })}>
            <button onClick={() => setView('partner')} className={`min-h-9 px-4 text-xs font-semibold ${view === 'partner' ? 'bg-[var(--esim-gold)] text-[var(--esim-bg)]' : 'text-[var(--esim-copy)]'}`} type="button">{t({ en: 'Partner', hans: '个人推广', hant: '個人推廣' })}</button>
            <button onClick={() => setView('organization')} className={`min-h-9 px-4 text-xs font-semibold ${view === 'organization' ? 'bg-[var(--esim-gold)] text-[var(--esim-bg)]' : 'text-[var(--esim-copy)]'}`} type="button">{t({ en: 'Organization', hans: '组织', hant: '組織' })}</button>
          </div>
          <button onClick={() => void refresh()} className="inline-flex h-10 w-10 items-center justify-center border border-[var(--esim-line)] text-[var(--esim-copy)]" aria-label={t({ en: 'Refresh', hans: '刷新', hant: '重新整理' })} type="button"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>

        {error ? <div className="mt-5 border border-[color:color-mix(in_oklab,var(--esim-danger)_55%,transparent)] bg-[color:color-mix(in_oklab,var(--esim-danger)_10%,transparent)] px-4 py-3 text-sm text-[var(--esim-ink)]">{error}</div> : null}

        {view === 'partner' ? (
          <section className="pt-10">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--esim-copy-soft)]">{t({ en: 'Personal affiliate', hans: '个人推广', hant: '個人推廣' })}</p>
                <h1 className="mt-3 max-w-2xl text-4xl text-[var(--esim-ink)] sm:text-5xl">{t({ en: 'Your referral ledger.', hans: '你的推广佣金账本。', hant: '你的推廣佣金帳本。' })}</h1>
                {partner ? (
                  <div className="mt-10 border-y border-[var(--esim-line)] py-6">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="min-w-0 flex-1 border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] px-4 py-3 text-sm text-[var(--esim-copy)]"><span className="block truncate">{shareUrl}</span></div>
                      <button onClick={async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }} className="inline-flex min-h-11 items-center justify-center gap-2 bg-[var(--esim-gold)] px-5 text-sm font-semibold text-[var(--esim-bg)]" type="button">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? t({ en: 'Copied', hans: '已复制', hant: '已複製' }) : t({ en: 'Copy link', hans: '复制链接', hant: '複製連結' })}</button>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-x-10 gap-y-4 text-sm">
                      <span><b className="text-2xl text-[var(--esim-ink)]">{money(commissions)}</b><small className="ml-2 text-[var(--esim-copy-soft)]">{t({ en: 'Earned', hans: '累计收益', hant: '累計收益' })}</small></span>
                      <span><b className="text-2xl text-[var(--esim-ink)]">{partner.commissionRate}%</b><small className="ml-2 text-[var(--esim-copy-soft)]">{t({ en: 'Rate', hans: '佣金比例', hant: '佣金比例' })}</small></span>
                      <span><b className="text-2xl text-[var(--esim-ink)]">{commissions.length}</b><small className="ml-2 text-[var(--esim-copy-soft)]">{t({ en: 'Orders', hans: '订单', hant: '訂單' })}</small></span>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={async (event) => { event.preventDefault(); setLoading(true); setError(''); try { await registerEsimAffiliatePartner(api, { displayName, organizationCode: organizationCode || undefined }); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : t({ en: 'Registration failed', hans: '注册失败', hant: '註冊失敗' })); } finally { setLoading(false); } }} className="mt-10 grid max-w-xl gap-4 border-y border-[var(--esim-line)] py-7">
                    <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={t({ en: 'Display name', hans: '显示名称', hant: '顯示名稱' })} required className="h-12 border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] px-4 text-sm text-[var(--esim-ink)] outline-none" />
                    <input value={organizationCode} onChange={(event) => setOrganizationCode(event.target.value.toUpperCase())} placeholder={t({ en: 'Organization code (optional)', hans: '组织编码（可选）', hant: '組織編碼（選填）' })} className="h-12 border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] px-4 text-sm text-[var(--esim-ink)] outline-none" />
                    <button disabled={loading} className="min-h-12 bg-[var(--esim-gold)] px-5 text-sm font-semibold text-[var(--esim-bg)] disabled:opacity-50" type="submit">{t({ en: 'Create affiliate account', hans: '创建推广账号', hant: '建立推廣帳號' })}</button>
                  </form>
                )}
              </div>
              <CommissionList items={commissions} title={t({ en: 'Partner commissions', hans: '个人推广佣金', hant: '個人推廣佣金' })} locale={locale} />
            </div>
          </section>
        ) : (
          <section className="pt-10">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--esim-copy-soft)]">{t({ en: 'Organization affiliate', hans: '组织推广', hant: '組織推廣' })}</p>
                <h1 className="mt-3 max-w-2xl text-4xl text-[var(--esim-ink)] sm:text-5xl">{t({ en: 'Creator network.', hans: '创作者网络。', hant: '創作者網絡。' })}</h1>
                {organization ? (
                  <div className="mt-9">
                    <div className="flex flex-wrap items-end justify-between gap-5 border-y border-[var(--esim-line)] py-6">
                      <div><p className="text-sm text-[var(--esim-copy-soft)]">{organization.code}</p><h2 className="mt-2 text-2xl text-[var(--esim-ink)]">{organization.name}</h2></div>
                      <div className="text-right"><p className="text-2xl font-semibold text-[var(--esim-ink)]">{money(organizationCommissions)}</p><p className="text-xs text-[var(--esim-copy-soft)]">{organization.commissionRate}% {t({ en: 'organization rate', hans: '组织佣金比例', hant: '組織佣金比例' })}</p></div>
                    </div>
                    <form onSubmit={async (event) => { event.preventDefault(); setLoading(true); setError(''); try { await addEsimAffiliateMember(api, organization.id, { email: memberEmail, role: memberRole }); setMemberEmail(''); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : t({ en: 'Member could not be added', hans: '成员添加失败', hant: '成員新增失敗' })); } finally { setLoading(false); } }} className="mt-7 flex flex-col gap-3 sm:flex-row">
                      <input type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder={t({ en: 'Member email', hans: '成员邮箱', hant: '成員信箱' })} required className="h-11 min-w-0 flex-1 border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] px-4 text-sm text-[var(--esim-ink)] outline-none" />
                      <select value={memberRole} onChange={(event) => setMemberRole(event.target.value as 'INFLUENCER' | 'MANAGER')} className="h-11 border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] px-3 text-sm text-[var(--esim-ink)]"><option value="INFLUENCER">{t({ en: 'Influencer', hans: '达人', hant: '達人' })}</option><option value="MANAGER">{t({ en: 'Manager', hans: '管理员', hant: '管理員' })}</option></select>
                      <button className="inline-flex h-11 items-center justify-center gap-2 bg-[var(--esim-gold)] px-5 text-sm font-semibold text-[var(--esim-bg)]" type="submit"><UserPlus className="h-4 w-4" />{t({ en: 'Add', hans: '添加', hant: '新增' })}</button>
                    </form>
                    <div className="mt-7 divide-y divide-[var(--esim-line)] border-y border-[var(--esim-line)]">
                      {organization.members.map((member) => <div key={member.id} className="flex items-center justify-between gap-4 py-4"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--esim-ink)]">{member.username || member.email}</p><p className="mt-1 truncate text-xs text-[var(--esim-copy-soft)]">{member.email}</p></div><span className="text-xs font-semibold text-[var(--esim-gold)]">{member.role === 'MANAGER' ? t({ en: 'Manager', hans: '管理员', hant: '管理員' }) : t({ en: 'Influencer', hans: '达人', hant: '達人' })}</span></div>)}
                    </div>
                  </div>
                ) : (
                  <form onSubmit={async (event) => { event.preventDefault(); setLoading(true); setError(''); try { await createEsimAffiliateOrganization(api, { name: organizationName, commissionRate: Number(organizationRate) }); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : t({ en: 'Organization could not be created', hans: '组织创建失败', hant: '組織建立失敗' })); } finally { setLoading(false); } }} className="mt-10 grid max-w-xl gap-4 border-y border-[var(--esim-line)] py-7">
                    <input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder={t({ en: 'Organization name', hans: '组织名称', hant: '組織名稱' })} required className="h-12 border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] px-4 text-sm text-[var(--esim-ink)] outline-none" />
                    <label className="flex items-center gap-4"><span className="text-sm text-[var(--esim-copy)]">{t({ en: 'Commission rate', hans: '佣金比例', hant: '佣金比例' })}</span><input type="number" min="0" max="90" step="0.1" value={organizationRate} onChange={(event) => setOrganizationRate(event.target.value)} className="h-12 w-28 border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] px-4 text-sm text-[var(--esim-ink)] outline-none" /></label>
                    <button disabled={loading} className="inline-flex min-h-12 items-center justify-center gap-2 bg-[var(--esim-gold)] px-5 text-sm font-semibold text-[var(--esim-bg)] disabled:opacity-50" type="submit"><Plus className="h-4 w-4" />{t({ en: 'Create organization', hans: '创建组织', hant: '建立組織' })}</button>
                  </form>
                )}
              </div>
              <CommissionList items={organizationCommissions} title={t({ en: 'Organization commissions', hans: '组织佣金', hant: '組織佣金' })} locale={locale} />
            </div>
          </section>
        )}
      </div>
    </main>
  );
});

function commissionStatus(status: string, locale?: string): string {
  const copy: Record<string, ThemeCopy> = {
    pending: { en: 'Pending', hans: '待结算', hant: '待結算' },
    approved: { en: 'Approved', hans: '已批准', hant: '已批准' },
    paid: { en: 'Paid', hans: '已结算', hant: '已結算' },
    cancelled: { en: 'Cancelled', hans: '已取消', hant: '已取消' },
  };
  return copy[String(status).toLowerCase()] ? pickCopy(locale, copy[String(status).toLowerCase()]) : String(status);
}

function CommissionList({ items, title, locale }: { items: EsimAffiliateCommission[]; title: string; locale?: string }) {
  const t = (copy: ThemeCopy) => pickCopy(locale, copy);
  return <aside className="border-l border-[var(--esim-line)] pl-0 lg:pl-8"><div className="flex items-center gap-3"><Link2 className="h-4 w-4 text-[var(--esim-gold)]" /><h2 className="text-sm font-semibold text-[var(--esim-ink)]">{title}</h2></div><div className="mt-5 divide-y divide-[var(--esim-line)] border-y border-[var(--esim-line)]">{items.length ? items.map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto] gap-4 py-4"><div className="min-w-0"><p className="truncate text-sm text-[var(--esim-ink)]">{orderId(item)}</p><p className="mt-1 text-xs text-[var(--esim-copy-soft)]">{createdAt(item) ? formatOrderDate(createdAt(item), locale, false) : commissionStatus(item.status, locale)}</p></div><div className="text-right"><p className="text-sm font-semibold text-[var(--esim-ink)]">{item.currency} {Number(item.amount).toFixed(2)}</p><p className="mt-1 text-xs uppercase text-[var(--esim-copy-soft)]">{commissionStatus(item.status, locale)}</p></div></div>) : <div className="py-10 text-center"><UsersRound className="mx-auto h-5 w-5 text-[var(--esim-copy-soft)]" /><p className="mt-3 text-sm text-[var(--esim-copy-soft)]">{t({ en: 'No commissions yet', hans: '暂无佣金', hant: '暫無佣金' })}</p></div>}</div></aside>;
}
