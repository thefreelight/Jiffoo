'use client'

import { useEffect } from 'react'
import { plainText } from '@/lib/plain-text'

// This page replaces the whole document, providers included, so it reads the dictionary itself.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html>
      <body>
        <h2>{plainText('common.globalError.title', 'Something went wrong!')}</h2>
        <button onClick={() => reset()}>{plainText('common.globalError.retry', 'Try again')}</button>
      </body>
    </html>
  )
}
