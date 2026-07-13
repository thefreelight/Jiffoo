'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import { useLocale } from 'shared/src/i18n/react'
import { useAuthStore } from '@/lib/store'

type InstallStatus = {
  isInstalled: boolean
  version?: string
  siteName?: string
}

type DatabaseStatus = {
  connected: boolean
  error?: string
}

type InstallResult = {
  success: boolean
  error?: string
}

const setupSteps = [
  {
    id: 'database',
    title: 'Database check',
    description: 'Connection verified',
    state: 'done',
  },
  {
    id: 'admin',
    title: 'Admin account',
    description: 'Create Root identity',
    state: 'active',
  },
  {
    id: 'runtime',
    title: 'Runtime mode',
    description: 'Choose defaults',
    state: 'pending',
  },
  {
    id: 'finish',
    title: 'Finish setup',
    description: 'Enter console',
    state: 'pending',
  },
] as const

function getApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '')
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message = data?.error || data?.message || 'Request failed'
    throw new Error(message)
  }

  return data as T
}

export default function InstallPage() {
  const router = useRouter()
  const locale = useLocale()
  const { login } = useAuthStore()

  const [siteName, setSiteName] = useState('Jiffoo Commerce Core')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [installStatus, setInstallStatus] = useState<InstallStatus | null>(null)
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(null)
  const [isChecking, setIsChecking] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const databaseStep = useMemo(() => {
    if (isChecking) return { label: 'Checking connection', tone: 'checking' as const }
    if (databaseStatus?.connected) return { label: 'Connection verified', tone: 'ready' as const }
    return { label: 'Connection unavailable', tone: 'blocked' as const }
  }, [databaseStatus?.connected, isChecking])

  useEffect(() => {
    let cancelled = false

    async function loadStatus() {
      setIsChecking(true)
      setError('')

      try {
        const [status, database] = await Promise.all([
          requestJson<InstallStatus>('/install/status'),
          requestJson<DatabaseStatus>('/install/check-database'),
        ])

        if (cancelled) return

        setInstallStatus(status)
        setDatabaseStatus(database)

        if (status.isInstalled) {
          router.replace(`/${locale}/auth/login`)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load installation status')
        }
      } finally {
        if (!cancelled) setIsChecking(false)
      }
    }

    loadStatus()

    return () => {
      cancelled = true
    }
  }, [locale, router])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!databaseStatus?.connected) {
      setError('Database connection is not ready yet.')
      return
    }

    if (!siteName.trim()) {
      setError('Please enter an instance name.')
      return
    }

    if (!adminEmail.trim()) {
      setError('Please enter the admin email.')
      return
    }

    if (adminPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (adminPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await requestJson<InstallResult>('/install/complete', {
        method: 'POST',
        body: JSON.stringify({
          siteName: siteName.trim(),
          adminEmail: adminEmail.trim(),
          adminPassword,
          adminUsername: adminEmail.trim().split('@')[0],
        }),
      })

      if (!result.success) {
        throw new Error(result.error || 'Installation failed')
      }

      try {
        await login(adminEmail.trim(), adminPassword)
        router.replace(`/${locale}/dashboard`)
      } catch {
        router.replace(`/${locale}/auth/login`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Installation failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isBlocked = isChecking || isSubmitting || installStatus?.isInstalled || !databaseStatus?.connected

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f9fc] px-4 py-6 text-slate-950 sm:px-8 lg:px-12 lg:py-10">
      <div className="pointer-events-none absolute inset-0 opacity-[0.28] [background-image:linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] [background-size:34px_34px] lg:[background-size:48px_48px]" />
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[520px] rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl flex-col lg:min-h-[calc(100vh-5rem)]">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-400 to-blue-700 text-lg font-extrabold text-white shadow-[0_16px_30px_rgba(37,99,235,0.2)]">
              J
            </div>
            <span className="text-2xl font-extrabold tracking-[-0.04em]">Jiffoo</span>
          </div>
          <div className="hidden text-xs font-extrabold uppercase tracking-[0.18em] text-blue-600 sm:block">
            Initial Setup
          </div>
        </header>

        <section className="mt-8 overflow-hidden rounded-[2rem] border border-slate-200 bg-white/85 shadow-[0_34px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:mt-12">
          <div className="border-b border-slate-200 bg-gradient-to-b from-slate-50/80 to-white/70 px-6 py-7 sm:px-8 lg:px-14 lg:py-10">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-600 sm:hidden">
                  Mobile — Initial Setup
                </p>
                <h1 className="mt-3 text-4xl font-extrabold leading-none tracking-[-0.06em] sm:text-5xl lg:mt-0 lg:text-6xl">
                  System initialization
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 tracking-[-0.02em] text-slate-600 lg:text-lg">
                  A guided first-run timeline for bringing a fresh Jiffoo instance online. Complete the active step, then continue.
                </p>
              </div>

              <div className={`inline-flex h-9 w-fit items-center gap-2 rounded-full border px-4 text-sm font-extrabold ${databaseStep.tone === 'ready' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : databaseStep.tone === 'blocked' ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                {databaseStep.tone === 'checking' ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_0_6px_rgba(22,163,74,0.1)]" />}
                {databaseStep.label}
              </div>
            </div>

            <DesktopTimeline databaseLabel={databaseStep.label} />
          </div>

          <div className="grid lg:grid-cols-[0.42fr_0.58fr]">
            <aside className="border-b border-slate-200 bg-slate-50/40 px-6 py-7 sm:px-8 lg:border-b-0 lg:border-r lg:px-14 lg:py-10">
              <MobileTimeline databaseLabel={databaseStep.label} />

              <div className="mt-7 lg:mt-0">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-600">Current step / 02</p>
                <h2 className="mt-4 max-w-md text-4xl font-extrabold leading-[1.03] tracking-[-0.055em] lg:text-5xl">
                  Create the first administrator.
                </h2>
                <p className="mt-5 max-w-md text-base leading-7 text-slate-600">
                  This account becomes the Root administrator and unlocks the Jiffoo admin console after initialization.
                </p>

                <div className="mt-7 flex gap-4 rounded-3xl border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-950">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white">
                    <Check className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold">Previous step completed</p>
                    <p className="mt-1 text-sm leading-6 text-emerald-900/75">Database connection is healthy and ready for setup.</p>
                  </div>
                </div>
              </div>
            </aside>

            <section className="bg-white px-6 py-7 sm:px-8 lg:px-14 lg:py-10">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-3xl font-extrabold tracking-[-0.05em] lg:text-4xl">Administrator account</h3>
                <span className="hidden h-9 shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-extrabold text-slate-700 sm:inline-flex">
                  Step 2 of 4
                </span>
              </div>

              {error ? (
                <div className="mt-5 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                <Field label="Admin email">
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(event) => setAdminEmail(event.target.value)}
                    placeholder="admin@jiffoo.local"
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-base font-bold tracking-[-0.015em] text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    autoComplete="email"
                    required
                  />
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Password">
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(event) => setAdminPassword(event.target.value)}
                      placeholder="••••••••••••"
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-base font-bold tracking-[-0.015em] text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                  </Field>

                  <Field label="Confirm password">
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="••••••••••••"
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-base font-bold tracking-[-0.015em] text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                  </Field>
                </div>

                <Field label="Instance name">
                  <input
                    type="text"
                    value={siteName}
                    onChange={(event) => setSiteName(event.target.value)}
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-base font-bold tracking-[-0.015em] text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    required
                  />
                </Field>

                <div className="flex flex-col gap-4 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-md text-sm leading-6 text-slate-500">
                    Next: choose the default runtime mode. You can change store settings later.
                  </p>
                  <button
                    type="submit"
                    disabled={Boolean(isBlocked)}
                    className="inline-flex h-12 min-w-40 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-extrabold text-white shadow-[0_18px_38px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Continue
                  </button>
                </div>
              </form>
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-extrabold tracking-[-0.01em] text-slate-700">{label}</span>
      {children}
    </label>
  )
}

function DesktopTimeline({ databaseLabel }: { databaseLabel: string }) {
  return (
    <div className="relative mt-10 hidden grid-cols-4 lg:grid">
      <div className="absolute left-8 right-8 top-[27px] h-0.5 bg-slate-200" />
      <div className="absolute left-8 top-[27px] h-0.5 w-[calc((100%-4rem)/3)] bg-gradient-to-r from-emerald-600 to-blue-600" />
      {setupSteps.map((step, index) => (
        <TimelineStep
          key={step.id}
          index={index}
          title={step.title}
          description={step.id === 'database' ? databaseLabel : step.description}
          state={step.state}
          direction="horizontal"
        />
      ))}
    </div>
  )
}

function MobileTimeline({ databaseLabel }: { databaseLabel: string }) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-5 shadow-[0_22px_54px_rgba(15,23,42,0.07)] lg:hidden">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-xl font-extrabold tracking-[-0.04em]">Setup timeline</p>
        <span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-extrabold text-blue-600">Step 2 of 4</span>
      </div>
      <div className="space-y-0">
        {setupSteps.map((step, index) => (
          <TimelineStep
            key={step.id}
            index={index}
            title={step.title}
            description={step.id === 'database' ? databaseLabel : step.description}
            state={step.state}
            direction="vertical"
          />
        ))}
      </div>
    </div>
  )
}

function TimelineStep({
  index,
  title,
  description,
  state,
  direction,
}: {
  index: number
  title: string
  description: string
  state: 'done' | 'active' | 'pending'
  direction: 'horizontal' | 'vertical'
}) {
  const nodeClass = state === 'done'
    ? 'border-emerald-600 bg-emerald-600 text-white'
    : state === 'active'
      ? 'border-blue-600 bg-blue-600 text-white shadow-[0_0_0_8px_rgba(237,245,255,0.95),0_18px_34px_rgba(37,99,235,0.22)]'
      : 'border-slate-200 bg-slate-100 text-slate-500'

  if (direction === 'vertical') {
    return (
      <div className="relative grid min-h-[4.25rem] grid-cols-[2.5rem_1fr] gap-3 last:min-h-0">
        {index < setupSteps.length - 1 ? (
          <div className={`absolute left-[1.05rem] top-9 h-[calc(100%-2rem)] w-0.5 ${state === 'done' ? 'bg-gradient-to-b from-emerald-600 to-blue-600' : 'bg-slate-200'}`} />
        ) : null}
        <div className={`relative z-10 grid h-9 w-9 place-items-center rounded-full border text-sm font-extrabold ${nodeClass}`}>
          {state === 'done' ? <Check className="h-4 w-4" /> : index + 1}
        </div>
        <div>
          <p className="text-base font-extrabold tracking-[-0.02em] text-slate-950">{title}</p>
          <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative grid grid-cols-[4.25rem_1fr] gap-4">
      <div className={`relative z-10 grid h-14 w-14 place-items-center rounded-full border text-lg font-extrabold ring-8 ring-white/80 ${nodeClass}`}>
        {state === 'done' ? <Check className="h-6 w-6" /> : index + 1}
      </div>
      <div className="pt-1">
        <p className="text-lg font-extrabold tracking-[-0.02em] text-slate-950">{title}</p>
        <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  )
}
