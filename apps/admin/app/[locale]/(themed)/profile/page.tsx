'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useT } from 'shared/src/i18n/react';
import { formatStoreTimestamp } from 'shared';
import { useStoreDate } from '@/lib/store-time';
import { useAccountProfile, useChangePassword, useUpdateAccountEmail, useUpdateAccountProfile, useUploadAvatar } from '@/lib/hooks/use-api';
import { accountApi, unwrapApiResponse } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { registerNavigationGuard } from '@/lib/pending-navigation';
import { resolveApiErrorMessage } from '@/lib/error-utils';
import { ProfileSecurityCard } from '@/components/profile/ProfileSecurityCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';

export default function ProfilePage() {
  const t = useT(), locale = useLocale(), router = useRouter(), { timezone } = useStoreDate();
  const c = (key: string, values?: Record<string, string | number>) => t('merchant.profileView.' + key, values);
  const profile = useAccountProfile(), update = useUpdateAccountProfile(), email = useUpdateAccountEmail(), password = useChangePassword(), upload = useUploadAvatar();
  const [draft, setDraft] = useState({ username: '', locale: locale as string }), [savedAt, setSavedAt] = useState(''), [failure, setFailure] = useState(''), [picture, setPicture] = useState<string | null | undefined>(undefined), [avatarBusy, setAvatarBusy] = useState(false), [destination, setDestination] = useState<null | (() => void)>(null);
  const baseline = useRef<{ username: string; locale: string } | null>(null), dirtyRef = useRef(false), bypass = useRef(false), saving = useRef(false), file = useRef<HTMLInputElement>(null), nameInput = useRef<HTMLInputElement>(null);
  const dirty = baseline.current !== null && JSON.stringify(draft) !== JSON.stringify(baseline.current);
  dirtyRef.current = dirty;
  useEffect(() => { if (profile.data && !baseline.current) { const value = { username: profile.data.username, locale: profile.data.locale ?? locale }; baseline.current = value; setDraft(value); setSavedAt(profile.data.updatedAt); } }, [profile.data, locale]);
  useEffect(() => {
    const unregister = registerNavigationGuard(resume => { if (!dirtyRef.current || bypass.current) return false; setDestination(() => resume); return true; });
    const unload = (event: BeforeUnloadEvent) => { if (dirtyRef.current && !bypass.current) { event.preventDefault(); event.returnValue = ''; } };
    const click = (event: MouseEvent) => {
      if (!dirtyRef.current || bypass.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return;
      event.preventDefault(); event.stopPropagation(); setDestination(() => () => router.push(url.pathname + url.search + url.hash));
    };
    document.addEventListener('click', click, true); window.addEventListener('beforeunload', unload);
    return () => { unregister(); document.removeEventListener('click', click, true); window.removeEventListener('beforeunload', unload); };
  }, [router]);
  const discard = () => { if (baseline.current) setDraft({ ...baseline.current }); setFailure(''); };
  const save = async (leaving = false) => {
    if (saving.current) return false;
    if (draft.username.trim().length < 3 || draft.username.trim().length > 50) { setFailure(c('nameRequired')); nameInput.current?.focus(); return false; }
    saving.current = true; setFailure('');
    try { const result = await update.mutateAsync({ username: draft.username.trim(), locale: draft.locale }); const value = { username: result.username, locale: result.locale ?? draft.locale }; baseline.current = value; setDraft(value); setSavedAt(result.updatedAt); dirtyRef.current = false; if (!leaving && draft.locale !== locale) { bypass.current = true; router.replace('/' + draft.locale + '/profile'); } return true; }
    catch (error) { setFailure(resolveApiErrorMessage(error, t)); return false; } finally { saving.current = false; }
  };
  if (profile.isLoading) return <p role="status">{c('loading')}</p>;
  if (profile.error || !profile.data) return <div role="alert"><p>{profile.error ? resolveApiErrorMessage(profile.error, t) : t('common.errors.notFound')}</p><Button variant="outline" onClick={() => profile.refetch()}>{t('merchant.orders.list.retry')}</Button></div>;
  const avatar = picture === undefined ? profile.data.avatar : picture, busy = update.isPending || upload.isPending || avatarBusy;
  return <section className="mx-auto min-w-0 max-w-[760px] [&:not(:first-child)]:mt-6"><header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-ground px-4 pb-4 pt-5 sm:px-8"><div className="space-y-1"><h1 className="text-[22px] font-semibold tracking-[-0.02em]">{c('title')}</h1><p className="text-muted-foreground">{c('description')}</p></div><div className="flex flex-wrap items-center gap-2.5"><span className={'text-xs ' + (dirty ? 'text-attention' : 'text-faint')}>{dirty ? c('dirty') : savedAt ? c('saved', { time: formatStoreTimestamp(savedAt, timezone) + ' (' + timezone + ')' }) : ''}</span>{dirty && <Button variant="outline" size="sm" disabled={busy} onClick={discard}>{c('discard')}</Button>}<Button size="sm" className={!dirty ? "bg-raised text-faint disabled:opacity-100" : undefined} disabled={!dirty || busy} onClick={() => void save()}>{t('common.actions.save')}</Button></div></header>
    <div className="space-y-5 px-4 pb-16 pt-6 sm:px-8">{failure && <p role="alert" className="text-destructive">{failure}</p>}<section aria-labelledby="profile-basic" className="overflow-hidden rounded-lg border border-border"><h2 id="profile-basic" className="border-b border-border px-4 py-3 font-semibold">{c('basic')}</h2><div className="space-y-[18px] p-4"><div className="flex flex-wrap items-center gap-3.5">{avatar ? <img alt={draft.username} src={avatar} className="size-14 shrink-0 rounded-full border border-border object-cover" /> : <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-full border border-border bg-raised text-lg text-muted-foreground">{(draft.username || profile.data.email).slice(0, 1).toUpperCase()}</span>}<div className="space-y-1.5"><div className="flex gap-2"><Button type="button" variant="outline" size="sm" className="h-[30px]" disabled={busy} onClick={() => file.current?.click()}>{c('upload')}</Button><input ref={file} type="file" aria-label={c('upload')} accept="image/jpeg,image/png,image/webp" hidden disabled={busy} onChange={async event => { const chosen = event.target.files?.[0]; if (!chosen) return; setFailure(''); try { const result = await upload.mutateAsync(chosen); setPicture(result.url); } catch (error) { setFailure(resolveApiErrorMessage(error, t)); } finally { if (file.current) file.current.value = ''; } }} /><Button variant="ghost" size="sm" className="h-[30px] text-muted-foreground" disabled={!avatar || busy} onClick={async () => { setAvatarBusy(true); setFailure(''); try { const result = unwrapApiResponse(await accountApi.removeAvatar()); setPicture(null); const user = useAuthStore.getState().user; if (user) useAuthStore.getState().updateUser({ ...user, avatar: result.avatar ?? undefined }); await profile.refetch(); } catch (error) { setFailure(resolveApiErrorMessage(error, t)); } finally { setAvatarBusy(false); } }}>{c('remove')}</Button></div><p className="text-xs text-faint">{c('avatarHint')}</p></div></div>
      <label className="block max-w-[400px] space-y-1.5">{c('name')}<Input ref={nameInput} aria-label={c('name')} aria-describedby="profile-name-hint" value={draft.username} disabled={busy} maxLength={50} onChange={event => setDraft(current => ({ ...current, username: event.target.value }))} className="h-[34px]" /><span id="profile-name-hint" className="block text-xs text-faint">{c('nameHint')}</span></label>
      <div className="max-w-[400px] space-y-1.5"><label htmlFor="profile-language">{c('language')}</label><Select value={draft.locale} onValueChange={value => setDraft(current => ({ ...current, locale: value }))} disabled={busy}><SelectTrigger id="profile-language" aria-label={c('language')} className="h-[34px]"><SelectValue /></SelectTrigger><SelectContent>{[['zh-Hans', t('merchant.shell.simplifiedChinese')], ['zh-Hant', t('merchant.shell.traditionalChinese')], ['en', t('merchant.shell.english')]].map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><p className="text-xs text-faint">{c('languageHint')}</p></div>
    </div></section><ProfileSecurityCard initialEmail={profile.data.email} isProfileLoading={profile.isLoading} isUpdatingEmail={email.isPending} isChangingPassword={password.isPending} onUpdateEmail={value => email.mutateAsync(value)} onChangePassword={value => password.mutateAsync(value)} /></div>
    <AlertDialog open={destination !== null} onOpenChange={open => { if (!open && !busy) setDestination(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{c('leaveTitle')}</AlertDialogTitle><AlertDialogDescription>{c('leaveNote')}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="gap-2"><Button variant="outline" disabled={busy} onClick={() => setDestination(null)}>{c('keepEditing')}</Button><Button variant="outline" disabled={busy} onClick={() => { bypass.current = true; dirtyRef.current = false; destination?.(); setDestination(null); }}>{c('leaveWithout')}</Button><Button disabled={busy} onClick={async () => { if (await save(true)) { bypass.current = true; destination?.(); setDestination(null); } }}>{c('saveLeave')}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
