'use client'

import { useState } from 'react'
import { Copy, Link2 } from 'lucide-react'
import { usersApi, unwrapApiResponse, type UserProfile } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserProfile | null
}

export function GenerateResetLinkDialog({ open, onOpenChange, user }: Props) {
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const generate = async () => {
    if (!user) return
    setBusy(true)
    setError('')
    try {
      const result = unwrapApiResponse(await usersApi.generateResetLink(user.id))
      setLink(result.link)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to generate reset link')
    } finally {
      setBusy(false)
    }
  }

  const close = (value: boolean) => {
    if (!value) {
      setLink('')
      setError('')
    }
    onOpenChange(value)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate reset link</DialogTitle>
          <DialogDescription>{user?.email}</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {link ? (
          <div className="flex items-center gap-2">
            <input aria-label="Reset link" readOnly value={link} className="min-w-0 flex-1 rounded border p-2 text-sm" />
            <Button type="button" size="icon" title="Copy reset link" aria-label="Copy reset link" onClick={() => void navigator.clipboard.writeText(link)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button type="button" onClick={() => void generate()} disabled={busy || !user}>
            <Link2 className="mr-2 h-4 w-4" />Generate link
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
