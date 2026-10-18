'use client';
import { useState } from 'react';
import { useT } from 'shared/src/i18n/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { resolveApiErrorMessage } from '@/lib/error-utils';

interface ProfileSecurityCardProps {
  initialEmail: string; isProfileLoading: boolean; isUpdatingEmail: boolean; isChangingPassword: boolean;
  onUpdateEmail: (payload: { newEmail: string; currentPassword: string }) => Promise<unknown>;
  onChangePassword: (payload: { currentPassword: string; newPassword: string }) => Promise<unknown>;
}
export function ProfileSecurityCard({ initialEmail, isProfileLoading, isUpdatingEmail, isChangingPassword, onUpdateEmail, onChangePassword }: ProfileSecurityCardProps) {
  const t = useT(), c = (key: string) => t('merchant.profileView.' + key);
  const [dialog, setDialog] = useState<'email' | 'password' | null>(null), [email, setEmail] = useState(''), [current, setCurrent] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState(''), [failure, setFailure] = useState(''), [wrongPassword, setWrongPassword] = useState(false);
  const busy = isChangingPassword || isUpdatingEmail;
  const close = () => { setDialog(null); setCurrent(''); setPassword(''); setConfirm(''); setFailure(''); setWrongPassword(false); };
  const open = (kind: 'email' | 'password') => { setEmail(''); setCurrent(''); setPassword(''); setConfirm(''); setFailure(''); setWrongPassword(false); setDialog(kind); };
  return <section aria-labelledby="profile-security" className="overflow-hidden rounded-lg border border-border"><h2 id="profile-security" className="border-b border-border px-4 py-3 font-semibold">{c('security')}</h2><dl className="px-4 py-1">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border py-3"><dt className="w-24 text-muted-foreground">{c('email')}</dt><dd className="min-w-0 flex-[1_1_200px] break-all">{initialEmail}<p className="mt-0.5 text-xs text-faint">{c('emailHint')}</p></dd><Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" disabled={isProfileLoading || busy} onClick={() => open('email')}>{c('changeEmail')}</Button></div>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"><dt className="w-24 text-muted-foreground">{c('password')}</dt><dd className="flex-[1_1_200px]"><span className="tracking-[2px]">••••••••</span><p className="mt-0.5 text-xs text-faint">{c('passwordHint')}</p></dd><Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" disabled={isProfileLoading || busy} onClick={() => open('password')}>{c('changePassword')}</Button></div>
  </dl><Dialog open={dialog !== null} onOpenChange={value => { if (!value && !busy) close(); }}><DialogContent showCloseButton={false} overlayClassName="bg-overlay/30" className="max-h-[calc(100dvh-32px)] w-[calc(100%_-_32px)] max-w-[420px] overflow-y-auto rounded-xl p-5"><DialogHeader><DialogTitle className="text-[15px]">{c(dialog === 'email' ? 'emailTitle' : 'changePassword')}</DialogTitle><DialogDescription className={dialog === 'email' ? '' : 'sr-only'}>{c(dialog === 'email' ? 'emailNote' : 'passwordNote')}</DialogDescription></DialogHeader>
    <form className="space-y-3.5" onSubmit={async event => { event.preventDefault(); setFailure(''); setWrongPassword(false); if (dialog === 'password' && password.length < 8) { setFailure(c('minimum')); return; } if (dialog === 'password' && password !== confirm) { setFailure(c('mismatch')); return; } try { if (dialog === 'email') await onUpdateEmail({ newEmail: email.trim(), currentPassword: current }); else await onChangePassword({ currentPassword: current, newPassword: password }); close(); } catch (error) { const wrong = (error as { code?: string }).code === 'INVALID_PASSWORD'; setWrongPassword(wrong); setFailure(wrong ? c('wrongPassword') : resolveApiErrorMessage(error, t)); } }}>
      {dialog === 'email' && <label className="block space-y-1.5">{c('newEmail')}<Input type="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>}
      <label className="block space-y-1.5">{c('currentPassword')}<Input type="password" required autoComplete="current-password" value={current} aria-invalid={wrongPassword} aria-describedby={wrongPassword ? 'current-password-error' : undefined} onChange={event => setCurrent(event.target.value)} /></label>
      {wrongPassword && <p id="current-password-error" role="alert" className="text-xs text-destructive">{failure}</p>}
      {dialog === 'email' ? <p className="text-xs text-faint">{c('confirmIdentity')}</p> : <><label className="block space-y-1.5">{c('newPassword')}<Input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label><p className="text-xs text-faint">{c('minimum')}</p><label className="block space-y-1.5">{c('confirmPassword')}<Input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} /></label><p className="text-xs text-muted-foreground">{c('passwordNote')}</p></>}
      {failure && !wrongPassword && <p role="alert" className="text-xs text-destructive">{failure}</p>}
      <DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={busy} onClick={close}>{t('common.actions.cancel')}</Button><Button type="submit" disabled={busy || !current || (dialog === 'email' ? !email.trim() : !password || !confirm)}>{c(dialog === 'email' ? 'changeEmail' : 'changePassword')}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog></section>;
}
