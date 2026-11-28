/**
 * Traffic overview: who came in the last 30 days and where from. The same
 * 30 days as the figures beside it on the dashboard; the channels by their
 * share of visits; and a door into the Traffic report, opened on the same
 * days. Shown only while the Traffic Analytics plugin is counting.
 */

'use client'

import { useMemo } from 'react'
import { SectionCard } from './section-card'
import { TRAFFIC_CHANNEL_COLORS, TRAFFIC_CHANNEL_LINES } from '@/components/traffic/traffic-channels'
import type { TrafficReport } from '@/lib/api'
import { useTrafficReport } from '@/lib/hooks/use-api'
import { useT } from 'shared/src/i18n/react'

/** The dashboard's figures are "last 30 days"; the overview keeps to the same days. */
const OVERVIEW_DAYS = 30
const SHOWN_CHANNELS = 5

export function TrafficOverviewCard() {
  const t = useT()

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const report = useTrafficReport(OVERVIEW_DAYS, null)
  const data: TrafficReport | undefined = report.data

  const channels = useMemo(() => {
    if (!data) return []
    return data.channels
      .filter((entry) => entry.visits > 0)
      .sort((a, b) => b.visits - a.visits || TRAFFIC_CHANNEL_LINES.findIndex((line) => line.channel === a.channel) - TRAFFIC_CHANNEL_LINES.findIndex((line) => line.channel === b.channel))
      .slice(0, SHOWN_CHANNELS)
  }, [data])

  // Nothing to show while the plugin is not counting, or on a core without the report.
  if (report.isError || data?.collection === 'plugin-off') return null

  const totalVisits = data?.summary.visits ?? 0
  const figures = [
    { label: getText('merchant.traffic.visitors', 'Visitors'), value: data?.summary.visitors },
    { label: getText('merchant.traffic.visits', 'Visits'), value: data?.summary.visits },
    { label: getText('merchant.traffic.views', 'Page views'), value: data?.summary.views },
  ]

  return (
    <SectionCard
      title={`${getText('merchant.traffic.overviewTitle', 'Traffic')} · ${getText('merchant.traffic.overviewLast30d', 'Last 30 days')}`}
      action={{
        label: getText('merchant.traffic.overviewOpen', 'Open the traffic report'),
        href: `/analytics/traffic?range=${OVERVIEW_DAYS}`,
      }}
    >
      <div data-testid="traffic-overview">
        <div className="grid grid-cols-3 gap-2" data-testid="traffic-overview-figures">
          {figures.map((figure) => (
            <div key={figure.label} className="rounded-xl bg-slate-50 px-3 py-2.5">
              <div className="text-xs text-slate-500">{figure.label}</div>
              <div className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">{figure.value === undefined ? '—' : figure.value.toLocaleString()}</div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <div className="text-xs font-medium text-slate-500">{getText('merchant.traffic.channels', 'Channels')}</div>
          {channels.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400" data-testid="traffic-overview-empty">
              {getText('merchant.traffic.overviewEmpty', 'No visits in the last 30 days yet.')}
            </p>
          ) : (
            <ul className="mt-2 space-y-2" data-testid="traffic-overview-channels">
              {channels.map((entry) => {
                const share = totalVisits > 0 ? entry.visits / totalVisits : 0
                const label = TRAFFIC_CHANNEL_LINES.find((line) => line.channel === entry.channel)
                return (
                  <li key={entry.channel} className="text-xs text-slate-600">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 truncate">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: TRAFFIC_CHANNEL_COLORS[entry.channel] }} />
                        {label ? getText(label.labelKey, label.label) : entry.channel}
                      </span>
                      <span className="tabular-nums text-slate-500">{`${(share * 100).toFixed(share >= 0.1 ? 0 : 1)}%`}</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${share * 100}%`, backgroundColor: TRAFFIC_CHANNEL_COLORS[entry.channel] }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </SectionCard>
  )
}
