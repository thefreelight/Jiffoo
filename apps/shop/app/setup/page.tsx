'use client'

/**
 * Setup / Onboarding Page
 *
 * Rendered when the shop has no API URL configured (NEXT_PUBLIC_API_URL not set).
 * Provides:
 * 1. Input to connect a self-hosted API instance
 * 2. External link to managed/hosted deployment options
 *
 * This is a static, client-side implementation — no server logic.
 * When the user enters an API URL, it's saved to localStorage and the page reloads.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Cloud, Server, CheckCircle2 } from 'lucide-react'

export default function SetupPage() {
  const router = useRouter()
  const [apiUrl, setApiUrl] = useState('')
  const [saved, setSaved] = useState(false)

  const handleConnect = () => {
    const trimmed = apiUrl.trim()
    if (!trimmed) return

    // Save to localStorage so the app can pick it up on reload
    localStorage.setItem('jiffoo:api-url', trimmed)
    setSaved(true)

    // Reload after a brief delay to let the user see the confirmation
    setTimeout(() => {
      window.location.href = '/'
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 mb-4">
            <Cloud className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Welcome to Jiffoo
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Let&apos;s get your store connected. Choose an option below to begin.
          </p>
        </div>

        {/* Option 1: Connect self-hosted API */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                Connect your own API instance
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                If you&apos;ve deployed the Jiffoo API on your own server, enter its URL here.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <input
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://api.yourstore.com"
              className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            />
            <button
              onClick={handleConnect}
              disabled={!apiUrl.trim() || saved}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all"
            >
              {saved ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Connected! Reloading...
                </>
              ) : (
                <>
                  Connect
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Option 2: Hosted / Managed deployment */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 shrink-0">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                Deploy with Jiffoo Cloud
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Let us handle hosting, updates, and infrastructure. Start in minutes.
              </p>
            </div>
          </div>

          <a
            href="https://jiffoo.com/cloud"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 text-sm font-semibold text-purple-600 hover:text-purple-700"
          >
            Explore managed hosting
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        {/* Deploy to Cloudflare hint */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            Prefer self-hosting?{' '}
            <a
              href="https://jiffoo.com/docs/deploy/cloudflare-pages"
              target="_blank"
              rel="noreferrer noopener"
              className="font-semibold text-gray-600 hover:text-gray-800 underline underline-offset-2"
            >
              Deploy to Cloudflare
            </a>
            {' '}in one click.
          </p>
        </div>
      </div>
    </div>
  )
}
