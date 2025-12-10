/**
 * Plugin Card Component
 *
 * Displays plugin information in a card format with i18n support.
 */

'use client'

import { Box, Star, Users, ShieldCheck, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import Link from 'next/link'
import { useT } from 'shared/src/i18n'

import { Plugin } from '../../lib/types'

interface PluginCardProps {
  plugin: Plugin & {
    icon?: string
    iconBgColor?: string
    isOfficial?: boolean
    verified?: boolean
    author?: string
  }
  isInstalled?: boolean
  onInstall?: () => void
  onViewDetails?: () => void
}

export function PluginCard({ plugin, isInstalled = false, onInstall, onViewDetails }: PluginCardProps) {
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    // If translation returns the key itself, use fallback
    return translated === key ? fallback : translated
  }

  const getBusinessModelBadge = (model: string) => {
    switch (model) {
      case 'free':
        return <Badge className="bg-green-100 text-green-800">{getText('tenant.plugins.model.free', 'Free')}</Badge>
      case 'freemium':
        return <Badge className="bg-blue-100 text-blue-800">{getText('tenant.plugins.model.freemium', 'Freemium')}</Badge>
      case 'subscription':
        return <Badge className="bg-purple-100 text-purple-800">{getText('tenant.plugins.model.subscription', 'Subscription')}</Badge>
      case 'usage_based':
        return <Badge className="bg-orange-100 text-orange-800">{getText('tenant.plugins.model.usageBased', 'Usage Based')}</Badge>
      default:
        return <Badge>{model}</Badge>
    }
  }

  // Render brand-specific plugin icon
  const renderPluginIcon = (p: typeof plugin) => {
    const slug = p.slug?.toLowerCase() || ''
    const name = p.name?.toLowerCase() || ''

    // Stripe
    if (slug.includes('stripe') || name.includes('stripe')) {
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
          <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
        </svg>
      )
    }

    // PayPal - Using official Simple Icons SVG
    if (slug.includes('paypal') || name.includes('paypal')) {
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
          <path d="M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686M9.653 5.546h6.408c.907 0 1.942.222 2.363.541-.195 2.741-2.655 5.483-6.441 5.483H8.714Z"/>
        </svg>
      )
    }

    // WeChat Pay
    if (slug.includes('wechat') || name.includes('wechat')) {
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
          <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.032zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
        </svg>
      )
    }

    // Alipay - Using official Simple Icons SVG
    if (slug.includes('alipay') || name.includes('alipay')) {
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
          <path d="M19.695 15.07c3.426 1.158 4.203 1.22 4.203 1.22V3.846c0-2.124-1.705-3.845-3.81-3.845H3.914C1.808.001.102 1.722.102 3.846v16.31c0 2.123 1.706 3.845 3.813 3.845h16.173c2.105 0 3.81-1.722 3.81-3.845v-.157s-6.19-2.602-9.315-4.119c-2.096 2.602-4.8 4.181-7.607 4.181-4.75 0-6.361-4.19-4.112-6.949.49-.602 1.324-1.175 2.617-1.497 2.025-.502 5.247.313 8.266 1.317a16.796 16.796 0 0 0 1.341-3.302H5.781v-.952h4.799V6.975H4.77v-.953h5.81V3.591s0-.409.411-.409h2.347v2.84h5.744v.951h-5.744v1.704h4.69a19.453 19.453 0 0 1-1.986 5.06c1.424.52 2.702 1.011 3.654 1.333m-13.81-2.032c-.596.06-1.71.325-2.321.869-1.83 1.608-.735 4.55 2.968 4.55 2.151 0 4.301-1.388 5.99-3.61-2.403-1.182-4.438-2.028-6.637-1.809"/>
        </svg>
      )
    }

    // Default icon
    if (p.icon?.startsWith('http')) {
      return (
        <img
          src={p.icon}
          alt={p.name}
          className="w-5 h-5"
          style={{ filter: 'brightness(0) invert(1)' }}
        />
      )
    }

    return <span className="text-lg">{p.icon || '📦'}</span>
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
        <span className="text-sm text-gray-600 ml-1">({rating.toFixed(1)})</span>
      </div>
    )
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {/* Plugin Icon - Brand specific logos */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: plugin.iconBgColor || '#EFF6FF' }}
              >
                {renderPluginIcon(plugin)}
              </div>
              <CardTitle className="text-lg">{plugin.name}</CardTitle>
              {/* Official Badge - Blue checkmark with tooltip */}
              {plugin.isOfficial && (
                <div className="relative group">
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center cursor-pointer">
                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                    Official
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              )}
              {plugin.verified && !plugin.isOfficial && (
                <div className="relative group">
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center cursor-pointer">
                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                    Verified
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              )}
            </div>
            <CardDescription className="line-clamp-2">{plugin.description}</CardDescription>
          </div>
          {isInstalled && (
            <Badge className="bg-green-100 text-green-800">{getText('tenant.plugins.installed', 'Installed')}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Rating and Stats */}
          <div className="flex items-center justify-between">
            {renderStars(plugin.rating)}
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <Users className="w-4 h-4" />
              <span>{plugin.installCount.toLocaleString()} {getText('tenant.plugins.installs', 'installs')}</span>
            </div>
          </div>

          {/* Category and Business Model */}
          <div className="flex items-center gap-2">
            <Badge variant="outline">{plugin.category}</Badge>
            {getBusinessModelBadge(plugin.businessModel)}
          </div>

          {/* Pricing */}
          {plugin.subscriptionPlans && plugin.subscriptionPlans.length > 0 && (
            <div className="text-sm">
              <span className="font-semibold">{getText('tenant.plugins.startingAt', 'Starting at')}: </span>
              <span className="text-lg font-bold text-blue-600">
                {plugin.subscriptionPlans[0].currency} {plugin.subscriptionPlans[0].amount}
              </span>
              <span className="text-gray-600">/{plugin.subscriptionPlans[0].billingCycle}</span>
            </div>
          )}

          {/* Developer */}
          <div className="text-sm text-gray-600">
            <span className="font-semibold">{getText('tenant.plugins.developer', 'Developer')}:</span> {plugin.developer || plugin.author}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onViewDetails}
              asChild
            >
              <Link href={`/plugins/marketplace/${plugin.slug}`}>
                {getText('tenant.plugins.viewDetails', 'View Details')}
              </Link>
            </Button>
            {!isInstalled && onInstall && (
              <Button
                className="flex-1"
                onClick={onInstall}
              >
                {getText('tenant.plugins.install', 'Install')}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

