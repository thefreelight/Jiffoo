'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, Check, Database, Eye, EyeOff, Loader2, LockKeyhole, Store } from 'lucide-react'
import { useLocale } from 'shared/src/i18n/react'
import { useAuthStore } from '@/lib/store'
import { JiffooMark } from '@/components/branding/jiffoo-mark'

type InstallStatus = { isInstalled: boolean; version?: string; siteName?: string }
type DatabaseStatus = { connected: boolean; error?: string }
type InstallResult = { success: boolean; error?: string }

function getApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_URL || '/api/v1').replace(/\/$/, '')
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error || data?.message || 'Request failed')
  return data as T
}

const inputClass = 'h-12 w-full rounded-md border border-surface/10 bg-surface/[0.045] px-3.5 text-sm font-medium text-surface outline-none transition placeholder:text-contrast-strong focus:border-positive-light/70 focus:bg-surface/[0.07] focus:ring-2 focus:ring-positive-light/10'

export default function InstallPage() {
  const router = useRouter()
  const locale = useLocale()
  const { login } = useAuthStore()
  const [siteName, setSiteName] = useState('Jiffoo')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [installStatus, setInstallStatus] = useState<InstallStatus | null>(null)
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(null)
  const [isChecking, setIsChecking] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const connectionLabel = useMemo(() => {
    if (isChecking) return 'Checking database'
    return databaseStatus?.connected ? 'Database ready' : 'Database unavailable'
  }, [databaseStatus?.connected, isChecking])

  useEffect(() => {
    let cancelled = false
    Promise.all([requestJson<InstallStatus>('/install/status'), requestJson<DatabaseStatus>('/install/check-database')])
      .then(([status, database]) => {
        if (cancelled) return
        setInstallStatus(status)
        setDatabaseStatus(database)
        if (status.isInstalled) router.replace(`/${locale}/auth/login`)
      })
      .catch((reason) => !cancelled && setError(reason instanceof Error ? reason.message : 'Unable to load setup status'))
      .finally(() => !cancelled && setIsChecking(false))
    return () => { cancelled = true }
  }, [locale, router])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!databaseStatus?.connected) return setError('Database connection is not ready yet.')
    if (!siteName.trim()) return setError('Enter an instance name.')
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}$/.test(username.trim())) return setError('Use 2–64 letters, numbers, dots, dashes, or underscores for the login name.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Enter a valid email address.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirmPassword) return setError('Passwords do not match.')
    setIsSubmitting(true)
    try {
      const result = await requestJson<InstallResult>('/install/complete', {
        method: 'POST',
        body: JSON.stringify({ siteName: siteName.trim(), adminUsername: username.trim(), adminEmail: email.trim(), adminPassword: password }),
      })
      if (!result.success) throw new Error(result.error || 'Installation failed')
      try {
        await login(username.trim(), password)
        router.replace(`/${locale}/dashboard`)
      } catch {
        router.replace(`/${locale}/auth/login`)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Installation failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const blocked = isChecking || isSubmitting || installStatus?.isInstalled || !databaseStatus?.connected

  return (
    <main className="min-h-screen bg-install-background text-contrast-faint">
      <div className="mx-auto grid min-h-screen w-full max-w-[1440px] lg:grid-cols-[360px_1fr]">
        <aside className="relative overflow-hidden border-b border-surface/10 bg-install-surface px-6 py-7 lg:border-b-0 lg:border-r lg:px-9 lg:py-10">
          <div className="absolute inset-x-0 top-0 h-1 bg-positive-light" />
          <JiffooMark size="md" className="[&_span:last-child]:text-contrast-faint" />

          <div className="mt-12 lg:mt-24">
            <p className="text-xs font-semibold uppercase text-positive-light">Initial setup</p>
            <h1 className="mt-4 max-w-xs text-3xl font-semibold leading-tight">Make this store yours.</h1>
            <p className="mt-3 max-w-xs text-sm leading-6 text-contrast-base">Create the owner account and open your workspace.</p>
          </div>

          <ol className="mt-9 grid gap-3 sm:grid-cols-3 lg:mt-14 lg:grid-cols-1">
            <SetupStep icon={Database} index="01" title="Database" detail={connectionLabel} complete={Boolean(databaseStatus?.connected)} />
            <SetupStep icon={LockKeyhole} index="02" title="Owner account" detail="Current step" active />
            <SetupStep icon={Store} index="03" title="Workspace" detail="Ready next" />
          </ol>
        </aside>

        <section className="flex items-center justify-center px-5 py-10 sm:px-10 lg:px-16">
          <div className="w-full max-w-xl">
            <div className="mb-8 flex items-center justify-between border-b border-surface/10 pb-5">
              <div><p className="text-sm text-contrast-base">Step 2 of 3</p><h2 className="mt-1 text-2xl font-semibold">Create owner account</h2></div>
              <span className={`inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs font-semibold ${databaseStatus?.connected ? 'border-positive-light/20 bg-positive-light/10 text-positive-pale' : 'border-surface/10 text-contrast-base'}`}>
                {isChecking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}{connectionLabel}
              </span>
            </div>

            {error ? <div className="mb-5 flex gap-3 rounded-md border border-danger-light/20 bg-danger-light/10 p-3 text-sm text-danger-soft"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div> : null}

            <form onSubmit={handleSubmit} className="space-y-5">
              <Field label="Login name" hint="Required">
                <input className={inputClass} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="admin" autoComplete="username" required />
              </Field>
              <Field label="Email" hint="Required">
                <input className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" autoComplete="email" required />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Password" hint="8+ characters">
                  <div className="relative"><input className={`${inputClass} pr-11`} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required minLength={8} /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-1 top-1 grid h-10 w-10 place-items-center text-contrast-base hover:text-surface" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
                </Field>
                <Field label="Confirm password"><input className={inputClass} type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required minLength={8} /></Field>
              </div>
              <Field label="Store name"><input className={inputClass} value={siteName} onChange={(event) => setSiteName(event.target.value)} required /></Field>

              <div className="flex flex-col-reverse gap-4 border-t border-surface/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-contrast-strong">The owner account has full administrative access.</p>
                <button type="submit" disabled={Boolean(blocked)} className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-positive-light px-5 text-sm font-bold text-install-foreground transition hover:bg-positive-pale disabled:cursor-not-allowed disabled:opacity-40">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Create workspace<ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 flex items-center justify-between text-sm font-medium"><span>{label}</span>{hint ? <span className="text-xs font-normal text-contrast-strong">{hint}</span> : null}</span>{children}</label>
}

function SetupStep({ icon: Icon, index, title, detail, active, complete }: { icon: typeof Database; index: string; title: string; detail: string; active?: boolean; complete?: boolean }) {
  return <li className={`flex min-h-[68px] items-center gap-3 rounded-md border p-3 ${active ? 'border-positive-light/30 bg-positive-light/[0.07]' : 'border-surface/[0.07] bg-surface/[0.02]'}`}><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${complete ? 'bg-positive-light text-install-foreground' : active ? 'bg-surface text-overlay-ink' : 'bg-surface/[0.05] text-contrast-strong'}`}>{complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</div><div className="min-w-0"><p className="text-[10px] font-semibold text-contrast-strong">{index}</p><p className="text-sm font-semibold">{title}</p><p className={`truncate text-xs ${active ? 'text-positive-pale' : 'text-contrast-strong'}`}>{detail}</p></div></li>
}
