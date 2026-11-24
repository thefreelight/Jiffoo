'use client';

/**
 * Native affiliate workspace: partners, organizations, commissions, and
 * attributions served by the Cloudflare-native core. Each table row saves on
 * its own because every row is an independent record, not a page setting.
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useUpdateAffiliateCommissionStatus,
  useUpdateAffiliateOrganization,
  useUpdateAffiliatePartner,
  type AffiliateNativeOverviewData,
} from '@/lib/hooks/use-api';

function affiliateText(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function affiliateMoney(value: unknown, currency: unknown): string {
  const amount = Number(value || 0);
  return `${affiliateText(currency, 'USD')} ${amount.toFixed(2)}`;
}

export function AffiliateNativeWorkspace({ data }: { data: AffiliateNativeOverviewData }) {
  const partners = data.partners || [];
  const organizations = data.organizations || [];
  const commissions = data.commissions || [];
  const attributions = data.attributions || [];
  const totals = data.totals || {};

  const partnerMutation = useUpdateAffiliatePartner();
  const organizationMutation = useUpdateAffiliateOrganization();
  const commissionMutation = useUpdateAffiliateCommissionStatus();

  const [partnerEdits, setPartnerEdits] = useState<Record<string, { rate: string; status: string; code: string; discount: string }>>({});
  const [orgEdits, setOrgEdits] = useState<Record<string, { rate: string; status: string }>>({});
  const [actionError, setActionError] = useState('');

  const partnerEdit = (id: string) =>
    partnerEdits[id] || {
      rate: String(Number(partners.find((row) => row.id === id)?.commission_rate ?? 0)),
      status: String(partners.find((row) => row.id === id)?.status ?? 'active'),
      code: String(partners.find((row) => row.id === id)?.code ?? ''),
      discount: String(Number(partners.find((row) => row.id === id)?.discount_rate ?? 0)),
    };
  const orgEdit = (id: string) =>
    orgEdits[id] || {
      rate: String(Number(organizations.find((row) => row.id === id)?.commission_rate ?? 0)),
      status: String(organizations.find((row) => row.id === id)?.status ?? 'active'),
    };

  const savePartner = async (id: string) => {
    setActionError('');
    const edit = partnerEdit(id);
    try {
      await partnerMutation.mutateAsync({
        id,
        commissionRate: Number(edit.rate),
        status: edit.status,
        code: edit.code,
        discountRate: Number(edit.discount),
      });
    } catch (cause: any) {
      setActionError(cause?.message || 'Could not update the partner.');
    }
  };
  const saveOrganization = async (id: string) => {
    setActionError('');
    const edit = orgEdit(id);
    try {
      await organizationMutation.mutateAsync({ id, commissionRate: Number(edit.rate), status: edit.status });
    } catch (cause: any) {
      setActionError(cause?.message || 'Could not update the organization.');
    }
  };
  const markCommission = async (id: string, status: 'paid' | 'reversed') => {
    setActionError('');
    try {
      await commissionMutation.mutateAsync({ id, status });
    } catch (cause: any) {
      setActionError(cause?.message || 'Could not update the commission.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-5">
          <div className="rounded-2xl border border-gray-100 bg-gray-50/30 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Partners</p>
            <p className="mt-1 text-xl font-semibold">{Number(totals.partnerCount || 0)}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50/30 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Organizations</p>
            <p className="mt-1 text-xl font-semibold">{Number(totals.organizationCount || 0)}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50/30 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Commission entries</p>
            <p className="mt-1 text-xl font-semibold">{Number(totals.commissionCount || 0)}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50/30 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Commission total</p>
            <p className="mt-1 text-xl font-semibold">{affiliateMoney(totals.commissionTotal, 'USD')}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50/30 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending payout</p>
            <p className="mt-1 text-xl font-semibold">{affiliateMoney(totals.commissionPending, 'USD')}</p>
          </div>
        </div>
        {actionError ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>
        ) : null}
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold">Partners</h2>
        <p className="mt-1 text-xs text-muted-foreground">Set each partner&apos;s commission rate (%) or suspend them.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4">Promo code</th>
                <th className="py-2 pr-4">Partner</th>
                <th className="py-2 pr-4">Commissions</th>
                <th className="py-2 pr-4">Rate (%)</th>
                <th className="py-2 pr-4">Discount (%)</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => {
                const id = String(partner.id || '');
                const edit = partnerEdit(id);
                return (
                  <tr key={id} className="border-b align-middle">
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
                      <Input
                        type="number"
                        min={0}
                        max={90}
                        step="1"
                        value={edit.discount}
                        onChange={(event) =>
                          setPartnerEdits((previous) => ({ ...previous, [id]: { ...edit, discount: event.target.value } }))
                        }
                        className="h-8 w-16"
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <select
                        value={edit.status}
                        onChange={(event) =>
                          setPartnerEdits((previous) => ({ ...previous, [id]: { ...edit, status: event.target.value } }))
                        }
                        className="h-8 rounded-md border bg-background px-2 text-sm"
                      >
                        <option value="active">active</option>
                        <option value="suspended">suspended</option>
                      </select>
                    </td>
                    <td className="py-2 pr-4">
                      <Button size="sm" variant="outline" disabled={partnerMutation.isPending} onClick={() => void savePartner(id)}>
                        Save
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {partners.length === 0 ? (
                <tr><td colSpan={7} className="py-4 text-center text-muted-foreground">No partners yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold">Organizations</h2>
        <p className="mt-1 text-xs text-muted-foreground">Organization-wide commission rate and lifecycle status.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4">Code</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Members</th>
                <th className="py-2 pr-4">Rate (%)</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Actions</th>
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
                        <option value="active">active</option>
                        <option value="suspended">suspended</option>
                        <option value="closed">closed</option>
                      </select>
                    </td>
                    <td className="py-2 pr-4">
                      <Button size="sm" variant="outline" disabled={organizationMutation.isPending} onClick={() => void saveOrganization(id)}>
                        Save
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {organizations.length === 0 ? (
                <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">No organizations yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold">Commissions</h2>
        <p className="mt-1 text-xs text-muted-foreground">Mark payouts as paid, or reverse an entry.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4">Partner</th>
                <th className="py-2 pr-4">Order</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Rate</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Actions</th>
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
                    <td className="py-2 pr-4"><Badge variant="outline">{status}</Badge></td>
                    <td className="py-2 pr-4">
                      <div className="flex gap-2">
                        {status !== 'paid' ? (
                          <Button size="sm" variant="outline" disabled={commissionMutation.isPending} onClick={() => void markCommission(id, 'paid')}>
                            Mark paid
                          </Button>
                        ) : null}
                        {status !== 'reversed' ? (
                          <Button size="sm" variant="ghost" disabled={commissionMutation.isPending} onClick={() => void markCommission(id, 'reversed')}>
                            Reverse
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {commissions.length === 0 ? (
                <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">No commissions yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold">Attributions</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4">Partner</th>
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Landing</th>
                <th className="py-2 pr-4">Associated</th>
              </tr>
            </thead>
            <tbody>
              {attributions.map((attribution) => (
                <tr key={String(attribution.id || '')} className="border-b">
                  <td className="py-2 pr-4 font-mono text-xs">{String(attribution.partner_code || '—')}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{String(attribution.user_id || '—').slice(0, 12)}</td>
                  <td className="py-2 pr-4"><Badge variant="outline">{String(attribution.status || '—')}</Badge></td>
                  <td className="py-2 pr-4 max-w-[16rem] truncate text-xs">{String(attribution.landing_url || '—')}</td>
                  <td className="py-2 pr-4 text-xs">{affiliateText(attribution.associated_at)}</td>
                </tr>
              ))}
              {attributions.length === 0 ? (
                <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">No attributions yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
