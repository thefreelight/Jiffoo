'use client'

import { useEffect, useState } from 'react'
import { plainText } from '@/lib/plain-text'

/**
 * A line of the not-found page. That page sits outside the locale segment, where no provider reaches, so the
 * language is read from the address once the page is in the browser; the English shows until then.
 */
export function NotFoundLine({ k, fallback }: { k: string; fallback: string }) {
  const [text, setText] = useState(fallback)

  useEffect(() => {
    setText(plainText(k, fallback))
  }, [k, fallback])

  return <>{text}</>
}
