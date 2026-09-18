/**
 * Tool Discovery Page for Admin Application
 *
 * Review queue for automatically collected trending AI tools: run the
 * collectors, inspect candidates, and approve them into the public catalog
 * (or reject them). Approved rows become storefront products immediately.
 */

'use client'

import { ExternalLink, Flame, RefreshCw, Check, X, Inbox, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useT } from 'shared/src/i18n/react'
import { apiClient, type ToolDiscoveryItem } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

const SOURCE_LABELS: Record<string, string> = {
  hacker_news: 'Hacker News',
  product_hunt: 'Product Hunt',
}

function formatMetrics(metricsJson: string): string {
  try {
    const metrics = JSON.parse(metricsJson || '{}') as Record<string, number>
    if (typeof metrics.votes === 'number') return `${metrics.votes} votes`
    if (typeof metrics.points === 'number') return `${metrics.points} points`
    return ''
  } catch {
    return ''
  }
}

export default function ToolDiscoveryPage() {
  const t = useT()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const getText = (key: string, fallback: string): string => (t ? t(key) : fallback)

  const [statusFilter, setStatusFilter] = useState('pending')
  const [currentPage, setCurrentPage] = useState(1)
  const [categoryByRow, setCategoryByRow] = useState<Record<string, string>>({})
  const pageSize = 10

  const { data, isLoading } = useQuery({
    queryKey: ['tool-discoveries', statusFilter, currentPage],
    queryFn: async () => {
      const response = await apiClient.get('/api/admin/tool-discoveries', {
        params: {
          page: currentPage,
          limit: pageSize,
          status: statusFilter === 'all' ? undefined : statusFilter,
        },
      })
      return response.data as { data: { items: ToolDiscoveryItem[]; total: number; totalPages: number } }
    },
    refetchInterval: statusFilter === 'pending' ? 60000 : false,
  })

  const runCollectors = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/api/admin/tool-discoveries/run')
      return response.data as { data: { sources: Array<{ source: string; inserted?: number; skipped?: string }>; totalInserted: number } }
    },
    onSuccess: (payload) => {
      const summary = payload?.data?.sources
        ?.map((source) => `${SOURCE_LABELS[source.source] ?? source.source}: ${source.skipped ?? `+${source.inserted ?? 0}`}`)
        .join(' · ')
      toast({ title: getText('merchant.toolDiscovery.collectDone', 'Collection finished'), description: summary })
      queryClient.invalidateQueries({ queryKey: ['tool-discoveries'] })
    },
    onError: () => {
      toast({ title: getText('merchant.toolDiscovery.collectFailed', 'Collection failed'), variant: 'destructive' })
    },
  })

  const approve = useMutation({
    mutationFn: async (item: ToolDiscoveryItem) => {
      const categoryName = categoryByRow[item.id]?.trim()
      const response = await apiClient.post(
        `/api/admin/tool-discoveries/${encodeURIComponent(item.id)}/approve`,
        categoryName ? { categoryName } : {},
      )
      return response.data as { data: { productId: string } }
    },
    onSuccess: (payload) => {
      toast({ title: getText('merchant.toolDiscovery.approved', 'Tool published'), description: payload?.data?.productId })
      queryClient.invalidateQueries({ queryKey: ['tool-discoveries'] })
    },
    onError: () => {
      toast({ title: getText('merchant.toolDiscovery.approveFailed', 'Publish failed'), variant: 'destructive' })
    },
  })

  const reject = useMutation({
    mutationFn: async (item: ToolDiscoveryItem) => {
      const response = await apiClient.post(
        `/api/admin/tool-discoveries/${encodeURIComponent(item.id)}/reject`,
        { note: getText('merchant.toolDiscovery.rejectedViaQueue', 'Rejected from review queue') },
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tool-discoveries'] })
    },
    onError: () => {
      toast({ title: getText('merchant.toolDiscovery.rejectFailed', 'Reject failed'), variant: 'destructive' })
    },
  })

  const items = data?.data?.items ?? []
  const total = data?.data?.total ?? 0
  const totalPages = Math.max(1, data?.data?.totalPages ?? 1)

  const statusFilters = [
    { value: 'pending', label: getText('merchant.toolDiscovery.pending', 'Pending') },
    { value: 'approved', label: getText('merchant.toolDiscovery.approvedLabel', 'Approved') },
    { value: 'rejected', label: getText('merchant.toolDiscovery.rejectedLabel', 'Rejected') },
    { value: 'duplicate', label: getText('merchant.toolDiscovery.duplicate', 'Duplicates') },
    { value: 'all', label: getText('merchant.toolDiscovery.all', 'All') },
  ]

  return (
    <div className="container mx-auto space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {getText('merchant.toolDiscovery.title', 'Tool Discovery')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {getText(
              'merchant.toolDiscovery.subtitle',
              'Review trending AI tools collected from community sources before they are published to the storefront.',
            )}
          </p>
        </div>
        <Button onClick={() => runCollectors.mutate()} disabled={runCollectors.isPending}>
          {runCollectors.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {getText('merchant.toolDiscovery.collectNow', 'Collect now')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => {
              setStatusFilter(filter.value)
              setCurrentPage(1)
            }}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === filter.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {getText('common.loading', 'Loading...')}
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-sm text-muted-foreground">
            <Inbox className="h-8 w-8" />
            {getText('merchant.toolDiscovery.empty', 'No discoveries in this queue yet. Hit “Collect now” to fetch the latest trending tools.')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{item.name}</span>
                    <Badge variant="outline">{SOURCE_LABELS[item.source] ?? item.source}</Badge>
                    {item.status !== 'pending' ? <Badge variant="secondary">{item.status}</Badge> : null}
                    {item.product_id ? (
                      <Badge variant="secondary">
                        {getText('merchant.toolDiscovery.publishedAs', 'published')}: {item.product_id}
                      </Badge>
                    ) : null}
                  </div>
                  {item.tagline ? <p className="text-sm text-muted-foreground">{item.tagline}</p> : null}
                  {item.description && item.description !== item.tagline ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        {item.domain ?? item.url}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                    <span className="inline-flex items-center gap-1">
                      <Flame className="h-3 w-3 text-orange-500" />
                      {formatMetrics(item.metrics_json) || '—'}
                    </span>
                    <span>{new Date(item.discovered_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {item.status === 'pending' ? (
                  <div className="flex shrink-0 flex-col gap-2 sm:w-56">
                    <Input
                      value={categoryByRow[item.id] ?? ''}
                      onChange={(event) =>
                        setCategoryByRow((previous) => ({ ...previous, [item.id]: event.target.value }))
                      }
                      placeholder={getText('merchant.toolDiscovery.categoryPlaceholder', 'Category (default: AI 工具)')}
                      className="h-8 text-xs"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => approve.mutate(item)}
                        disabled={approve.isPending}
                      >
                        <Check className="mr-1 h-3.5 w-3.5" />
                        {getText('merchant.toolDiscovery.approve', 'Approve')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => reject.mutate(item)}
                        disabled={reject.isPending}
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        {getText('merchant.toolDiscovery.reject', 'Reject')}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {getText(
              'merchant.toolDiscovery.showingResults',
              'Showing {from} to {to} of {total} results',
            )
              .replace('{from}', String((currentPage - 1) * pageSize + 1))
              .replace('{to}', String(Math.min(currentPage * pageSize, total)))
              .replace('{total}', String(total))}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
              disabled={currentPage === 1}
            >
              {getText('merchant.toolDiscovery.previous', 'Previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((previous) => Math.min(totalPages, previous + 1))}
              disabled={currentPage === totalPages}
            >
              {getText('merchant.toolDiscovery.next', 'Next')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
