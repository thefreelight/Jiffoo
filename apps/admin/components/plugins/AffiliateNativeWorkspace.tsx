'use client';

/**
 * Native affiliate workspace: partners, organizations, storefront applications,
 * commissions, and attributions served by the Cloudflare-native core. Each table
 * row saves on its own because every row is an independent record, not a page setting.
 */

import { Fragment, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useWorkspaceText } from '@/components/plugins/use-workspace-text';
import { affiliateScreenshotUrl, screenshotOutcome } from '@/lib/plugins/affiliate-admin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useAffiliateScopeProducts,
  useCreateAffiliateOrganization,
  useReviewAffiliateOrganizationApplication,
  useUpdateAffiliateCommissionStatus,
  useUpdateAffiliateOrganization,
  useUpdateAffiliatePartner,
  type AffiliateNativeApplication,
  type AffiliateNativeOverviewData,
  type AffiliateScopeMode,
} from '@/lib/hooks/use-api';
import {
  affiliateScopeMode,
  affiliateScopeSummary,
  isPhysicalProduct,
  newOrganizationPayload,
  partnerScopeChange,
  scopeProductIdsOf,
  toggleGroup,
  type AffiliateScopeProduct,
} from '@/lib/plugins/affiliate-admin';

type PartnerEdit = {
  rate: string;
  status: string;
  code: string;
  discount: string;
  discountType: string;
  scopeMode: AffiliateScopeMode;
  scopeProductIds: string[];
};
type OrgEdit = { rate: string; status: string };
type ApplicationEdit = { rate: string; note: string };

/** The organization's share of its members' sales, in percent, when the store does not choose one (the owner: 5). */
const DEFAULT_ORGANIZATION_RATE = 5;

function affiliateText(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

/** The store's words for what state a record is in; a state this screen does not know is shown as the core spells it. */
type WorkspaceText = ReturnType<typeof useWorkspaceText>;
function stateText(tf: WorkspaceText, group: 'partner' | 'application' | 'commission' | 'attribution', status: string): string {
  const words: Record<string, Record<string, string>> = {
    partner: { active: tf('affiliate.state.active', 'active'), suspended: tf('affiliate.state.suspended', 'suspended'), closed: tf('affiliate.state.closed', 'closed') },
    application: { pending: tf('affiliate.state.pending', 'pending'), approved: tf('affiliate.state.approved', 'approved'), rejected: tf('affiliate.state.rejected', 'rejected') },
    commission: { pending: tf('affiliate.state.pending', 'pending'), paid: tf('affiliate.state.paid', 'paid'), reversed: tf('affiliate.state.reversed', 'reversed') },
    attribution: { clicked: tf('affiliate.state.clicked', 'clicked'), associated: tf('affiliate.state.associated', 'associated'), converted: tf('affiliate.state.converted', 'converted') },
  };
  return words[group][status] ?? status;
}

function affiliateMoney(value: unknown, currency: unknown): string {
  const amount = Number(value || 0);
  return `${affiliateText(currency, 'USD')} ${amount.toFixed(2)}`;
}

/** "2026-11-27 08:30", in UTC, as the core records its timestamps. */
function affiliateDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 16).replace('T', ' ');
}

export function AffiliateNativeWorkspace({ data }: { data: AffiliateNativeOverviewData }) {
  const partners = data.partners || [];
  const organizations = data.organizations || [];
  const commissions = data.commissions || [];
  const attributions = data.attributions || [];
  const applications = data.applications || [];
  const pendingApplications = applications.filter((row) => row.status === 'pending');
  const reviewedApplications = applications.filter((row) => row.status !== 'pending');
  const totals = data.totals || {};

  const partnerMutation = useUpdateAffiliatePartner();
  const organizationMutation = useUpdateAffiliateOrganization();
  const commissionMutation = useUpdateAffiliateCommissionStatus();
  const createOrganizationMutation = useCreateAffiliateOrganization();
  const reviewApplicationMutation = useReviewAffiliateOrganizationApplication();
  const scopeProductsQuery = useAffiliateScopeProducts();
  const scopeProducts = scopeProductsQuery.data || [];

  const [partnerEdits, setPartnerEdits] = useState<Record<string, PartnerEdit>>({});
  const [orgEdits, setOrgEdits] = useState<Record<string, OrgEdit>>({});
  const [applicationEdits, setApplicationEdits] = useState<Record<string, ApplicationEdit>>({});
  const [newOrganization, setNewOrganization] = useState({ name: '', owner: '', rate: String(DEFAULT_ORGANIZATION_RATE) });
  const [scopeOpen, setScopeOpen] = useState<string | null>(null);
  const [scopeSearch, setScopeSearch] = useState('');
  const [actionError, setActionError] = useState('');
  const tf = useWorkspaceText();

  const partnerById = (id: string) => partners.find((row) => String(row.id) === id);
  const partnerEdit = (id: string): PartnerEdit => {
    const saved = partnerById(id);
    return partnerEdits[id] || {
      rate: String(Number(saved?.commission_rate ?? 0)),
      status: String(saved?.status ?? 'active'),
      code: String(saved?.code ?? ''),
      discount: String(Number(saved?.discount_rate ?? 0)),
      discountType: String(saved?.discount_type || 'percentage'),
      scopeMode: affiliateScopeMode(saved?.scope_mode),
      scopeProductIds: scopeProductIdsOf(saved?.scope_product_ids),
    };
  };
  const orgEdit = (id: string): OrgEdit =>
    orgEdits[id] || {
      rate: String(Number(organizations.find((row) => row.id === id)?.commission_rate ?? 0)),
      status: String(organizations.find((row) => row.id === id)?.status ?? 'active'),
    };
  const applicationEdit = (id: string): ApplicationEdit => applicationEdits[id] || { rate: String(DEFAULT_ORGANIZATION_RATE), note: '' };

  const savePartner = async (id: string) => {
    setActionError('');
    const edit = partnerEdit(id);
    const scope = partnerScopeChange(edit, partnerById(id));
    if (scope.invalid) {
      setActionError(tf('affiliate.error.pickProduct', 'Pick at least one product for a code that does not apply to everything.'));
      return;
    }
    try {
      await partnerMutation.mutateAsync({
        id,
        commissionRate: Number(edit.rate),
        status: edit.status,
        code: edit.code,
        discountRate: Number(edit.discount),
        discountType: edit.discountType,
        // the scope is sent when it changed: the core then replaces the picked products in one step
        ...(scope.scope ? { scope: scope.scope } : {}),
      });
      setScopeOpen((open) => (open === id ? null : open));
    } catch (cause: any) {
      setActionError(cause?.message || tf('affiliate.error.updatePartner', 'Could not update the partner.'));
    }
  };
  const saveOrganization = async (id: string) => {
    setActionError('');
    const edit = orgEdit(id);
    try {
      await organizationMutation.mutateAsync({ id, commissionRate: Number(edit.rate), status: edit.status });
    } catch (cause: any) {
      setActionError(cause?.message || tf('affiliate.error.updateOrganization', 'Could not update the organization.'));
    }
  };
  const markCommission = async (id: string, status: 'paid' | 'reversed') => {
    setActionError('');
    try {
      await commissionMutation.mutateAsync({ id, status });
    } catch (cause: any) {
      setActionError(cause?.message || tf('affiliate.error.updateCommission', 'Could not update the commission.'));
    }
  };
  const createOrganization = async () => {
    setActionError('');
    const request = newOrganizationPayload(newOrganization, tf);
    if ('error' in request) {
      setActionError(request.error);
      return;
    }
    try {
      await createOrganizationMutation.mutateAsync(request.payload);
      setNewOrganization({ name: '', owner: '', rate: String(DEFAULT_ORGANIZATION_RATE) });
    } catch (cause: any) {
      setActionError(cause?.message || tf('affiliate.error.createOrganization', 'Could not create the organization.'));
    }
  };
  const reviewApplication = async (id: string, decision: 'approve' | 'reject') => {
    setActionError('');
    const edit = applicationEdit(id);
    const rate = edit.rate.trim();
    // an emptied field is not a rate of zero
    if (decision === 'approve' && (!rate || !Number.isFinite(Number(rate)) || Number(rate) < 0 || Number(rate) > 90)) {
      setActionError(tf('affiliate.error.organizationRate', 'The organization rate must be between 0 and 90.'));
      return;
    }
    try {
      await reviewApplicationMutation.mutateAsync({
        id,
        decision,
        ...(decision === 'approve' ? { commissionRate: Number(rate) } : {}),
        ...(edit.note.trim() ? { note: edit.note.trim() } : {}),
      });
    } catch (cause: any) {
      setActionError(cause?.message || tf('affiliate.error.reviewApplication', 'Could not review the application.'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-2xl border border-gray-100 bg-gray-50/30 p-4">
            <p className="text-xs tracking-wide text-muted-foreground">{tf('affiliate.stat.partners', 'Partners')}</p>
            <p className="mt-1 text-xl font-semibold">{Number(totals.partnerCount || 0)}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50/30 p-4">
            <p className="text-xs tracking-wide text-muted-foreground">{tf('affiliate.stat.organizations', 'Organizations')}</p>
            <p className="mt-1 text-xl font-semibold">{Number(totals.organizationCount || 0)}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50/30 p-4">
            <p className="text-xs tracking-wide text-muted-foreground">{tf('affiliate.stat.applicationsWaiting', 'Applications waiting')}</p>
            <p className="mt-1 text-xl font-semibold">{Number(totals.applicationPending ?? pendingApplications.length)}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50/30 p-4">
            <p className="text-xs tracking-wide text-muted-foreground">{tf('affiliate.stat.commissionEntries', 'Commission entries')}</p>
            <p className="mt-1 text-xl font-semibold">{Number(totals.commissionCount || 0)}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50/30 p-4">
            <p className="text-xs tracking-wide text-muted-foreground">{tf('affiliate.stat.commissionTotal', 'Commission total')}</p>
            <p className="mt-1 text-xl font-semibold">{affiliateMoney(totals.commissionTotal, 'USD')}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50/30 p-4">
            <p className="text-xs tracking-wide text-muted-foreground">{tf('affiliate.stat.pendingPayout', 'Pending payout')}</p>
            <p className="mt-1 text-xl font-semibold">{affiliateMoney(totals.commissionPending, 'USD')}</p>
          </div>
        </div>
        {actionError ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
        ) : null}
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{tf('affiliate.applications.title', 'Applications')}</h2>
          {pendingApplications.length > 0 ? <Badge>{tf('affiliate.applications.waiting', '{count} waiting', { count: pendingApplications.length })}</Badge> : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {tf('affiliate.applications.description', 'Shoppers ask to open an organization on the storefront. Approve to open it with the applicant as its owner, or decline with a reason they will see.')}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4">{tf('affiliate.column.organization', 'Organization')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.contact', 'Contact')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.submitted', 'Submitted')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.decision', 'Decision')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {pendingApplications.map((application) => (
                <ApplicationRow
                  key={application.id}
                  application={application}
                  edit={applicationEdit(application.id)}
                  onEdit={(next) => setApplicationEdits((previous) => ({ ...previous, [application.id]: next }))}
                  busy={reviewApplicationMutation.isPending}
                  onReview={reviewApplication}
                />
              ))}
              {reviewedApplications.map((application) => (
                <tr key={application.id} className="border-b text-xs text-muted-foreground">
                  <td className="py-2 pr-4">{affiliateText(application.organization_name)}</td>
                  <td className="py-2 pr-4">{affiliateText(application.email)}</td>
                  <td className="py-2 pr-4">{affiliateDate(application.created_at)}</td>
                  <td className="py-2 pr-4">
                    <Badge variant="outline">{stateText(tf, 'application', String(application.status))}</Badge>
                    {application.review_note ? <span className="ml-2">{application.review_note}</span> : null}
                  </td>
                  <td className="py-2 pr-4">{affiliateDate(application.reviewed_at)}</td>
                </tr>
              ))}
              {applications.length === 0 ? (
                <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">{tf('affiliate.applications.empty', 'No applications yet.')}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold">{tf('affiliate.partners.title', 'Partners')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {tf('affiliate.partners.description', "Set each partner's commission rate (%), the buyer discount of their promo code (a percentage that stacks on a running promotion, or a fixed amount off), which products the code applies to, or suspend them.")}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4">{tf('affiliate.column.promoCode', 'Promo code')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.partner', 'Partner')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.commissionsCol', 'Commissions')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.ratePercent', 'Rate (%)')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.buyerDiscount', 'Buyer discount')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.appliesTo', 'Applies to')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.status', 'Status')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => {
                const id = String(partner.id || '');
                const edit = partnerEdit(id);
                return (
                  <Fragment key={id}>
                    <tr className="border-b align-middle">
                      <td className="py-2 pr-4">
                        <Input
                          value={edit.code}
                          onChange={(event) =>
                            setPartnerEdits((previous) => ({ ...previous, [id]: { ...edit, code: event.target.value.toUpperCase() } }))
                          }
                          className="h-8 w-28 font-mono text-xs"
                        />
                      </td>
                      <td className="py-2 pr-4">{String(partner.display_name || partner.email || '—')}</td>
                      <td className="py-2 pr-4">
                        {affiliateMoney(partner.commission_total, partner.currency)}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({Number(partner.commission_count || 0)})
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <Input
                          type="number"
                          min={0}
                          max={90}
                          step="0.5"
                          value={edit.rate}
                          onChange={(event) =>
                            setPartnerEdits((previous) => ({ ...previous, [id]: { ...edit, rate: event.target.value } }))
                          }
                          className="h-8 w-20"
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            max={edit.discountType === 'fixed_amount' ? 1000 : 90}
                            step="1"
                            value={edit.discount}
                            onChange={(event) =>
                              setPartnerEdits((previous) => ({ ...previous, [id]: { ...edit, discount: event.target.value } }))
                            }
                            className="h-8 w-16"
                          />
                          <select
                            aria-label={tf('affiliate.discount.typeLabel', 'Buyer discount type')}
                            value={edit.discountType}
                            onChange={(event) =>
                              setPartnerEdits((previous) => ({ ...previous, [id]: { ...edit, discountType: event.target.value } }))
                            }
                            className="h-8 rounded-md border bg-background px-1 text-sm"
                          >
                            <option value="percentage">{tf('affiliate.discount.percentOff', '% off')}</option>
                            <option value="fixed_amount">{tf('affiliate.discount.amountOff', '{currency} off', { currency: String(partner.currency || 'USD') })}</option>
                          </select>
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs">{affiliateScopeSummary(edit.scopeMode, edit.scopeProductIds, tf)}</span>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setScopeSearch(''); setScopeOpen((open) => (open === id ? null : id)); }}>
                            {scopeOpen === id ? tf('affiliate.change.close', 'Close') : tf('affiliate.change.change', 'Change')}
                          </Button>
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        <select
                          value={edit.status}
                          onChange={(event) =>
                            setPartnerEdits((previous) => ({ ...previous, [id]: { ...edit, status: event.target.value } }))
                          }
                          className="h-8 rounded-md border bg-background px-2 text-sm"
                        >
                          <option value="active">{tf('affiliate.state.active', 'active')}</option>
                          <option value="suspended">{tf('affiliate.state.suspended', 'suspended')}</option>
                        </select>
                      </td>
                      <td className="py-2 pr-4">
                        <Button size="sm" variant="outline" disabled={partnerMutation.isPending} onClick={() => void savePartner(id)}>
                          {tf('affiliate.action.save', 'Save')}
                        </Button>
                      </td>
                    </tr>
                    {scopeOpen === id ? (
                      <tr className="border-b bg-gray-50/40">
                        <td colSpan={8} className="py-3 pr-4">
                          <ScopeEditor
                            edit={edit}
                            products={scopeProducts}
                            loading={scopeProductsQuery.isLoading}
                            failed={scopeProductsQuery.isError}
                            search={scopeSearch}
                            onSearch={setScopeSearch}
                            onChange={(next) => setPartnerEdits((previous) => ({ ...previous, [id]: next }))}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
              {partners.length === 0 ? (
                <tr><td colSpan={8} className="py-4 text-center text-muted-foreground">{tf('affiliate.partners.empty', 'No partners yet.')}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold">{tf('affiliate.organizations.title', 'Organizations')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{tf('affiliate.organizations.description', 'Organization-wide commission rate and lifecycle status.')}</p>
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-2xl border border-gray-100 bg-gray-50/40 p-3">
          <label className="text-xs text-muted-foreground">
            {tf('affiliate.organizations.name', 'Name')}
            <Input value={newOrganization.name} onChange={(event) => setNewOrganization({ ...newOrganization, name: event.target.value })} placeholder={tf('affiliate.organizations.namePlaceholder', 'Organization name')} className="mt-1 h-8 w-56 text-sm" />
          </label>
          <label className="text-xs text-muted-foreground">
            {tf('affiliate.organizations.owner', 'Owner (account id or e-mail)')}
            <Input value={newOrganization.owner} onChange={(event) => setNewOrganization({ ...newOrganization, owner: event.target.value })} placeholder="owner@example.com" className="mt-1 h-8 w-64 text-sm" />
          </label>
          <label className="text-xs text-muted-foreground">
            {tf('affiliate.ratePercent', 'Rate (%)')}
            <Input type="number" min={0} max={90} step="0.5" value={newOrganization.rate} onChange={(event) => setNewOrganization({ ...newOrganization, rate: event.target.value })} className="mt-1 h-8 w-20 text-sm" />
          </label>
          <Button size="sm" disabled={createOrganizationMutation.isPending} onClick={() => void createOrganization()}>
            {tf('affiliate.organizations.create', 'Create organization')}
          </Button>
          <p className="basis-full text-xs text-muted-foreground">{tf('affiliate.organizations.ownerHint', 'The owner must already have a storefront account, and cannot belong to another organization.')}</p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4">{tf('affiliate.column.code', 'Code')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.name', 'Name')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.owner', 'Owner')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.members', 'Members')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.ratePercent', 'Rate (%)')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.status', 'Status')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((organization) => {
                const id = String(organization.id || '');
                const edit = orgEdit(id);
                return (
                  <tr key={id} className="border-b align-middle">
                    <td className="py-2 pr-4 font-mono text-xs">{String(organization.code || '—')}</td>
                    <td className="py-2 pr-4">{String(organization.name || '—')}</td>
                    <td className="py-2 pr-4 text-xs">{affiliateText(organization.owner_email || organization.owner_username)}</td>
                    <td className="py-2 pr-4">{Number(organization.member_count || 0)}</td>
                    <td className="py-2 pr-4">
                      <Input
                        type="number"
                        min={0}
                        max={90}
                        step="0.5"
                        value={edit.rate}
                        onChange={(event) =>
                          setOrgEdits((previous) => ({ ...previous, [id]: { ...edit, rate: event.target.value } }))
                        }
                        className="h-8 w-20"
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <select
                        value={edit.status}
                        onChange={(event) =>
                          setOrgEdits((previous) => ({ ...previous, [id]: { ...edit, status: event.target.value } }))
                        }
                        className="h-8 rounded-md border bg-background px-2 text-sm"
                      >
                        <option value="active">{tf('affiliate.state.active', 'active')}</option>
                        <option value="suspended">{tf('affiliate.state.suspended', 'suspended')}</option>
                        <option value="closed">{tf('affiliate.state.closed', 'closed')}</option>
                      </select>
                    </td>
                    <td className="py-2 pr-4">
                      <Button size="sm" variant="outline" disabled={organizationMutation.isPending} onClick={() => void saveOrganization(id)}>
                        {tf('affiliate.action.save', 'Save')}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {organizations.length === 0 ? (
                <tr><td colSpan={7} className="py-4 text-center text-muted-foreground">{tf('affiliate.organizations.empty', 'No organizations yet.')}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold">{tf('affiliate.commissions.title', 'Commissions')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{tf('affiliate.commissions.description', 'Mark payouts as paid, or reverse an entry.')}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4">{tf('affiliate.column.partner', 'Partner')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.order', 'Order')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.amount', 'Amount')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.rate', 'Rate')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.status', 'Status')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((commission) => {
                const id = String(commission.id || '');
                const status = String(commission.status || 'pending');
                return (
                  <tr key={id} className="border-b align-middle">
                    <td className="py-2 pr-4 font-mono text-xs">{String(commission.partner_code || '—')}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{String(commission.order_id || '—')}</td>
                    <td className="py-2 pr-4">{affiliateMoney(commission.amount, commission.currency)}</td>
                    <td className="py-2 pr-4">{Number(commission.commission_rate || 0)}%</td>
                    <td className="py-2 pr-4"><Badge variant="outline">{stateText(tf, 'commission', status)}</Badge></td>
                    <td className="py-2 pr-4">
                      <div className="flex gap-2">
                        {status !== 'paid' ? (
                          <Button size="sm" variant="outline" disabled={commissionMutation.isPending} onClick={() => void markCommission(id, 'paid')}>
                            {tf('affiliate.commissions.markPaid', 'Mark paid')}
                          </Button>
                        ) : null}
                        {status !== 'reversed' ? (
                          <Button size="sm" variant="ghost" disabled={commissionMutation.isPending} onClick={() => void markCommission(id, 'reversed')}>
                            {tf('affiliate.commissions.reverse', 'Reverse')}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {commissions.length === 0 ? (
                <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">{tf('affiliate.commissions.empty', 'No commissions yet.')}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold">{tf('affiliate.attributions.title', 'Attributions')}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4">{tf('affiliate.column.partner', 'Partner')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.user', 'User')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.status', 'Status')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.landing', 'Landing')}</th>
                <th className="py-2 pr-4">{tf('affiliate.column.associated', 'Associated')}</th>
              </tr>
            </thead>
            <tbody>
              {attributions.map((attribution) => (
                <tr key={String(attribution.id || '')} className="border-b">
                  <td className="py-2 pr-4 font-mono text-xs">{String(attribution.partner_code || '—')}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{String(attribution.user_id || '—').slice(0, 12)}</td>
                  <td className="py-2 pr-4"><Badge variant="outline">{attribution.status ? stateText(tf, 'attribution', String(attribution.status)) : '—'}</Badge></td>
                  <td className="py-2 pr-4 max-w-[16rem] truncate text-xs">{String(attribution.landing_url || '—')}</td>
                  <td className="py-2 pr-4 text-xs">{affiliateText(attribution.associated_at)}</td>
                </tr>
              ))}
              {attributions.length === 0 ? (
                <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">{tf('affiliate.attributions.empty', 'No attributions yet.')}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * The screenshot of the follower counts an applicant sent with their application, when they sent one. It is
 * read with the administrator's session, the way every other request of this workspace is.
 */
function ApplicationScreenshot({ id }: { id: string }) {
  const tf = useWorkspaceText();
  const [state, setState] = useState<{ status: 'loading' | 'none' | 'failed' | 'shown'; url: string | null }>({ status: 'loading', url: null });
  const owned = useRef<string | null>(null);
  useEffect(() => {
    let live = true;
    setState({ status: 'loading', url: null });
    const token = apiClient.getToken();
    fetch(affiliateScreenshotUrl(id), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    }).then(async (response) => {
      if (!live) return;
      const outcome = screenshotOutcome(response.status);
      if (outcome === 'none') {
        setState({ status: 'none', url: null });
        return;
      }
      if (outcome !== 'shown') throw new Error(`status ${response.status}`);
      const url = URL.createObjectURL(await response.blob());
      if (owned.current) URL.revokeObjectURL(owned.current);
      owned.current = url;
      setState({ status: 'shown', url });
    }).catch(() => {
      if (live) setState({ status: 'failed', url: null });
    });
    return () => {
      live = false;
    };
  }, [id]);
  useEffect(() => () => {
    if (owned.current) URL.revokeObjectURL(owned.current);
  }, []);
  if (state.status === 'none') return <p data-purpose="screenshot-none" className="mt-2 text-xs text-muted-foreground">{tf('affiliate.screenshot.none', 'No followers screenshot was sent.')}</p>;
  if (state.status === 'failed') return <p data-purpose="screenshot-failed" className="mt-2 text-xs text-red-700">{tf('affiliate.screenshot.failed', 'The followers screenshot could not be loaded.')}</p>;
  if (!state.url) return <p data-purpose="screenshot-loading" className="mt-2 text-xs text-muted-foreground">{tf('affiliate.screenshot.loading', 'Loading the followers screenshot…')}</p>;
  return (
    <a data-purpose="screenshot" href={state.url} target="_blank" rel="noreferrer" className="mt-2 block">
      <img src={state.url} alt={tf('affiliate.screenshot.alt', 'Followers screenshot')} className="h-20 max-w-[9rem] rounded-lg border border-gray-200 object-cover" />
      <span className="text-xs text-muted-foreground underline-offset-2 hover:underline">{tf('affiliate.screenshot.open', 'Followers screenshot — click to open it full size')}</span>
    </a>
  );
}

/** A storefront application waiting for the store's answer. */
function ApplicationRow({
  application,
  edit,
  onEdit,
  busy,
  onReview,
}: {
  application: AffiliateNativeApplication;
  edit: ApplicationEdit;
  onEdit: (next: ApplicationEdit) => void;
  busy: boolean;
  onReview: (id: string, decision: 'approve' | 'reject') => Promise<void>;
}) {
  const tf = useWorkspaceText();
  const website = typeof application.website === 'string' && /^https?:\/\//i.test(application.website) ? application.website : null;
  return (
    <tr className="border-b align-top">
      <td className="py-2 pr-4">
        <p className="font-medium">{affiliateText(application.organization_name)}</p>
        {application.message ? <p className="mt-1 max-w-xs whitespace-pre-wrap text-xs text-muted-foreground">{application.message}</p> : null}
      </td>
      <td className="py-2 pr-4 text-xs">
        <p>{affiliateText(application.contact_name)}</p>
        <p className="text-muted-foreground">{affiliateText(application.email)}</p>
        {application.phone ? <p className="text-muted-foreground">{application.phone}</p> : null}
        {website ? <a href={website} target="_blank" rel="noreferrer" className="text-muted-foreground underline-offset-2 hover:underline">{website}</a> : null}
        {application.username ? <p className="mt-1 text-muted-foreground">{tf('affiliate.applications.account', 'Account: {username}', { username: application.username })}</p> : null}
        <ApplicationScreenshot id={String(application.id)} />
      </td>
      <td className="py-2 pr-4 text-xs">{affiliateDate(application.created_at)}</td>
      <td className="py-2 pr-4">
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {tf('affiliate.applications.rateLabel', 'Organization rate (%)')}
            <Input
              type="number"
              min={0}
              max={90}
              step="0.5"
              value={edit.rate}
              onChange={(event) => onEdit({ ...edit, rate: event.target.value })}
              className="h-8 w-20"
            />
          </label>
          <Input
            value={edit.note}
            onChange={(event) => onEdit({ ...edit, note: event.target.value })}
            placeholder={tf('affiliate.applications.notePlaceholder', 'Note to the applicant (optional)')}
            className="h-8 w-60 text-xs"
          />
        </div>
      </td>
      <td className="py-2 pr-4">
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => void onReview(application.id, 'approve')}>
            {tf('affiliate.applications.approve', 'Approve')}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void onReview(application.id, 'reject')}>
            {tf('affiliate.applications.decline', 'Decline')}
          </Button>
        </div>
      </td>
    </tr>
  );
}

/** Which products a promo code applies to. `edit` changes as the admin picks; "Save" on the partner row sends it. */
function ScopeEditor({
  edit,
  products,
  loading,
  failed,
  search,
  onSearch,
  onChange,
}: {
  edit: PartnerEdit;
  products: AffiliateScopeProduct[];
  loading: boolean;
  failed: boolean;
  search: string;
  onSearch: (value: string) => void;
  onChange: (next: PartnerEdit) => void;
}) {
  const tf = useWorkspaceText();
  const limited = edit.scopeMode !== 'all';
  const needle = search.trim().toLowerCase();
  const visible = products.filter((product) => !needle || product.name.toLowerCase().includes(needle) || product.id.toLowerCase().includes(needle));
  const toggle = (id: string) => {
    const picked = edit.scopeProductIds.includes(id);
    onChange({ ...edit, scopeProductIds: picked ? edit.scopeProductIds.filter((value) => value !== id) : [...edit.scopeProductIds, id] });
  };
  const pickGroup = (match: (product: AffiliateScopeProduct) => boolean) => {
    onChange({ ...edit, scopeProductIds: toggleGroup(edit.scopeProductIds, products, match) });
  };
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          {tf('affiliate.scope.appliesTo', 'Applies to')}
          <select
            aria-label={tf('affiliate.scope.appliesToLabel', 'What the promo code applies to')}
            value={edit.scopeMode}
            onChange={(event) => onChange({ ...edit, scopeMode: event.target.value as AffiliateScopeMode })}
            className="h-8 rounded-md border bg-background px-2 text-sm"
          >
            <option value="all">{tf('affiliate.scope.modeAll', 'Every product')}</option>
            <option value="selected">{tf('affiliate.scope.modeSelected', 'Only the products picked below')}</option>
            <option value="except">{tf('affiliate.scope.modeExcept', 'Every product except the ones picked below')}</option>
          </select>
        </label>
        {limited ? (
          <>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => pickGroup(isPhysicalProduct)}>{tf('affiliate.scope.allPhysical', 'All physical cards')}</Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => pickGroup((product) => !isPhysicalProduct(product))}>{tf('affiliate.scope.allDigital', 'All eSIM plans and digital products')}</Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onChange({ ...edit, scopeProductIds: [] })}>{tf('affiliate.scope.clear', 'Clear')}</Button>
            <span className="text-xs text-muted-foreground">{tf('affiliate.scope.picked', '{count} picked', { count: edit.scopeProductIds.length })}</span>
            <Input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={tf('affiliate.scope.search', 'Search products')} className="h-8 w-48 text-xs" />
          </>
        ) : null}
      </div>
      {limited ? (
        loading ? (
          <p className="mt-3 text-xs text-muted-foreground">{tf('affiliate.scope.loading', 'Loading the catalog…')}</p>
        ) : failed ? (
          <p className="mt-3 text-xs text-red-700">{tf('affiliate.scope.failed', 'The product list could not be loaded. Reload the page and try again.')}</p>
        ) : (
          <ul className="mt-3 max-h-64 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-100">
            {visible.map((product) => {
              // a product the catalog no longer has, but the code still names, is listed so it can be unticked
              const checked = edit.scopeProductIds.includes(product.id);
              return (
                <li key={product.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50">
                    <input type="checkbox" checked={checked} onChange={() => toggle(product.id)} className="h-4 w-4" />
                    <span className="min-w-0 flex-1 truncate">{product.name}</span>
                    <span className="text-xs text-muted-foreground">{product.price !== null && product.price !== undefined ? `$${Number(product.price).toFixed(2)}` : ''}</span>
                    <Badge variant="outline" className="text-[10px]">{isPhysicalProduct(product) ? tf('affiliate.scope.physical', 'Physical') : tf('affiliate.scope.digital', 'Digital')}</Badge>
                  </label>
                </li>
              );
            })}
            {visible.length === 0 ? <li className="px-3 py-4 text-center text-xs text-muted-foreground">{tf('affiliate.scope.noMatch', 'No product matches.')}</li> : null}
          </ul>
        )
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">
        {tf('affiliate.scope.notePinned', 'A code pinned to picked products takes its discount off those products at their current price and earns on them alone.')}
        {' '}
        {tf('affiliate.scope.noteOther', 'Any other code takes nothing off, and earns nothing on, products outside what it applies to.')}
        {' '}
        {tf('affiliate.scope.noteSave', '"Save" on the partner\'s row keeps the change.')}
      </p>
    </div>
  );
}
