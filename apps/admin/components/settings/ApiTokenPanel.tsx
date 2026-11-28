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
  { value: 'catalog:read', label: 'Catalog: Read (search products, get details)', labelKey: 'merchant.settings.apiToken.scopeCatalogRead' },
  { value: 'cart:write', label: 'Cart: Write (add items, manage cart)', labelKey: 'merchant.settings.apiToken.scopeCartWrite' },
  { value: 'checkout:create', label: 'Checkout: Create (create orders, payment sessions)', labelKey: 'merchant.settings.apiToken.scopeCheckoutCreate' },
  { value: 'orders:read', label: 'Orders: Read (view order history)', labelKey: 'merchant.settings.apiToken.scopeOrdersRead' },
  { value: '*', label: 'All Access (admin-level)', labelKey: 'merchant.settings.apiToken.scopeAllAccess' },
]

/** What a scope is called in the store's language; one this list does not name is shown as the core spells it. */
const scopeLabel = (getText: (key: string, fallback: string) => string, scope: string): string => {
  const option = SCOPE_OPTIONS.find((entry) => entry.value === scope)
  return option ? getText(option.labelKey, option.label) : scope
}

export function ApiTokenPanel() {
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

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
      toast.error(getText('merchant.settings.apiToken.labelIsRequired', 'Label is required'))
      return
    }
    if (newScopes.length === 0) {
      toast.error(getText('merchant.settings.apiToken.selectAtLeastOneScope', 'Select at least one scope'))
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
      toast.success(getText('merchant.settings.apiToken.tokenCreatedSuccessfully', 'Token created successfully'))
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

      toast.success(getText('merchant.settings.apiToken.tokenRevoked', 'Token revoked'))
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
    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-8 py-6 border-b border-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{getText('merchant.settings.apiToken.apiTokens', 'API Tokens')}</h3>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {getText('merchant.settings.apiToken.forMcpServerIntegrations', 'For MCP Server & Integrations')}
            </span>
          </div>
          <Button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold text-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {getText('merchant.settings.apiToken.newToken', 'New Token')}
          </Button>
        </div>
      </div>

      <div className="p-8 space-y-4">
        {/* Newly created token display */}
        {newlyCreatedToken && (
          <div className="rounded-2xl border-2 border-green-200 bg-green-50/50 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="text-sm font-bold text-green-800">
                {getText('merchant.settings.apiToken.tokenCreatedSaveItNowIt', 'Token created — save it now, it won&apos;t be shown again')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-white border border-green-200 text-sm font-mono text-gray-800 break-all">
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
              {getText('merchant.settings.apiToken.dismiss', 'Dismiss')}
            </Button>
          </div>
        )}

        {/* Create form */}
        {showCreateForm && (
          <div className="rounded-2xl border border-gray-100 bg-gray-50/30 p-5 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {getText('merchant.settings.apiToken.label', 'Label')}
              </Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder={getText('merchant.settings.apiToken.eGClaudeDesktopPersonal', 'e.g. Claude Desktop - Personal')}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {getText('merchant.settings.apiToken.scopes', 'Scopes')}
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
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">{getText(opt.labelKey, opt.label)}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCreate}
                disabled={creating}
                className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700"
              >
                {creating ? getText('merchant.settings.apiToken.creating', 'Creating...') : getText('merchant.settings.apiToken.createToken', 'Create Token')}
              </Button>
              <Button
                onClick={() => setShowCreateForm(false)}
                variant="outline"
                className="h-9 px-4 rounded-xl"
              >
                {getText('merchant.settings.apiToken.cancel', 'Cancel')}
              </Button>
            </div>
          </div>
        )}

        {/* Token list */}
        {loading ? (
          <p className="text-sm text-gray-500">{getText('merchant.settings.apiToken.loadingTokens', 'Loading tokens...')}</p>
        ) : tokens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Key className="h-8 w-8 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">{getText('merchant.settings.apiToken.noApiTokensYet', 'No API tokens yet')}</p>
            <p className="text-xs text-gray-400 mt-1">
              {getText('merchant.settings.apiToken.createATokenToEnableMcp', 'Create a token to enable MCP server or other integrations')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 p-4 hover:bg-gray-50/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {token.label}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {token.scopes.map((scope) => (
                      <span
                        key={scope}
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide',
                          scope === '*'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700',
                        )}
                      >
                        {scopeLabel(getText, scope)}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {getText('merchant.settings.apiToken.created', 'Created:')} {formatDate(token.createdAt)}
                    {token.lastUsedAt && ` · Last used: ${formatDate(token.lastUsedAt)}`}
                  </p>
                </div>
                <Button
                  onClick={() => handleRevoke(token.id)}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Info banner */}
        <div className="flex items-start gap-2 rounded-xl bg-blue-50/50 border border-blue-100 p-3">
          <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            {getText('merchant.settings.apiToken.apiTokensEnableAiAgentsClaude', 'API tokens enable AI agents (Claude Desktop, Claude Code) to interact with your store. Use the MCP server with')} <code className="font-mono text-blue-800">JIFFOO_API_TOKEN</code> {getText('merchant.settings.apiToken.envVar', 'env var.')}
          </p>
        </div>
      </div>
    </div>
  )
}
