/**
 * The channels the traffic report names, with the line each is read by — the
 * key it is read by, and its English — and its colour. Shared by the Traffic
 * report and the dashboard's traffic overview so the two never disagree.
 * In the order the core names them.
 */

import type { TrafficChannel } from '@/lib/api'

/** A line of a list written outside the component: the key it is read by, and its English. */
export interface DictionaryLine {
  labelKey: string
  label: string
}

export const TRAFFIC_CHANNEL_COLORS: Record<TrafficChannel, string> = {
  paid: '#f97316',
  affiliate: '#0d9488',
  ai: '#8b5cf6',
  search: '#3b82f6',
  social: '#ec4899',
  email: '#10b981',
  campaign: '#f59e0b',
  referral: '#64748b',
  direct: '#94a3b8',
}

export const TRAFFIC_CHANNEL_LINES: Array<DictionaryLine & { channel: TrafficChannel }> = [
  { channel: 'paid', labelKey: 'merchant.traffic.channelPaid', label: 'Paid' },
  { channel: 'affiliate', labelKey: 'merchant.traffic.channelAffiliate', label: 'Affiliate links' },
  { channel: 'ai', labelKey: 'merchant.traffic.channelAi', label: 'AI assistants' },
  { channel: 'search', labelKey: 'merchant.traffic.channelSearch', label: 'Organic search' },
  { channel: 'social', labelKey: 'merchant.traffic.channelSocial', label: 'Social' },
  { channel: 'email', labelKey: 'merchant.traffic.channelEmail', label: 'E-mail' },
  { channel: 'campaign', labelKey: 'merchant.traffic.channelCampaign', label: 'Tagged campaigns' },
  { channel: 'referral', labelKey: 'merchant.traffic.channelReferral', label: 'Referrals' },
  { channel: 'direct', labelKey: 'merchant.traffic.channelDirect', label: 'Direct' },
]
