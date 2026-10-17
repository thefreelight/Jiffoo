'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT } from 'shared/src/i18n/react';
import { formatStoreTimestamp } from 'shared';
import { apiClient, unwrapApiResponse } from '@/lib/api';
import { useStoreDate } from '@/lib/store-time';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';

interface Token { id: string; label: string; scopes: string[]; createdAt: string; lastUsedAt: string | null }
const scopes = { 'catalog:read': 'catalog', 'cart:write': 'cart', 'checkout:create': 'order', 'orders:read': 'orders', '*': 'allAccess' };

export function ApiTokenPanel() {
  const t = useT(), c = (key: string, values?: Record<string, string | number>) => t(`merchant.settingsView.${key}`, values), { timezone } = useStoreDate();
  const [tokens, setTokens] = useState<Token[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(false), [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false), [label, setLabel] = useState(''), [selectedScopes, setSelectedScopes] = useState(['catalog:read']), [validation, setValidation] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null), [copied, setCopied] = useState(false), [revoking, setRevoking] = useState<Token | null>(null);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => { setLoading(true); try { setTokens(unwrapApiResponse(await apiClient.get<Token[]>('/admin/api-tokens'))); setLoaded(true); setError(false); } catch { setError(true); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const date = (value: string) => formatStoreTimestamp(value, timezone);
  async function create() {
    if (busy) return;
    if (!label.trim() || !selectedScopes.length) { setValidation(true); return; }
    setBusy(true); setError(false); setValidation(false);
    try { const result = unwrapApiResponse(await apiClient.post<{ token: string }>('/admin/api-tokens', { label: label.trim(), scopes: selectedScopes })); setNewToken(result.token); setCopied(false); setOpen(false); setLabel(''); setSelectedScopes(['catalog:read']); await load(); }
    catch { setError(true); } finally { setBusy(false); }
  }
  async function revoke() {
    if (!revoking || busy) return;
    setBusy(true); setError(false);
    try { await apiClient.delete(`/admin/api-tokens/${encodeURIComponent(revoking.id)}`); setRevoking(null); await load(); }
    catch { setError(true); } finally { setBusy(false); }
  }
  const permissionLabel = (value: string) => Object.prototype.hasOwnProperty.call(scopes, value) ? c(scopes[value as keyof typeof scopes]) : value;
  return <section id="tokens" aria-labelledby="token-title" className="scroll-mt-40 overflow-hidden rounded-[10px] border border-border text-[13px] text-foreground">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3"><div className="space-y-0.5"><h2 id="token-title" className="font-semibold">{c('tokens')}</h2><p className="text-xs leading-relaxed text-faint">{c('tokenHint')}</p></div><Button size="sm" variant="outline" onClick={() => { setOpen(true); setError(false); setValidation(false); }}>{c('createToken')}</Button></div>
    {error && <div role="alert" className="p-4 text-destructive">{c('tokenFailed')} <Button size="sm" variant="outline" disabled={busy} onClick={() => void load()}>{c('retry')}</Button></div>}
    {newToken && <div role="status" className="mx-4 mt-3 space-y-2 rounded-[10px] border border-attention-line bg-attention-soft px-3.5 py-3"><p className="font-medium text-attention">{c('tokenOnce')}</p><div className="flex gap-2"><Input readOnly aria-label={c('newToken')} value={newToken} className="min-w-0 flex-1 bg-ground font-mono text-xs" /><Button size="sm" onClick={async () => { try { await navigator.clipboard.writeText(newToken); setCopied(true); } catch { setError(true); } }}>{c(copied ? 'copied' : 'copy')}</Button></div></div>}
    {loading ? <p role="status" className="p-4 text-muted-foreground">{c('tokenLoading')}</p> : !loaded ? null : !tokens.length ? <p className="p-4 text-muted-foreground">{c('noTokens')}</p> : <>
      <table className="hidden w-full border-collapse text-left sm:table"><thead className="text-xs text-faint"><tr>{['tokenName', 'permissions', 'lastUsed'].map(key => <th key={key} className="px-4 py-2.5 font-medium">{c(key)}</th>)}<th><span className="sr-only">{c('revoke')}</span></th></tr></thead><tbody>{tokens.map(token => <tr key={token.id} className="border-t border-border"><td className="max-w-40 break-words px-4 py-2.5"><p className="font-medium">{token.label}</p><p className="text-xs text-faint">{c('created', { time: date(token.createdAt) })}</p></td><td className="max-w-48 px-3 py-2.5 text-muted-foreground">{token.scopes.map(permissionLabel).join(' · ')}</td><td className="px-3 py-2.5 text-muted-foreground">{token.lastUsedAt ? date(token.lastUsedAt) : c('neverUsed')}</td><td className="pr-4"><Button size="sm" variant="outline" aria-label={c('revokeName', { name: token.label })} onClick={() => setRevoking(token)}>{c('revoke')}</Button></td></tr>)}</tbody></table>
      <div className="space-y-3 p-4 sm:hidden">{tokens.map(token => <article key={token.id} aria-label={token.label} className="space-y-2 rounded-[7px] border border-border p-3"><h3 className="break-words font-medium">{token.label}</h3><p className="text-xs text-faint">{c('created', { time: date(token.createdAt) })}</p><p className="text-muted-foreground">{token.scopes.map(permissionLabel).join(' · ')}</p><p className="text-xs text-faint">{c('lastUsed')}: {token.lastUsedAt ? date(token.lastUsedAt) : c('neverUsed')}</p><Button size="sm" variant="outline" aria-label={c('revokeName', { name: token.label })} onClick={() => setRevoking(token)}>{c('revoke')}</Button></article>)}</div>
    </>}
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent className="w-[calc(100%-32px)]"><DialogHeader><DialogTitle>{c('createToken')}</DialogTitle><DialogDescription>{c('tokenHint')}</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={event => { event.preventDefault(); void create(); }}><label className="block space-y-1.5">{c('tokenName')}<Input maxLength={100} value={label} disabled={busy} onChange={event => setLabel(event.target.value)} /></label><fieldset disabled={busy} className="space-y-2"><legend className="mb-2">{c('permissions')}</legend>{Object.entries(scopes).map(([value, key]) => <label key={value} className="flex items-center gap-2"><input type="checkbox" checked={selectedScopes.includes(value)} onChange={() => setSelectedScopes(current => current.includes(value) ? current.filter(scope => scope !== value) : [...current, value])} />{c(key)}</label>)}</fieldset>{validation && <p role="alert" className="text-destructive">{c('tokenRequired')}</p>}{error && <p role="alert" className="text-destructive">{c('tokenFailed')}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>{c('cancel')}</Button><Button type="submit" disabled={busy}>{c('createToken')}</Button></div></form></DialogContent></Dialog>
    <AlertDialog open={!!revoking} onOpenChange={value => { if (!value && !busy) setRevoking(null); }}><AlertDialogContent className="w-[calc(100%-32px)]"><AlertDialogHeader><AlertDialogTitle>{c('revokeName', { name: revoking?.label ?? '' })}</AlertDialogTitle><AlertDialogDescription>{c('revokeNote')}</AlertDialogDescription></AlertDialogHeader>{error && <p role="alert" className="text-destructive">{c('tokenFailed')}</p>}<AlertDialogFooter><Button variant="outline" disabled={busy} onClick={() => setRevoking(null)}>{c('cancel')}</Button><Button variant="destructive" disabled={busy} onClick={() => void revoke()}>{c('revoke')}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
