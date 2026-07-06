'use client'

/**
 * Platform Offers Cards
 *
 * Display-only cards rendered in the Admin dashboard when platform-managed
 * offers are available. When no offers exist (or JIFFOO_DISABLE_PLATFORM_OFFERS=true),
 * nothing is rendered — no commercial content appears.
 */

import { useEffect, useState } from 'react'
import { ExternalLink, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PlatformOffer {
  id: string
  title: string
  description: string
  ctaLabel: string
  ctaUrl: string
  icon?: string
  badge?: string
}

interface PlatformOffersPayload {
  offers: PlatformOffer[]
  updatedAt: string | null
}

export function PlatformOffersCards() {
  const [offers, setOffers] = useState<PlatformOffer[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadOffers() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api/v1'
        const res = await fetch(`${apiUrl}/platform-offers`)
        if (!res.ok) return
        const json = await res.json()
        const data = json.data as PlatformOffersPayload | undefined
        if (!cancelled && data && Array.isArray(data.offers)) {
          setOffers(data.offers)
        }
      } catch {
        // Silently ignore — offers are non-critical
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }

    loadOffers()
    return () => {
      cancelled = true
    }
  }, [])

  // Don't render anything until loaded, and don't render if no offers
  if (!loaded || offers.length === 0) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {offers.map((offer) => (
        <div
          key={offer.id}
          className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
        >
          {/* Badge */}
          {offer.badge && (
            <div className="absolute top-3 right-3">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[9px] font-bold uppercase tracking-wide">
                <Sparkles className="h-3 w-3" />
                {offer.badge}
              </span>
            </div>
          )}

          <div className="p-5 space-y-3">
            {/* Title */}
            <h4 className="text-sm font-bold text-gray-900 leading-tight pr-8">
              {offer.title}
            </h4>

            {/* Description */}
            <p className="text-xs text-gray-500 leading-relaxed">
              {offer.description}
            </p>

            {/* CTA */}
            <a
              href={offer.ctaUrl}
              target="_blank"
              rel="noreferrer noopener"
              className={cn(
                'inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600',
                'hover:text-blue-700 transition-colors',
              )}
            >
              {offer.ctaLabel}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}
