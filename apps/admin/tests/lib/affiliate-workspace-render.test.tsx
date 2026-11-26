import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { AffiliateNativeWorkspace } from '@/components/plugins/AffiliateNativeWorkspace';
import type { AffiliateNativeOverviewData } from '@/lib/hooks/use-api';

// The affiliate workspace renders what the core's overview answers — pending applications, partners with the
// products their code applies to, organizations — without throwing. Rendered on the server: the component body
// runs with its hooks, the mutations and queries only arm themselves.

const data: AffiliateNativeOverviewData = {
  totals: { partnerCount: 2, organizationCount: 1, applicationPending: 1, commissionCount: 1, commissionTotal: 3.5, commissionPending: 3.5 },
  applications: [
    {
      id: 'app-1', organization_name: 'Travel Crew', contact_name: 'Sam', email: 'sam@example.com', phone: '+86 138 0000 0000',
      website: 'https://travelcrew.example', message: 'We run a travel channel.', status: 'pending', created_at: '2026-11-27T02:00:00.000Z', username: 'sam',
    },
    {
      id: 'app-2', organization_name: 'Crew A', contact_name: 'Kim', email: 'kim@example.com', status: 'rejected',
      review_note: 'Not a fit yet', reviewed_at: '2026-11-26T03:00:00.000Z', created_at: '2026-11-26T02:00:00.000Z',
    },
  ],
  partners: [
    { id: 'p-1', code: 'CREATOR10', status: 'active', display_name: 'Sam', commission_rate: 10, discount_rate: 10, discount_type: 'percentage', currency: 'USD', scope_mode: 'selected', scope_product_ids: ['odoo-product-6'], commission_total: 3.5, commission_count: 1 },
    { id: 'p-2', code: 'OTHER20', status: 'active', display_name: 'Kim', commission_rate: 8, discount_rate: 0, discount_type: 'percentage', currency: 'USD', scope_mode: 'all', scope_product_ids: [] },
  ],
  organizations: [
    { id: 'org-1', code: 'ORG-1A2B3C4D', name: 'Crew', status: 'active', commission_rate: 2.5, member_count: 2, owner_email: 'kim@example.com' },
  ],
  commissions: [{ id: 'c-1', partner_code: 'CREATOR10', order_id: 'ord-1', amount: 3.5, commission_rate: 10, currency: 'USD', status: 'pending' }],
  attributions: [],
};

describe('the affiliate workspace', () => {
  it('renders applications, partners with their scope, and organizations', () => {
    const html = renderToString(
      <QueryClientProvider client={new QueryClient()}>
        <AffiliateNativeWorkspace data={data} />
      </QueryClientProvider>,
    );
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    // the application waiting for the store's answer, and the one it declined with its reason
    for (const expected of ['Applications', '1 waiting', 'Travel Crew', 'sam@example.com', 'travelcrew.example', 'Approve', 'Decline', 'Crew A', 'Not a fit yet']) {
      expect(text, expected).toContain(expected);
    }
    // what each code applies to, and the way to change it
    expect(text).toContain('Only 1 picked');
    expect(text).toContain('All products');
    // closed until the store opens it
    expect(text.match(/Change/g)?.length).toBe(2);
    expect(text).not.toContain('What the promo code applies to');
    // the organization and the form that opens one
    for (const expected of ['Crew', 'kim@example.com', 'Create organization', 'Owner (account id or e-mail)']) expect(text, expected).toContain(expected);
    expect(text).toContain('Applications waiting');
  });

  it('renders an empty workspace', () => {
    const text = renderToString(
      <QueryClientProvider client={new QueryClient()}>
        <AffiliateNativeWorkspace data={{}} />
      </QueryClientProvider>,
    ).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    for (const expected of ['No applications yet.', 'No partners yet.', 'No organizations yet.', 'No commissions yet.', 'No attributions yet.']) {
      expect(text, expected).toContain(expected);
    }
  });
});
