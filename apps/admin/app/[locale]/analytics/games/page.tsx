/**
 * Game Stats — native game-stats plugin.
 *
 * Who is playing right now, how much was played today, and how each game has
 * done over the last 7 or 30 days. The counts are anonymous: a player is a
 * per-day hash of a random browser id, so nothing on this page can identify a
 * person. "Online" means a heartbeat inside the plugin's window (90 seconds by
 * default); "today" follows the day boundary configured on the plugin.
 */

'use client'

import { Activity, Gamepad2, Loader2, RefreshCw, Search, Timer, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useT, useLocale } from 'shared/src/i18n/react'
import { PageShell } from '@/components/layout/page-shell'
import { PageNav } from '@/components/layout/page-nav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useGameStatsGames, useGameStatsOverview, useGameStatsTimeseries } from '@/lib/hooks/use-api'
import { cn } from '@/lib/utils'
import type { GameStatsDay, GameStatsRangeDays } from '@/lib/api'

type Trilingual = { en: string; hans: string; hant: string }

const PAGE_SIZE = 50

function useTrilingual() {
  const locale = useLocale()
  const pick = (copy: Trilingual): string =>
    locale === 'zh-Hans' ? copy.hans : locale === 'zh-Hant' ? copy.hant : copy.en
  return pick
}

const copy = {
  title: { en: 'Game Stats', hans: '游戏统计', hant: '遊戲統計' } as Trilingual,
  description: {
    en: 'Who is playing now and how much each game is played. Counts are anonymous: a player is a per-day hash of a random browser id, never an account or an address.',
    hans: '当前有多少人在玩、每款游戏被玩了多少。统计完全匿名：玩家只是一个按日哈希的随机浏览器标识，不是账号，也不是 IP。',
    hant: '目前有多少人在玩、每款遊戲被玩了多少。統計完全匿名：玩家只是一個按日雜湊的隨機瀏覽器標識，不是帳號，也不是 IP。',
  } as Trilingual,
  statsDay: { en: 'Stats day', hans: '统计日', hant: '統計日' } as Trilingual,
  online: { en: 'Playing now', hans: '当前在线', hant: '目前在線' } as Trilingual,
  onlineGames: { en: 'games with players', hans: '款游戏有人在玩', hant: '款遊戲有人在玩' } as Trilingual,
  sessionsToday: { en: 'Sessions today', hans: '今日游玩人次', hant: '今日遊玩人次' } as Trilingual,
  playersToday: { en: 'Players today', hans: '今日独立玩家', hant: '今日獨立玩家' } as Trilingual,
  playTimeToday: { en: 'Play time today', hans: '今日游玩时长', hant: '今日遊玩時長' } as Trilingual,
  totalSessions: { en: 'All-time sessions', hans: '累计游玩人次', hant: '累計遊玩人次' } as Trilingual,
  totalPlayTime: { en: 'All-time play time', hans: '累计游玩时长', hant: '累計遊玩時長' } as Trilingual,
  trackedDays: { en: 'Days tracked', hans: '已统计天数', hant: '已統計天數' } as Trilingual,
  trend: { en: 'Daily sessions and players', hans: '每日人次与玩家', hant: '每日人次與玩家' } as Trilingual,
  trendHint: {
    en: 'Bars are play sessions; the line is unique players per day. Today is still counting.',
    hans: '柱子是游玩人次，折线是当日独立玩家。今天的数据还在增长。',
    hant: '柱子是遊玩人次，折線是當日獨立玩家。今天的資料還在增長。',
  } as Trilingual,
  sessionsSeries: { en: 'Sessions', hans: '游玩人次', hant: '遊玩人次' } as Trilingual,
  playersSeries: { en: 'Players', hans: '独立玩家', hant: '獨立玩家' } as Trilingual,
  range7: { en: '7 days', hans: '7 天', hant: '7 天' } as Trilingual,
  range30: { en: '30 days', hans: '30 天', hant: '30 天' } as Trilingual,
  games: { en: 'Games', hans: '各游戏数据', hant: '各遊戲資料' } as Trilingual,
  gamesHint: {
    en: 'Average daily players is the range total of each day\'s unique players divided by the number of days; a player cannot be followed across days.',
    hans: '日均玩家 = 区间内每天独立玩家数之和 ÷ 天数；玩家跨天无法被关联，所以没有整个区间的去重人数。',
    hant: '日均玩家 = 區間內每天獨立玩家數之和 ÷ 天數；玩家跨天無法被關聯，所以沒有整個區間的去重人數。',
  } as Trilingual,
  gameHeader: { en: 'Game', hans: '游戏', hant: '遊戲' } as Trilingual,
  sessionsHeader: { en: 'Sessions', hans: '游玩人次', hant: '遊玩人次' } as Trilingual,
  avgPlayersHeader: { en: 'Avg. daily players', hans: '日均玩家', hant: '日均玩家' } as Trilingual,
  playTimeHeader: { en: 'Play time', hans: '游玩时长', hant: '遊玩時長' } as Trilingual,
  onlineHeader: { en: 'Playing now', hans: '当前在线', hant: '目前在線' } as Trilingual,
  searchPlaceholder: { en: 'Filter by game id', hans: '按游戏 ID 筛选', hant: '按遊戲 ID 篩選' } as Trilingual,
  showMore: { en: 'Show more', hans: '显示更多', hant: '顯示更多' } as Trilingual,
  shown: { en: 'shown', hans: '已显示', hant: '已顯示' } as Trilingual,
  empty: {
    en: 'No plays recorded yet. Numbers appear as soon as a player opens a game.',
    hans: '还没有游玩记录。有玩家打开游戏后，这里就会出现数据。',
    hant: '還沒有遊玩紀錄。有玩家打開遊戲後，這裡就會出現資料。',
  } as Trilingual,
  noMatch: { en: 'No game matches this filter.', hans: '没有符合筛选条件的游戏。', hant: '沒有符合篩選條件的遊戲。' } as Trilingual,
  unavailable: {
    en: 'Play statistics are not available right now. Check that the Game Stats plugin is installed and enabled.',
    hans: '暂时拿不到统计数据。请确认「Game Stats」插件已安装并启用。',
    hant: '暫時拿不到統計資料。請確認「Game Stats」外掛已安裝並啟用。',
  } as Trilingual,
  loading: { en: 'Loading…', hans: '加载中…', hant: '載入中…' } as Trilingual,
  refresh: { en: 'Refresh', hans: '刷新', hant: '重新整理' } as Trilingual,
  liveHint: {
    en: 'Playing now refreshes every 30 seconds. A player counts while their last heartbeat is within 90 seconds.',
    hans: '当前在线每 30 秒自动刷新；玩家最近一次心跳在 90 秒内才计入。',
    hant: '目前線上每 30 秒自動重新整理；玩家最近一次心跳在 90 秒內才計入。',
  } as Trilingual,
  second: { en: 's', hans: ' 秒', hant: ' 秒' } as Trilingual,
  minute: { en: 'min', hans: ' 分钟', hant: ' 分鐘' } as Trilingual,
  hour: { en: 'h', hans: ' 小时 ', hant: ' 小時 ' } as Trilingual,
}

const RANGE_TABS: Array<{ days: GameStatsRangeDays; label: Trilingual }> = [
  { days: 7, label: copy.range7 },
  { days: 30, label: copy.range30 },
]

interface TrendTooltipEntry {
  dataKey?: string | number
  value?: number | string
  payload?: { day: string }
}

function TrendTooltip({ active, payload, pick }: { active?: boolean; payload?: TrendTooltipEntry[]; pick: (c: Trilingual) => string }) {
  if (!active || !payload?.length) return null
  const sessions = payload.find((entry) => entry.dataKey === 'sessions')?.value
  const players = payload.find((entry) => entry.dataKey === 'players')?.value
  return (
    <div className="rounded-xl border border-[#eef1f6] bg-white px-4 py-3 shadow-lg">
      <p className="text-xs font-bold text-slate-900">{payload[0]?.payload?.day}</p>
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="h-2 w-2 rounded-full bg-[#3b82f6]" />
          {pick(copy.sessionsSeries)}
          <span className="font-bold text-slate-900">{typeof sessions === 'number' ? sessions.toLocaleString() : '--'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="h-2 w-2 rounded-full bg-[#8b5cf6]" />
          {pick(copy.playersSeries)}
          <span className="font-bold text-slate-900">{typeof players === 'number' ? players.toLocaleString() : '--'}</span>
        </div>
      </div>
    </div>
  )
}

export default function GameStatsPage() {
  const t = useT()
  const pick = useTrilingual()
  const getText = (key: string, fallback: string): string => (t ? t(key) : fallback)
  const [range, setRange] = useState<GameStatsRangeDays>(7)
  const [filter, setFilter] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)

  const overview = useGameStatsOverview()
  const trend = useGameStatsTimeseries(range)
  const games = useGameStatsGames(range)

  const formatNumber = (value: number): string => value.toLocaleString()
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}${pick(copy.second)}`
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes}${pick(copy.minute)}`
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return rest ? `${hours}${pick(copy.hour)}${rest}${pick(copy.minute)}` : `${hours}${pick(copy.hour)}`
  }

  const trendData = useMemo(
    () => (trend.data?.items ?? []).map((item: GameStatsDay) => ({ day: item.day, sessions: item.sessions, players: item.players })),
    [trend.data],
  )

  const gamesShown = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    const items = (games.data?.items ?? []).filter((item) => !needle || item.gameId.toLowerCase().includes(needle))
    return { items, visible: items.slice(0, limit) }
  }, [games.data, filter, limit])

  const data = overview.data
  const onlineGames = data ? Object.values(data.online.byGame).filter((count) => count > 0).length : 0

  const cards = data
    ? [
        { label: pick(copy.online), value: formatNumber(data.online.total), hint: `${onlineGames} ${pick(copy.onlineGames)}`, icon: Activity, tone: 'text-green-600' },
        { label: pick(copy.sessionsToday), value: formatNumber(data.today.sessions), hint: pick(copy.totalSessions) + ' ' + formatNumber(data.totals.sessions), icon: Gamepad2, tone: 'text-blue-600' },
        { label: pick(copy.playersToday), value: formatNumber(data.today.players), hint: `${pick(copy.trackedDays)} ${formatNumber(data.totals.days)}`, icon: Users, tone: 'text-purple-600' },
        { label: pick(copy.playTimeToday), value: formatDuration(data.today.playSeconds), hint: pick(copy.totalPlayTime) + ' ' + formatDuration(data.totals.playSeconds), icon: Timer, tone: 'text-amber-600' },
      ]
    : []

  const refresh = () => Promise.all([overview.refetch(), trend.refetch(), games.refetch()])

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
                onClick={() => {
                  setRange(tab.days)
                  setLimit(PAGE_SIZE)
                }}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  range === tab.days ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800',
                )}
              >
                {pick(tab.label)}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={() => void refresh()} disabled={overview.isFetching} className="gap-2">
            <RefreshCw className={cn('h-4 w-4', overview.isFetching && 'animate-spin')} />
            {pick(copy.refresh)}
          </Button>
        </>
      }
    >
      <PageNav
        items={[
          { label: getText('merchant.nav.dashboard', '仪表盘'), href: '/dashboard' },
          { label: pick(copy.title), href: '/analytics/games', exact: true },
        ]}
      />

      <section className="py-6">
        {overview.isError ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-12 text-center text-muted-foreground">
            <Gamepad2 className="h-10 w-10 opacity-40" />
            <p>{pick(copy.unavailable)}</p>
            <Button variant="outline" onClick={() => void refresh()}>
              {pick(copy.refresh)}
            </Button>
          </div>
        ) : !data ? (
          <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {pick(copy.loading)}
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-xs text-muted-foreground">
              {pick(copy.statsDay)} {data.day} · {pick(copy.liveHint)}
            </p>

            {/* Key figures */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {cards.map((card) => (
                <div key={card.label} className="rounded-lg border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">{card.label}</span>
                    <card.icon className={cn('h-5 w-5', card.tone)} />
                  </div>
                  <p className="mt-2 text-3xl font-bold">{card.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
                </div>
              ))}
            </div>

            {/* Trend */}
            <div className="rounded-lg border bg-card p-5">
              <h3 className="text-base font-semibold">{pick(copy.trend)}</h3>
              <p className="mb-4 mt-0.5 text-xs text-muted-foreground">{pick(copy.trendHint)}</p>
              {trendData.length === 0 ? (
                <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {pick(copy.loading)}
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
                      <XAxis dataKey="day" tickFormatter={(value: string) => value.slice(5)} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                      <Tooltip content={<TrendTooltip pick={pick} />} cursor={{ fill: 'rgba(59,130,246,0.06)' }} />
                      <Bar dataKey="sessions" name={pick(copy.sessionsSeries)} fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Line dataKey="players" name={pick(copy.playersSeries)} stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2.5, fill: '#8b5cf6', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Per game */}
            <div className="rounded-lg border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
                <div>
                  <h3 className="text-base font-semibold">{pick(copy.games)}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{pick(copy.gamesHint)}</p>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={filter} onChange={(event) => { setFilter(event.target.value); setLimit(PAGE_SIZE) }} placeholder={pick(copy.searchPlaceholder)} className="h-9 w-56 pl-8" />
                </div>
              </div>
              {games.isLoading ? (
                <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {pick(copy.loading)}
                </div>
              ) : gamesShown.items.length === 0 ? (
                <div className="flex flex-col items-center gap-3 p-10 text-center text-muted-foreground">
                  <Gamepad2 className="h-10 w-10 opacity-40" />
                  <p>{filter.trim() ? pick(copy.noMatch) : pick(copy.empty)}</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-4 py-3 font-medium">{pick(copy.gameHeader)}</th>
                          <th className="px-4 py-3 text-right font-medium">{pick(copy.sessionsHeader)}</th>
                          <th className="px-4 py-3 text-right font-medium">{pick(copy.avgPlayersHeader)}</th>
                          <th className="px-4 py-3 text-right font-medium">{pick(copy.playTimeHeader)}</th>
                          <th className="px-4 py-3 text-right font-medium">{pick(copy.onlineHeader)}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gamesShown.visible.map((item) => (
                          <tr key={item.gameId} className="border-b last:border-b-0 hover:bg-muted/40">
                            <td className="px-4 py-3 font-mono text-xs font-semibold">{item.gameId}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.sessions)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{(item.playerDays / range).toFixed(1)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{formatDuration(item.playSeconds)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {item.online > 0 ? (
                                <span className="inline-flex items-center gap-1.5 font-medium text-green-700">
                                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                  {formatNumber(item.online)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {gamesShown.items.length > gamesShown.visible.length && (
                    <div className="flex items-center justify-between border-t p-4 text-xs text-muted-foreground">
                      <span>
                        {pick(copy.shown)} {gamesShown.visible.length} / {gamesShown.items.length}
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => setLimit((current) => current + PAGE_SIZE)}>
                        {pick(copy.showMore)}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </section>
    </PageShell>
  )
}
