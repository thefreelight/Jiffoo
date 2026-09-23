'use client'

import { useState } from 'react'
import { useLocale } from 'shared/src/i18n/react'
import Link from 'next/link'
import { authApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function ForgotPasswordPage() {
  const locale = useLocale()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await authApi.forgotPassword(email.trim().toLowerCase())
      setDone(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to request a reset link')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 p-6">
      <h1 className="text-2xl font-semibold">Forgot password</h1>
      {done ? (
        <p>If an account exists for that email, a reset link has been requested.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <Input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={busy}>Request reset link</Button>
        </form>
      )}
      <Link href={`/${locale}/auth/login`} className="text-sm text-blue-700">Back to sign in</Link>
    </main>
  )
}
