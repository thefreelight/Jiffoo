'use client'

import { ChartColumn, Eye, Loader2, MousePointerClick, Pause, Play, RefreshCw, Route, Users } from 'lucide-react'
import { useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { useLocale, useT } from 'shared/src/i18n/react'
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

type Trilingual = { en: string; hans: string; hant: string }

const copy = {
  title: { en: 'Traffic', hans: '流量分析', hant: '流量分析' } as Trilingual,
  description: {
    en: 'Where storefront visits come from and what they do once they arrive.',
    hans: '店面的访问从哪里来，来了之后做了什么。',
    hant: '店面的訪問從哪裡來，來了之後做了什麼。',
  } as Trilingual,
  range7: { en: '7 days', hans: '7 天', hant: '7 天' } as Trilingual,
  range30: { en: '30 days', hans: '30 天', hant: '30 天' } as Trilingual,
  range90: { en: '90 days', hans: '90 天', hant: '90 天' } as Trilingual,
  allHosts: { en: 'All storefronts', hans: '全部站点', hant: '全部站點' } as Trilingual,
  refresh: { en: 'Refresh', hans: '刷新', hant: '重新整理' } as Trilingual,
  pause: { en: 'Pause collection', hans: '暂停统计', hant: '暫停統計' } as Trilingual,
  resume: { en: 'Resume collection', hans: '恢复统计', hant: '恢復統計' } as Trilingual,
  paused: {
    en: 'Collection is paused: page views are not being counted. Reports keep what was already recorded.',
    hans: '统计已暂停：新的页面浏览不再计数，已有数据仍可查看。',
    hant: '統計已暫停：新的頁面瀏覽不再計數，已有資料仍可查看。',
  } as Trilingual,
  switchHint: {
    en: 'A change takes up to half a minute to reach the storefront.',
    hans: '开关变更约半分钟后在店面生效。',
    hant: '開關變更約半分鐘後在店面生效。',
  } as Trilingual,
  switchFailed: {
    en: 'The switch could not be changed. Check that you may write settings.',
    hans: '开关没能改掉。请确认你有修改设置的权限。',
    hant: '開關沒能改掉。請確認你有修改設定的權限。',
  } as Trilingual,
  visitors: { en: 'Visitors', hans: '访客', hant: '訪客' } as Trilingual,
  visits: { en: 'Visits', hans: '访问次数', hant: '訪問次數' } as Trilingual,
  views: { en: 'Page views', hans: '页面浏览', hant: '頁面瀏覽' } as Trilingual,
  bounceRate: { en: 'Bounce rate', hans: '跳出率', hant: '跳出率' } as Trilingual,
  bounceHint: {
    en: 'Share of visits that left after one page.',
    hans: '只看了一个页面就离开的访问占比。',
    hant: '只看了一個頁面就離開的訪問佔比。',
  } as Trilingual,
  avgTime: { en: 'Avg. visit time', hans: '平均访问时长', hant: '平均訪問時長' } as Trilingual,
  trend: { en: 'Visits per day', hans: '每日访问', hant: '每日訪問' } as Trilingual,
  trendHint: {
    en: 'Bars are visits, the line is visitors. A visit ends after 30 minutes without a page view.',
    hans: '柱子是访问次数，折线是访客数。30 分钟没有新页面浏览算一次访问结束。',
    hant: '柱子是訪問次數，折線是訪客數。30 分鐘沒有新頁面瀏覽算一次訪問結束。',
  } as Trilingual,
  visitorsSeries: { en: 'Visitors', hans: '访客', hant: '訪客' } as Trilingual,
  visitsSeries: { en: 'Visits', hans: '访问次数', hant: '訪問次數' } as Trilingual,
  channels: { en: 'Channels', hans: '渠道', hant: '渠道' } as Trilingual,
  share: { en: 'Share', hans: '占比', hant: '佔比' } as Trilingual,
  channel: {
    paid: { en: 'Paid', hans: '付费推广', hant: '付費推廣' } as Trilingual,
    ai: { en: 'AI assistants', hans: 'AI 助手', hant: 'AI 助手' } as Trilingual,
    search: { en: 'Organic search', hans: '自然搜索', hant: '自然搜尋' } as Trilingual,
    social: { en: 'Social', hans: '社交', hant: '社交' } as Trilingual,
    email: { en: 'E-mail', hans: '邮件', hant: '郵件' } as Trilingual,
    campaign: { en: 'Tagged campaigns', hans: '标记活动', hant: '標記活動' } as Trilingual,
    referral: { en: 'Referrals', hans: '引荐链接', hant: '引薦連結' } as Trilingual,
    direct: { en: 'Direct', hans: '直接访问', hant: '直接訪問' } as Trilingual,
  } as Record<TrafficChannel, Trilingual>,
  searchVsAi: { en: 'Search or AI', hans: '搜索还是 AI', hant: '搜尋還是 AI' } as Trilingual,
  seo: { en: 'Organic search (SEO)', hans: '自然搜索（SEO）', hant: '自然搜尋（SEO）' } as Trilingual,
  geo: { en: 'AI assistants (GEO)', hans: 'AI 助手（GEO）', hant: 'AI 助手（GEO）' } as Trilingual,
  ofVisits: { en: 'of visits', hans: '占访问', hant: '佔訪問' } as Trilingual,
  topEngines: { en: 'Search engines', hans: '搜索引擎', hant: '搜尋引擎' } as Trilingual,
  topAssistants: { en: 'AI assistants', hans: 'AI 助手', hant: 'AI 助手' } as Trilingual,
  aiCaveat: {
    en: 'AI traffic is a floor, not a total: several assistants open links without naming themselves, so those visits are counted as direct. Clicks from Google’s AI summaries look like ordinary search.',
    hans: 'AI 流量是下限而不是全部：有些 AI 助手打开链接时不表明身份，这些访问会被算进「直接访问」。Google AI 摘要带来的点击和普通搜索无法区分。',
    hant: 'AI 流量是下限而不是全部：有些 AI 助手開啟連結時不表明身份，這些訪問會被算進「直接訪問」。Google AI 摘要帶來的點擊和普通搜尋無法區分。',
  } as Trilingual,
  sources: { en: 'Sources', hans: '来源明细', hant: '來源明細' } as Trilingual,
  dimension: {
    source: { en: 'Source', hans: '来源', hant: '來源' } as Trilingual,
    referrer: { en: 'Referring site', hans: '引荐网站', hant: '引薦網站' } as Trilingual,
    medium: { en: 'Medium', hans: '媒介', hant: '媒介' } as Trilingual,
    campaign: { en: 'Campaign', hans: '活动', hant: '活動' } as Trilingual,
    landing: { en: 'Landing page', hans: '落地页', hant: '落地頁' } as Trilingual,
    page: { en: 'Page', hans: '页面', hant: '頁面' } as Trilingual,
    country: { en: 'Country', hans: '国家或地区', hant: '國家或地區' } as Trilingual,
    device: { en: 'Device', hans: '设备', hant: '設備' } as Trilingual,
  } as Record<SourceDimension, Trilingual>,
  device: {
    mobile: { en: 'Mobile', hans: '手机', hant: '手機' } as Trilingual,
    tablet: { en: 'Tablet', hans: '平板', hant: '平板' } as Trilingual,
    desktop: { en: 'Desktop', hans: '电脑', hant: '電腦' } as Trilingual,
    other: { en: 'Other', hans: '其他', hant: '其他' } as Trilingual,
  } as Record<string, Trilingual>,
  mixed: { en: 'Several channels', hans: '多个渠道', hant: '多個渠道' } as Trilingual,
  showMore: { en: 'Show more', hans: '显示更多', hant: '顯示更多' } as Trilingual,
  empty: {
    en: 'No visits recorded in this range yet. Numbers appear as soon as someone opens the storefront.',
    hans: '这个区间还没有访问记录。有人打开店面后，这里就会出现数据。',
    hant: '這個區間還沒有訪問紀錄。有人開啟店面後，這裡就會出現資料。',
  } as Trilingual,
  unavailable: {
    en: 'Traffic reports are not available right now. Check that the Traffic Analytics plugin is installed and enabled.',
    hans: '暂时拿不到流量数据。请确认「Traffic Analytics」插件已安装并启用。',
    hant: '暫時拿不到流量資料。請確認「Traffic Analytics」外掛已安裝並啟用。',
  } as Trilingual,
  loading: { en: 'Loading…', hans: '加载中…', hant: '載入中…' } as Trilingual,
  privacy: {
    en: 'Nothing personal is stored: no cookies, no addresses, no device identifiers. A visitor is an anonymous key that changes every month, and visitors who ask not to be tracked are not counted.',
    hans: '不保存任何个人信息：没有 cookie、不存 IP 地址、不存设备标识。访客只是一个每月更换的匿名标识，要求不被追踪的访客不会被统计。',
    hant: '不保存任何個人資訊：沒有 cookie、不存 IP 位址、不存裝置識別碼。訪客只是一個每月更換的匿名標識，要求不被追蹤的訪客不會被統計。',
  } as Trilingual,
  rules: { en: 'Channel lists', hans: '渠道名单', hant: '渠道名單' } as Trilingual,
  rulesBuiltIn: { en: 'built-in', hans: '内置', hant: '內建' } as Trilingual,
  second: { en: 's', hans: ' 秒', hant: ' 秒' } as Trilingual,
  minute: { en: 'min', hans: ' 分钟', hant: ' 分鐘' } as Trilingual,
  hour: { en: 'h', hans: ' 小时 ', hant: ' 小時 ' } as Trilingual,
}

const RANGE_TABS: Array<{ days: TrafficRangeDays; label: Trilingual }> = [
  { days: 7, label: copy.range7 },
  { days: 30, label: copy.range30 },
  { days: 90, label: copy.range90 },
]

const SOURCE_DIMENSIONS = ['source', 'referrer', 'medium', 'campaign', 'landing', 'page', 'country', 'device'] as const
type SourceDimension = (typeof SOURCE_DIMENSIONS)[number]

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

const PAGE_SIZE = 10

function useTrilingual() {
  const locale = useLocale()
  const pick = (text: Trilingual): string =>
    locale === 'zh-Hans' ? text.hans : locale === 'zh-Hant' ? text.hant : text.en
  return pick
}

interface TrendTooltipEntry {
  dataKey?: string | number
  value?: number | string
  payload?: { day: string }
}

function TrendTooltip({ active, payload, pick }: { active?: boolean; payload?: TrendTooltipEntry[]; pick: (c: Trilingual) => string }) {
  if (!active || !payload?.length) return null
  const visits = payload.find((entry) => entry.dataKey === 'visits')?.value
  const visitors = payload.find((entry) => entry.dataKey === 'visitors')?.value
  return (
    <div className="rounded-xl border border-[#eef1f6] bg-white px-4 py-3 shadow-lg">
      <p className="text-xs font-bold text-slate-900">{payload[0]?.payload?.day}</p>
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="h-2 w-2 rounded-full bg-[#3b82f6]" />
          {pick(copy.visitsSeries)}
          <span className="font-bold text-slate-900">{typeof visits === 'number' ? visits.toLocaleString() : '--'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="h-2 w-2 rounded-full bg-[#8b5cf6]" />
          {pick(copy.visitorsSeries)}
          <span className="font-bold text-slate-900">{typeof visitors === 'number' ? visitors.toLocaleString() : '--'}</span>
        </div>
      </div>
    </div>
  )
}

export default function TrafficPage() {
  const t = useT()
  const pick = useTrilingual()
  const getText = (key: string, fallback: string): string => (t ? t(key) : fallback)
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
    if (seconds < 60) return `${seconds}${pick(copy.second)}`
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes}${pick(copy.minute)}`
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return rest ? `${hours}${pick(copy.hour)}${rest}${pick(copy.minute)}` : `${hours}${pick(copy.hour)}`
  }

  const data = report.data
  const totalVisits = data?.summary.visits ?? 0
  const shareOf = (visits: number): string => (totalVisits > 0 ? formatPercent(visits / totalVisits) : '0%')
  const channelFigures = (channel: TrafficChannel) =>
    data?.channels.find((entry) => entry.channel === channel) ?? { channel, visitors: 0, visits: 0, views: 0, bounceRate: 0, avgVisitSeconds: 0 }
  const channelName = (channel: TrafficChannel) => pick(copy.channel[channel])

  const hostOptions = (hosts.data?.rows ?? []) as TrafficSourceRow[]
  const sourceRows = (sources.data?.rows ?? []) as TrafficSourceRow[]
  const isPageDimension = dimension === 'page'
  const displayValue = (value: string): string => (dimension === 'device' ? pick(copy.device[value] ?? copy.device.other) : value)

  const cards = data
    ? [
        { label: pick(copy.visitors), value: formatNumber(data.summary.visitors), icon: Users, tone: 'text-purple-600' },
        { label: pick(copy.visits), value: formatNumber(data.summary.visits), icon: MousePointerClick, tone: 'text-blue-600' },
        { label: pick(copy.views), value: formatNumber(data.summary.views), icon: Eye, tone: 'text-amber-600' },
        {
          label: pick(copy.bounceRate),
          value: formatPercent(data.summary.bounceRate),
          hint: `${pick(copy.avgTime)} ${formatDuration(data.summary.avgVisitSeconds)}`,
          icon: Route,
          tone: 'text-green-600',
        },
      ]
    : []

  const search = channelFigures('search')
  const ai = channelFigures('ai')
  const versus = [
    { label: pick(copy.seo), figures: search, color: CHANNEL_COLORS.search, rows: engines.data?.rows ?? [], rowsLabel: pick(copy.topEngines) },
    { label: pick(copy.geo), figures: ai, color: CHANNEL_COLORS.ai, rows: assistants.data?.rows ?? [], rowsLabel: pick(copy.topAssistants) },
  ]

  const refresh = () => Promise.all([report.refetch(), sources.refetch(), hosts.refetch(), assistants.refetch(), engines.refetch()])
  const changeSwitch = (next: boolean) =>
    setPaused.mutate(next, {
      onError: () => toast.error(pick(copy.switchFailed)),
    })

  const loading = (
    <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      {pick(copy.loading)}
    </div>
  )

  return (
    <PageShell
      title={pick(copy.title)}
      description={pick(copy.description)}
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
                {pick(tab.label)}
              </button>
            ))}
          </div>
          {hostOptions.length > 1 ? (
            <select
              value={host ?? ''}
              onChange={(event) => setHost(event.target.value || null)}
              className="h-9 rounded-lg border border-[#eef1f6] bg-white px-3 text-xs text-slate-700"
            >
              <option value="">{pick(copy.allHosts)}</option>
              {hostOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.value}</option>
              ))}
            </select>
          ) : null}
          <Button
            variant="outline"
            onClick={() => changeSwitch(!paused.data)}
            disabled={setPaused.isPending || paused.data === undefined}
            className="gap-2"
          >
            {setPaused.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : paused.data ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {paused.data ? pick(copy.resume) : pick(copy.pause)}
          </Button>
          <Button variant="outline" onClick={() => void refresh()} disabled={report.isFetching} className="gap-2">
            <RefreshCw className={cn('h-4 w-4', report.isFetching && 'animate-spin')} />
            {pick(copy.refresh)}
          </Button>
        </>
      }
    >
      <PageNav
        items={[
          { label: getText('merchant.nav.dashboard', '仪表板'), href: '/dashboard' },
          { label: pick(copy.title), href: '/analytics/traffic', exact: true },
        ]}
      />

      <section className="py-6">
        {report.isError ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-12 text-center text-muted-foreground">
            <ChartColumn className="h-10 w-10 opacity-40" />
            <p>{pick(copy.unavailable)}</p>
            <Button variant="outline" onClick={() => void refresh()}>
              {pick(copy.refresh)}
            </Button>
          </div>
        ) : !data ? (
          loading
        ) : (
          <div className="space-y-6">
            <p className="text-xs text-muted-foreground">
              {data.period.from} – {data.period.to} · {pick(copy.privacy)}
            </p>
            {paused.data ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                {pick(copy.paused)} {pick(copy.switchHint)}
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
                <p>{pick(copy.empty)}</p>
              </div>
            ) : (
              <>
                {/* Trend */}
                <div className="rounded-lg border bg-card p-5">
                  <h3 className="text-base font-semibold">{pick(copy.trend)}</h3>
                  <p className="mb-4 mt-0.5 text-xs text-muted-foreground">{pick(copy.trendHint)}</p>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data.daily} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
                        <XAxis dataKey="day" tickFormatter={(value: string) => value.slice(5)} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                        <Tooltip content={<TrendTooltip pick={pick} />} cursor={{ fill: 'rgba(59,130,246,0.06)' }} />
                        <Bar dataKey="visits" name={pick(copy.visitsSeries)} fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={28} />
                        <Line dataKey="visitors" name={pick(copy.visitorsSeries)} stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2.5, fill: '#8b5cf6', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Search or AI */}
                <div className="rounded-lg border bg-card p-5">
                  <h3 className="text-base font-semibold">{pick(copy.searchVsAi)}</h3>
                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {versus.map((side) => (
                      <div key={side.label} className="rounded-lg border border-[#eef1f6] p-4">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: side.color }} />
                          <span className="text-sm font-semibold">{side.label}</span>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                          <span className="text-3xl font-bold">{formatNumber(side.figures.visits)}</span>
                          <span className="text-xs text-muted-foreground">{shareOf(side.figures.visits)} {pick(copy.ofVisits)}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatNumber(side.figures.visitors)} {pick(copy.visitors)} · {pick(copy.bounceRate)} {formatPercent(side.figures.bounceRate)} ·{' '}
                          {pick(copy.avgTime)} {formatDuration(side.figures.avgVisitSeconds)}
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
                  <p className="mt-4 text-xs text-muted-foreground">{pick(copy.aiCaveat)}</p>
                </div>

                {/* Channels */}
                <div className="rounded-lg border bg-card">
                  <div className="border-b p-5">
                    <h3 className="text-base font-semibold">{pick(copy.channels)}</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-4 py-3 font-medium">{pick(copy.channels)}</th>
                          <th className="px-4 py-3 text-right font-medium">{pick(copy.visitors)}</th>
                          <th className="px-4 py-3 text-right font-medium">{pick(copy.visits)}</th>
                          <th className="px-4 py-3 text-right font-medium">{pick(copy.views)}</th>
                          <th className="px-4 py-3 text-right font-medium">{pick(copy.share)}</th>
                          <th className="px-4 py-3 text-right font-medium">{pick(copy.bounceRate)}</th>
                          <th className="px-4 py-3 text-right font-medium">{pick(copy.avgTime)}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {TRAFFIC_CHANNELS.map((channel) => {
                          const figures = channelFigures(channel)
                          return (
                            <tr key={channel} className="border-b last:border-b-0 hover:bg-muted/40">
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-2 font-medium">
                                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHANNEL_COLORS[channel] }} />
                                  {channelName(channel)}
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
                    <h3 className="text-base font-semibold">{pick(copy.sources)}</h3>
                    <div className="flex flex-wrap items-center rounded-lg border border-[#eef1f6] bg-[#f8fafc] p-0.5">
                      {SOURCE_DIMENSIONS.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => { setDimension(option); setShown(PAGE_SIZE) }}
                          className={cn(
                            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                            dimension === option ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800',
                          )}
                        >
                          {pick(copy.dimension[option])}
                        </button>
                      ))}
                    </div>
                  </div>
                  {sources.isLoading ? (
                    loading
                  ) : sourceRows.length === 0 ? (
                    <p className="p-10 text-center text-sm text-muted-foreground">{pick(copy.empty)}</p>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="px-4 py-3 font-medium">{pick(copy.dimension[dimension])}</th>
                              <th className="px-4 py-3 text-right font-medium">{pick(copy.visitors)}</th>
                              <th className="px-4 py-3 text-right font-medium">{pick(copy.visits)}</th>
                              <th className="px-4 py-3 text-right font-medium">{pick(copy.views)}</th>
                              <th className="px-4 py-3 text-right font-medium">{pick(copy.bounceRate)}</th>
                              <th className="px-4 py-3 text-right font-medium">{pick(copy.avgTime)}</th>
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
                            {pick(copy.showMore)}
                          </Button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  {pick(copy.rules)} v{data.rulesVersion}
                  {data.rulesUpdatedAt ? ` · ${new Date(data.rulesUpdatedAt).toLocaleString()}` : ` · ${pick(copy.rulesBuiltIn)}`}
                </p>
              </>
            )}
          </div>
        )}
      </section>
    </PageShell>
  )
}
