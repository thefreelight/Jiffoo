'use client'

import { ChartColumn, Eye, Loader2, MousePointerClick, Pause, Play, RefreshCw, Route, Users } from 'lucide-react'
import { useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { useT } from 'shared/src/i18n/react'
import { PageNav } from '@/components/layout/page-nav'
import { PageShell } from '@/components/layout/page-shell'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  TRAFFIC_CHANNELS,
  type TrafficChannel,
  type TrafficRangeDays,
  type TrafficSourceRow,
} from '@/lib/api'
import { useTrafficBreakdown, useTrafficCollectionPaused, useTrafficReport } from '@/lib/hooks/use-api'

/** A line of a list written outside the component: the key it is read by, and its English. */
interface DictionaryLine {
  labelKey: string
  label: string
}

const RANGE_TABS: Array<DictionaryLine & { days: TrafficRangeDays }> = [
  { days: 7, labelKey: 'merchant.traffic.range7', label: '7 days' },
  { days: 30, labelKey: 'merchant.traffic.range30', label: '30 days' },
  { days: 90, labelKey: 'merchant.traffic.range90', label: '90 days' },
]

const SOURCE_DIMENSIONS = ['source', 'referrer', 'medium', 'campaign', 'landing', 'page', 'country', 'device'] as const
type SourceDimension = (typeof SOURCE_DIMENSIONS)[number]

const DIMENSION_LINES: Array<DictionaryLine & { dimension: SourceDimension }> = [
  { dimension: 'source', labelKey: 'merchant.traffic.dimensionSource', label: 'Source' },
  { dimension: 'referrer', labelKey: 'merchant.traffic.dimensionReferrer', label: 'Referring site' },
  { dimension: 'medium', labelKey: 'merchant.traffic.dimensionMedium', label: 'Medium' },
  { dimension: 'campaign', labelKey: 'merchant.traffic.dimensionCampaign', label: 'Campaign' },
  { dimension: 'landing', labelKey: 'merchant.traffic.dimensionLanding', label: 'Landing page' },
  { dimension: 'page', labelKey: 'merchant.traffic.dimensionPage', label: 'Page' },
  { dimension: 'country', labelKey: 'merchant.traffic.dimensionCountry', label: 'Country' },
  { dimension: 'device', labelKey: 'merchant.traffic.dimensionDevice', label: 'Device' },
]

const DEVICE_LINES: Array<DictionaryLine & { value: string }> = [
  { value: 'mobile', labelKey: 'merchant.traffic.deviceMobile', label: 'Mobile' },
  { value: 'tablet', labelKey: 'merchant.traffic.deviceTablet', label: 'Tablet' },
  { value: 'desktop', labelKey: 'merchant.traffic.deviceDesktop', label: 'Desktop' },
  { value: 'other', labelKey: 'merchant.traffic.deviceOther', label: 'Other' },
]

const CHANNEL_COLORS: Record<TrafficChannel, string> = {
  paid: '#f97316',
  ai: '#8b5cf6',
  search: '#3b82f6',
  social: '#ec4899',
  email: '#10b981',
  campaign: '#f59e0b',
  referral: '#64748b',
  direct: '#94a3b8',
}

// In the order the core names them.
const CHANNEL_LINES: Array<DictionaryLine & { channel: TrafficChannel }> = [
  { channel: 'paid', labelKey: 'merchant.traffic.channelPaid', label: 'Paid' },
  { channel: 'ai', labelKey: 'merchant.traffic.channelAi', label: 'AI assistants' },
  { channel: 'search', labelKey: 'merchant.traffic.channelSearch', label: 'Organic search' },
  { channel: 'social', labelKey: 'merchant.traffic.channelSocial', label: 'Social' },
  { channel: 'email', labelKey: 'merchant.traffic.channelEmail', label: 'E-mail' },
  { channel: 'campaign', labelKey: 'merchant.traffic.channelCampaign', label: 'Tagged campaigns' },
  { channel: 'referral', labelKey: 'merchant.traffic.channelReferral', label: 'Referrals' },
  { channel: 'direct', labelKey: 'merchant.traffic.channelDirect', label: 'Direct' },
]

const PAGE_SIZE = 10

interface TrendTooltipEntry {
  dataKey?: string | number
  value?: number | string
  payload?: { day: string }
}

function TrendTooltip({ active, payload, getText }: { active?: boolean; payload?: TrendTooltipEntry[]; getText: (key: string, fallback: string) => string }) {
  if (!active || !payload?.length) return null
  const visits = payload.find((entry) => entry.dataKey === 'visits')?.value
  const visitors = payload.find((entry) => entry.dataKey === 'visitors')?.value
  return (
    <div className="rounded-xl border border-[#eef1f6] bg-white px-4 py-3 shadow-lg">
      <p className="text-xs font-bold text-slate-900">{payload[0]?.payload?.day}</p>
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="h-2 w-2 rounded-full bg-[#3b82f6]" />
          {getText('merchant.traffic.visitsSeries', 'Visits')}
          <span className="font-bold text-slate-900">{typeof visits === 'number' ? visits.toLocaleString() : '--'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="h-2 w-2 rounded-full bg-[#8b5cf6]" />
          {getText('merchant.traffic.visitorsSeries', 'Visitors')}
          <span className="font-bold text-slate-900">{typeof visitors === 'number' ? visitors.toLocaleString() : '--'}</span>
        </div>
      </div>
    </div>
  )
}

export default function TrafficPage() {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const line = (entry: DictionaryLine): string => getText(entry.labelKey, entry.label)

  const [range, setRange] = useState<TrafficRangeDays>(7)
  const [host, setHost] = useState<string | null>(null)
  const [dimension, setDimension] = useState<SourceDimension>('source')
  const [shown, setShown] = useState(PAGE_SIZE)

  const report = useTrafficReport(range, host)
  const sources = useTrafficBreakdown(dimension, range, { host })
  const hosts = useTrafficBreakdown('host', range)
  const assistants = useTrafficBreakdown('referrer', range, { host, channel: 'ai' })
  const engines = useTrafficBreakdown('referrer', range, { host, channel: 'search' })
  const { paused, setPaused } = useTrafficCollectionPaused()

  const formatNumber = (value: number): string => value.toLocaleString()
  const formatPercent = (value: number): string => `${(value * 100).toFixed(1)}%`
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}${getText('merchant.traffic.second', 's')}`
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes}${getText('merchant.traffic.minute', 'min')}`
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return rest
      ? `${hours}${getText('merchant.traffic.hour', 'h')}${rest}${getText('merchant.traffic.minute', 'min')}`
      : `${hours}${getText('merchant.traffic.hour', 'h')}`
  }

  const data = report.data
  const totalVisits = data?.summary.visits ?? 0
  const shareOf = (visits: number): string => (totalVisits > 0 ? formatPercent(visits / totalVisits) : '0%')
  const channelFigures = (channel: TrafficChannel) =>
    data?.channels.find((entry) => entry.channel === channel) ?? { channel, visitors: 0, visits: 0, views: 0, bounceRate: 0, avgVisitSeconds: 0 }

  const hostOptions = (hosts.data?.rows ?? []) as TrafficSourceRow[]
  const sourceRows = (sources.data?.rows ?? []) as TrafficSourceRow[]
  const isPageDimension = dimension === 'page'
  const dimensionLine = DIMENSION_LINES.find((entry) => entry.dimension === dimension) ?? DIMENSION_LINES[0]!
  const displayValue = (value: string): string => {
    const device = dimension === 'device' ? DEVICE_LINES.find((entry) => entry.value === value) : undefined
    return device ? line(device) : value
  }

  const cards = data
    ? [
        { label: getText('merchant.traffic.visitors', 'Visitors'), value: formatNumber(data.summary.visitors), icon: Users, tone: 'text-purple-600' },
        { label: getText('merchant.traffic.visits', 'Visits'), value: formatNumber(data.summary.visits), icon: MousePointerClick, tone: 'text-blue-600' },
        { label: getText('merchant.traffic.views', 'Page views'), value: formatNumber(data.summary.views), icon: Eye, tone: 'text-amber-600' },
        {
          label: getText('merchant.traffic.bounceRate', 'Bounce rate'),
          value: formatPercent(data.summary.bounceRate),
          hint: `${getText('merchant.traffic.avgTime', 'Avg. visit time')} ${formatDuration(data.summary.avgVisitSeconds)}`,
          icon: Route,
          tone: 'text-green-600',
        },
      ]
    : []

  const versus = [
    {
      label: getText('merchant.traffic.seo', 'Organic search (SEO)'),
      figures: channelFigures('search'),
      color: CHANNEL_COLORS.search,
      rows: engines.data?.rows ?? [],
      rowsLabel: getText('merchant.traffic.topEngines', 'Search engines'),
    },
    {
      label: getText('merchant.traffic.geo', 'AI assistants (GEO)'),
      figures: channelFigures('ai'),
      color: CHANNEL_COLORS.ai,
      rows: assistants.data?.rows ?? [],
      rowsLabel: getText('merchant.traffic.topAssistants', 'AI assistants'),
    },
  ]

  const refresh = () => Promise.all([report.refetch(), sources.refetch(), hosts.refetch(), assistants.refetch(), engines.refetch()])
  const changeSwitch = (next: boolean) =>
    setPaused.mutate(next, {
      onError: () => toast.error(getText('merchant.traffic.switchFailed', 'The switch could not be changed. Check that you may write settings.')),
    })

  const loading = (
    <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      {getText('merchant.traffic.loading', 'Loading…')}
    </div>
  )

  return (
    <PageShell
      title={getText('merchant.traffic.title', 'Traffic')}
      description={getText('merchant.traffic.description', 'Where storefront visits come from and what they do once they arrive.')}
      actions={
        <>
          <div className="flex items-center rounded-lg border border-[#eef1f6] bg-[#f8fafc] p-0.5">
            {RANGE_TABS.map((tab) => (
              <button
                key={tab.days}
                type="button"
                onClick={() => setRange(tab.days)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  range === tab.days ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800',
                )}
              >
                {line(tab)}
              </button>
            ))}
          </div>
          {hostOptions.length > 1 ? (
            <select
              value={host ?? ''}
              onChange={(event) => setHost(event.target.value || null)}
              className="h-9 rounded-lg border border-[#eef1f6] bg-white px-3 text-xs text-slate-700"
            >
              <option value="">{getText('merchant.traffic.allHosts', 'All storefronts')}</option>
              {hostOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.value}</option>
              ))}
            </select>
          ) : null}
          {data?.collection === 'plugin-off' ? null : (
            <Button
              variant="outline"
              onClick={() => changeSwitch(!paused.data)}
              disabled={setPaused.isPending || paused.data === undefined}
              className="gap-2"
            >
              {setPaused.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : paused.data ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {paused.data ? getText('merchant.traffic.resume', 'Resume collection') : getText('merchant.traffic.pause', 'Pause collection')}
            </Button>
          )}
          <Button variant="outline" onClick={() => void refresh()} disabled={report.isFetching} className="gap-2">
            <RefreshCw className={cn('h-4 w-4', report.isFetching && 'animate-spin')} />
            {getText('merchant.traffic.refresh', 'Refresh')}
          </Button>
        </>
      }
    >
      <PageNav
        items={[
          { label: getText('merchant.nav.dashboard', 'Dashboard'), href: '/dashboard' },
          { label: getText('merchant.traffic.title', 'Traffic'), href: '/analytics/traffic', exact: true },
        ]}
      />

      <section className="py-6">
        {report.isError ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-12 text-center text-muted-foreground">
            <ChartColumn className="h-10 w-10 opacity-40" />
            <p>{getText('merchant.traffic.unavailable', 'Traffic reports are not available right now. Check that the Traffic Analytics plugin is installed and enabled.')}</p>
            <Button variant="outline" onClick={() => void refresh()}>
              {getText('merchant.traffic.refresh', 'Refresh')}
            </Button>
          </div>
        ) : !data ? (
          loading
        ) : (
          <div className="space-y-6">
            <p className="text-xs text-muted-foreground">
              {data.period.from} – {data.period.to} · {getText('merchant.traffic.privacy', 'Nothing personal is stored: no cookies, no addresses, no device identifiers. A visitor is an anonymous key that changes every month, and visitors who ask not to be tracked are not counted.')}
            </p>
            {data.collection === 'plugin-off' ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                {getText('merchant.traffic.pluginOff', 'Page views are not being counted: the Traffic Analytics plugin is not installed or enabled. Install it from the plugin market and the first visit appears here.')}
              </p>
            ) : paused.data ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                {getText('merchant.traffic.paused', 'Collection is paused: page views are not being counted. Reports keep what was already recorded.')}{' '}
                {getText('merchant.traffic.switchHint', 'A change takes up to half a minute to reach the storefront.')}
              </p>
            ) : null}

            {/* Key figures */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {cards.map((card) => (
                <div key={card.label} className="rounded-lg border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">{card.label}</span>
                    <card.icon className={cn('h-5 w-5', card.tone)} />
                  </div>
                  <p className="mt-2 text-3xl font-bold">{card.value}</p>
                  {'hint' in card && card.hint ? <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p> : null}
                </div>
              ))}
            </div>

            {totalVisits === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-12 text-center text-muted-foreground">
                <ChartColumn className="h-10 w-10 opacity-40" />
                <p>{getText('merchant.traffic.empty', 'No visits recorded in this range yet. Numbers appear as soon as someone opens the storefront.')}</p>
              </div>
            ) : (
              <>
                {/* Trend */}
                <div className="rounded-lg border bg-card p-5">
                  <h3 className="text-base font-semibold">{getText('merchant.traffic.trend', 'Visits per day')}</h3>
                  <p className="mb-4 mt-0.5 text-xs text-muted-foreground">{getText('merchant.traffic.trendHint', 'Bars are visits, the line is visitors. A visit ends after 30 minutes without a page view.')}</p>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data.daily} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
                        <XAxis dataKey="day" tickFormatter={(value: string) => value.slice(5)} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                        <Tooltip content={<TrendTooltip getText={getText} />} cursor={{ fill: 'rgba(59,130,246,0.06)' }} />
                        <Bar dataKey="visits" name={getText('merchant.traffic.visitsSeries', 'Visits')} fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={28} />
                        <Line dataKey="visitors" name={getText('merchant.traffic.visitorsSeries', 'Visitors')} stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2.5, fill: '#8b5cf6', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Search or AI */}
                <div className="rounded-lg border bg-card p-5">
                  <h3 className="text-base font-semibold">{getText('merchant.traffic.searchVsAi', 'Search or AI')}</h3>
                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {versus.map((side) => (
                      <div key={side.label} className="rounded-lg border border-[#eef1f6] p-4">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: side.color }} />
                          <span className="text-sm font-semibold">{side.label}</span>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                          <span className="text-3xl font-bold">{formatNumber(side.figures.visits)}</span>
                          <span className="text-xs text-muted-foreground">{shareOf(side.figures.visits)} {getText('merchant.traffic.ofVisits', 'of visits')}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatNumber(side.figures.visitors)} {getText('merchant.traffic.visitors', 'Visitors')} · {getText('merchant.traffic.bounceRate', 'Bounce rate')} {formatPercent(side.figures.bounceRate)} ·{' '}
                          {getText('merchant.traffic.avgTime', 'Avg. visit time')} {formatDuration(side.figures.avgVisitSeconds)}
                        </p>
                        <p className="mt-3 text-xs font-medium text-muted-foreground">{side.rowsLabel}</p>
                        <ul className="mt-1.5 space-y-1">
                          {(side.rows as TrafficSourceRow[]).slice(0, 5).map((row) => (
                            <li key={row.value} className="flex items-center justify-between gap-3 text-xs">
                              <span className="truncate text-slate-600">{row.value}</span>
                              <span className="shrink-0 tabular-nums text-slate-900">{formatNumber(row.visits)}</span>
                            </li>
                          ))}
                          {side.rows.length === 0 ? (
                            <li className="text-xs text-muted-foreground">--</li>
                          ) : null}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">{getText('merchant.traffic.aiCaveat', 'AI traffic is a floor, not a total: several assistants open links without naming themselves, so those visits are counted as direct. Clicks from Google’s AI summaries look like ordinary search.')}</p>
                </div>

                {/* Channels */}
                <div className="rounded-lg border bg-card">
                  <div className="border-b p-5">
                    <h3 className="text-base font-semibold">{getText('merchant.traffic.channels', 'Channels')}</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-4 py-3 font-medium">{getText('merchant.traffic.channels', 'Channels')}</th>
                          <th className="px-4 py-3 text-right font-medium">{getText('merchant.traffic.visitors', 'Visitors')}</th>
                          <th className="px-4 py-3 text-right font-medium">{getText('merchant.traffic.visits', 'Visits')}</th>
                          <th className="px-4 py-3 text-right font-medium">{getText('merchant.traffic.views', 'Page views')}</th>
                          <th className="px-4 py-3 text-right font-medium">{getText('merchant.traffic.share', 'Share')}</th>
                          <th className="px-4 py-3 text-right font-medium">{getText('merchant.traffic.bounceRate', 'Bounce rate')}</th>
                          <th className="px-4 py-3 text-right font-medium">{getText('merchant.traffic.avgTime', 'Avg. visit time')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {TRAFFIC_CHANNELS.map((channel) => {
                          const figures = channelFigures(channel)
                          const entry = CHANNEL_LINES.find((item) => item.channel === channel) ?? CHANNEL_LINES[0]!
                          return (
                            <tr key={channel} className="border-b last:border-b-0 hover:bg-muted/40">
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-2 font-medium">
                                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[channel] }} />
                                  {line(entry)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">{formatNumber(figures.visitors)}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{formatNumber(figures.visits)}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{formatNumber(figures.views)}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{shareOf(figures.visits)}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{formatPercent(figures.bounceRate)}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{formatDuration(figures.avgVisitSeconds)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Sources */}
                <div className="rounded-lg border bg-card">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
                    <h3 className="text-base font-semibold">{getText('merchant.traffic.sources', 'Sources')}</h3>
                    <div className="flex flex-wrap items-center rounded-lg border border-[#eef1f6] bg-[#f8fafc] p-0.5">
                      {DIMENSION_LINES.map((entry) => (
                        <button
                          key={entry.dimension}
                          type="button"
                          onClick={() => { setDimension(entry.dimension); setShown(PAGE_SIZE) }}
                          className={cn(
                            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                            dimension === entry.dimension ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800',
                          )}
                        >
                          {line(entry)}
                        </button>
                      ))}
                    </div>
                  </div>
                  {sources.isLoading ? (
                    loading
                  ) : sourceRows.length === 0 ? (
                    <p className="p-10 text-center text-sm text-muted-foreground">{getText('merchant.traffic.empty', 'No visits recorded in this range yet. Numbers appear as soon as someone opens the storefront.')}</p>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="px-4 py-3 font-medium">{line(dimensionLine)}</th>
                              <th className="px-4 py-3 text-right font-medium">{getText('merchant.traffic.visitors', 'Visitors')}</th>
                              <th className="px-4 py-3 text-right font-medium">{getText('merchant.traffic.visits', 'Visits')}</th>
                              <th className="px-4 py-3 text-right font-medium">{getText('merchant.traffic.views', 'Page views')}</th>
                              <th className="px-4 py-3 text-right font-medium">{getText('merchant.traffic.bounceRate', 'Bounce rate')}</th>
                              <th className="px-4 py-3 text-right font-medium">{getText('merchant.traffic.avgTime', 'Avg. visit time')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sourceRows.slice(0, shown).map((row) => (
                              <tr key={row.value} className="border-b last:border-b-0 hover:bg-muted/40">
                                <td className="max-w-xs px-4 py-3">
                                  <span className="inline-flex items-center gap-2">
                                    {row.channel ? (
                                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[row.channel] }} />
                                    ) : null}
                                    <span className={cn('truncate', row.value.startsWith('/') ? 'font-mono text-xs' : '')}>
                                      {displayValue(row.value)}
                                    </span>
                                  </span>
                                </td>
                                {/* Pages are counted per view; every other dimension is counted per visit. */}
                                <td className="px-4 py-3 text-right tabular-nums">{formatNumber(row.views)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{isPageDimension ? '--' : formatNumber(row.visitors)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{isPageDimension ? '--' : formatNumber(row.visits)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{isPageDimension ? '--' : formatPercent(row.bounceRate)}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{isPageDimension ? '--' : formatDuration(row.avgVisitSeconds)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {sourceRows.length > shown ? (
                        <div className="flex items-center justify-between border-t p-4 text-xs text-muted-foreground">
                          <span>
                            {shown} / {sourceRows.length}
                          </span>
                          <Button variant="ghost" size="sm" onClick={() => setShown((current) => current + PAGE_SIZE)}>
                            {getText('merchant.traffic.showMore', 'Show more')}
                          </Button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  {getText('merchant.traffic.rules', 'Channel lists')} v{data.rulesVersion}
                  {data.rulesUpdatedAt ? ` · ${new Date(data.rulesUpdatedAt).toLocaleString()}` : ` · ${getText('merchant.traffic.rulesBuiltIn', 'built-in')}`}
                </p>
              </>
            )}
          </div>
        )}
      </section>
    </PageShell>
  )
}
