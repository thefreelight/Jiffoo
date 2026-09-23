'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useLocale } from 'shared/src/i18n/react'
import { authApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function ResetPasswordForm() {
  const token = useSearchParams().get('token') || ''
  const locale = useLocale()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    setError('')
    try {
      await authApi.resetPassword({ token, newPassword: password })
      setDone(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Invalid or expired reset link')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 p-6">
      <h1 className="text-2xl font-semibold">Reset password</h1>
      {done ? <p>Password updated.</p> : !token ? <p>Invalid reset link.</p> : (
        <form onSubmit={submit} className="space-y-4">
          <label htmlFor="password" className="block text-sm font-medium">New password</label>
          <Input id="password" type="password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} />
          <label htmlFor="confirm" className="block text-sm font-medium">Confirm password</label>
          <Input id="confirm" type="password" minLength={6} required value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={busy}>Reset password</Button>
        </form>
      )}
      <Link href={`/${locale}/auth/login`} className="text-sm text-blue-700">Back to sign in</Link>
    </main>
  )
}

export default function ResetPasswordPage() {
  return <Suspense><ResetPasswordForm /></Suspense>
}
