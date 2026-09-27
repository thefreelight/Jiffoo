'use client'

/**
 * API Token Management Panel
 *
 * Admin UI for creating, listing, and revoking scoped API tokens.
 * Used for MCP server integration and other machine-to-machine auth.
 */

import { useCallback, useEffect, useState } from 'react'
import { Copy, Key, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { resolveApiErrorMessage } from '@/lib/error-utils'
import { useT } from 'shared/src/i18n/react'

interface ApiTokenRecord {
  id: string
  label: string
  scopes: string[]
  createdAt: string
  lastUsedAt: string | null
}

interface CreateTokenResponse {
  token: string
  id: string
  label: string
  scopes: string[]
}

const SCOPE_OPTIONS = [
  { value: 'catalog:read', label: 'Catalog: Read (search products, get details)' },
  { value: 'cart:write', label: 'Cart: Write (add items, manage cart)' },
  { value: 'checkout:create', label: 'Checkout: Create (create orders, payment sessions)' },
  { value: 'orders:read', label: 'Orders: Read (view order history)' },
  { value: '*', label: 'All Access (admin-level)' },
]

export function ApiTokenPanel() {
  const t = useT()
  const [tokens, setTokens] = useState<ApiTokenRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newScopes, setNewScopes] = useState<string[]>(['catalog:read'])
  const [creating, setCreating] = useState(false)
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const loadTokens = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/v1/admin/api-tokens', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}`,
        },
      })
      if (!response.ok) throw new Error('Failed to load tokens')
      const data = await response.json()
      setTokens(data.data || [])
    } catch (error: unknown) {
      toast.error(resolveApiErrorMessage(error, t))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadTokens()
  }, [loadTokens])

  const handleCreate = async () => {
    if (!newLabel.trim()) {
      toast.error('Label is required')
      return
    }
    if (newScopes.length === 0) {
      toast.error('Select at least one scope')
      return
    }

    setCreating(true)
    try {
      const response = await fetch('/api/v1/admin/api-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}`,
        },
        body: JSON.stringify({ label: newLabel, scopes: newScopes }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err?.error?.message || 'Failed to create token')
      }

      const data = await response.json()
      const result = data.data as CreateTokenResponse
      setNewlyCreatedToken(result.token)
      setNewLabel('')
      setNewScopes(['catalog:read'])
      setShowCreateForm(false)
      await loadTokens()
      toast.success('Token created successfully')
    } catch (error: unknown) {
      toast.error(resolveApiErrorMessage(error, t))
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (tokenId: string) => {
    if (!confirm('Are you sure? This action cannot be undone.')) return

    try {
      const response = await fetch(`/api/v1/admin/api-tokens/${tokenId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}`,
        },
      })

      if (!response.ok) throw new Error('Failed to revoke token')

      toast.success('Token revoked')
      await loadTokens()
    } catch (error: unknown) {
      toast.error(resolveApiErrorMessage(error, t))
    }
  }

  const handleCopyToken = () => {
    if (newlyCreatedToken) {
      navigator.clipboard.writeText(newlyCreatedToken)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const toggleScope = (scope: string) => {
    setNewScopes((prev) =>
      prev.includes(scope)
        ? prev.filter((s) => s !== scope)
        : [...prev, scope],
    )
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleString()
  }

  return (
    <div className="bg-surface rounded-[2rem] border border-neutral-faint shadow-sm overflow-hidden">
      <div className="px-8 py-6 border-b border-neutral-veil">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-neutral-deepest">API Tokens</h3>
            <span className="text-[10px] font-bold text-neutral-light uppercase tracking-widest">
              For MCP Server & Integrations
            </span>
          </div>
          <Button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="h-9 px-4 rounded-xl bg-action-strong hover:bg-action-deep font-semibold text-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Token
          </Button>
        </div>
      </div>

      <div className="p-8 space-y-4">
        {/* Newly created token display */}
        {newlyCreatedToken && (
          <div className="rounded-2xl border-2 border-success-soft bg-success-veil/50 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success-strong" />
              <p className="text-sm font-bold text-success-dark">
                Token created — save it now, it won&apos;t be shown again
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-surface border border-success-soft text-sm font-mono text-neutral-dark break-all">
                {newlyCreatedToken}
              </code>
              <Button
                onClick={handleCopyToken}
                size="sm"
                variant="outline"
                className="shrink-0"
              >
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              onClick={() => setNewlyCreatedToken(null)}
              size="sm"
              variant="ghost"
              className="text-xs"
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Create form */}
        {showCreateForm && (
          <div className="rounded-2xl border border-neutral-faint bg-neutral-veil/30 p-5 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-neutral-light uppercase tracking-widest">
                Label
              </Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Claude Desktop - Personal"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-neutral-light uppercase tracking-widest">
                Scopes
              </Label>
              <div className="space-y-2">
                {SCOPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={newScopes.includes(opt.value)}
                      onChange={() => toggleScope(opt.value)}
                      className="h-4 w-4 rounded border-neutral-pale"
                    />
                    <span className="text-sm text-neutral-deep">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCreate}
                disabled={creating}
                className="h-9 px-4 rounded-xl bg-action-strong hover:bg-action-deep"
              >
                {creating ? 'Creating...' : 'Create Token'}
              </Button>
              <Button
                onClick={() => setShowCreateForm(false)}
                variant="outline"
                className="h-9 px-4 rounded-xl"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Token list */}
        {loading ? (
          <p className="text-sm text-neutral-base">Loading tokens...</p>
        ) : tokens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Key className="h-8 w-8 text-neutral-pale mb-2" />
            <p className="text-sm text-neutral-base">No API tokens yet</p>
            <p className="text-xs text-neutral-light mt-1">
              Create a token to enable MCP server or other integrations
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="flex items-center justify-between rounded-xl border border-neutral-faint p-4 hover:bg-neutral-veil/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-deepest truncate">
                    {token.label}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {token.scopes.map((scope) => (
                      <span
                        key={scope}
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide',
                          scope === '*'
                            ? 'bg-highlight-faint text-highlight-deep'
                            : 'bg-action-faint text-action-deep',
                        )}
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-neutral-light mt-1">
                    Created: {formatDate(token.createdAt)}
                    {token.lastUsedAt && ` · Last used: ${formatDate(token.lastUsedAt)}`}
                  </p>
                </div>
                <Button
                  onClick={() => handleRevoke(token.id)}
                  variant="ghost"
                  size="sm"
                  className="text-danger-strong hover:text-danger-deep hover:bg-danger-veil"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Info banner */}
        <div className="flex items-start gap-2 rounded-xl bg-action-veil/50 border border-action-faint p-3">
          <AlertCircle className="h-4 w-4 text-action-base shrink-0 mt-0.5" />
          <p className="text-xs text-action-deep">
            API tokens enable AI agents (Claude Desktop, Claude Code) to interact with your store.
            Use the MCP server with <code className="font-mono text-action-dark">JIFFOO_API_TOKEN</code> env var.
          </p>
        </div>
      </div>
    </div>
  )
}
