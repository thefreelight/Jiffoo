/**
 * Settings page for Admin.
 *
 * This page only exposes settings backed by existing backend APIs.
 */

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, RefreshCw, Save, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { useT } from 'shared/src/i18n/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { resolveApiErrorMessage } from '@/lib/error-utils'
import { settingsApi, type SystemSettingsMap, unwrapApiResponse, upgradeApi } from '@/lib/api'
import { clearUpdateCheckCache } from '@/hooks/use-update-check'
import { cn } from '@/lib/utils'
import CurrencySettings from '@/components/settings/currency-settings'
import { ManagedLicensePanel } from '@/components/settings/ManagedLicensePanel'

type SettingField = {
  key: string
  labelKey: string
  labelFallback: string
  placeholder?: string
}

const CHECKOUT_COUNTRIES_KEY = 'checkout.address.countries_require_state_postal'
const POWERED_BY_JIFFOO_KEY = 'branding.powered_by_jiffoo_enabled'

const BRANDING_FIELDS: SettingField[] = [
  {
    key: 'branding.platform_name',
    labelKey: 'merchant.settings.general.storeName',
    labelFallback: 'Store Name',
    placeholder: 'Your store name',
  },
  {
    key: 'branding.logo',
    labelKey: 'merchant.settings.general.storeAvatar',
    labelFallback: 'Logo URL',
    placeholder: 'https://cdn.example.com/logo.png',
  },
  {
    key: 'branding.store_url',
    labelKey: 'merchant.settings.general.storeUrl',
    labelFallback: 'Store URL',
    placeholder: 'https://shop.example.com',
  },
  {
    key: 'branding.store_description',
    labelKey: 'merchant.settings.general.storeDescription',
    labelFallback: 'Store Description',
    placeholder: 'Brief description about your store',
  },
]

const LOCALIZATION_FIELDS: SettingField[] = [
  {
    key: 'localization.locale',
    labelKey: 'merchant.settings.localization.languageSettings',
    labelFallback: 'Language Settings',
    placeholder: 'en-US',
  },
  {
    key: 'localization.timezone',
    labelKey: 'merchant.settings.localization.timezone',
    labelFallback: 'Timezone',
    placeholder: 'UTC',
  },
]

// Localization options
const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD - US Dollar ($)' },
  { value: 'EUR', label: 'EUR - Euro (€)' },
  { value: 'GBP', label: 'GBP - British Pound (£)' },
  { value: 'CNY', label: 'CNY - Chinese Yuan (¥)' },
  { value: 'HKD', label: 'HKD - Hong Kong Dollar (HK$)' },
  { value: 'TWD', label: 'TWD - Taiwan Dollar (NT$)' },
]

const LOCALE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'zh-Hant', label: 'Traditional Chinese' },
]

const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles (PST/PDT)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong Kong (HKT)' },
  { value: 'Asia/Taipei', label: 'Asia/Taipei (CST)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
]

const THEME_FIELDS: SettingField[] = [
  {
    key: 'theme.active.shop.slug',
    labelKey: 'merchant.settings.sections.themes',
    labelFallback: 'Active Shop Theme',
  },
  {
    key: 'theme.active.admin.slug',
    labelKey: 'merchant.settings.sections.adminTheme',
    labelFallback: 'Active Admin Theme',
  },
]

function toMap(input: unknown): SystemSettingsMap {
  return input && typeof input === 'object' ? (input as SystemSettingsMap) : {}
}

function getString(input: unknown): string {
  return typeof input === 'string' ? input : ''
}

function buildDraft(source: SystemSettingsMap, keys: string[]): SystemSettingsMap {
  const next: SystemSettingsMap = {}
  keys.forEach((key) => {
    if (key === CHECKOUT_COUNTRIES_KEY) {
      const val = source[key]
      if (Array.isArray(val)) {
        next[key] = val.filter((item): item is string => typeof item === 'string').join(', ')
        return
      }
    }
    if (key === POWERED_BY_JIFFOO_KEY) {
      next[key] = source[key] !== false
      return
    }
    next[key] = getString(source[key])
  })
  return next
}

function parseCountryCodes(input: string): string[] {
  const normalized = input
    .split(/[,\n]/)
    .map((item) => item.trim().toUpperCase())
    .map((item) => (item === 'UK' ? 'GB' : item))
    .filter((item) => item.length > 0)
  return Array.from(new Set(normalized))
}

function normalizeUpgradeStatusView(status: {
  status: string
  progress: number
  currentStep?: string | null
  error?: string | null
  targetVersion?: string | null
  updatedAt?: string | null
} | null) {
  if (!status) return null
  if (status.status === 'idle' && !status.currentStep && !status.error) {
    return null
  }
  return status
}

export default function SettingsPage() {
  return <SettingsPageContent />
}

function SettingsPageContent() {
  const t = useT()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [checkingVersion, setCheckingVersion] = useState(false)
  const [startingUpgrade, setStartingUpgrade] = useState(false)
  const [finalizingUpgrade, setFinalizingUpgrade] = useState(false)
  const [settingsMap, setSettingsMap] = useState<SystemSettingsMap>({})
  const [draft, setDraft] = useState<SystemSettingsMap>({})
  const [initialDraft, setInitialDraft] = useState<SystemSettingsMap>({})
  const terminalUpgradeHandledRef = useRef<string | null>(null)
  const [upgradeStatus, setUpgradeStatus] = useState<{
    status: string
    progress: number
    currentStep?: string | null
    error?: string | null
    targetVersion?: string | null
    updatedAt?: string | null
  } | null>(null)
  const [versionInfo, setVersionInfo] = useState<{
    currentVersion: string
    latestVersion: string
    updateAvailable: boolean
    changelogUrl?: string | null
    sourceArchiveUrl?: string | null
    releaseDate?: string | null
    releaseChannel: 'stable' | 'prerelease'
    deploymentMode: 'single-host' | 'docker-compose' | 'k8s' | 'unsupported'
    deploymentModeSource: 'env' | 'k8s-signals' | 'compose-signals' | 'single-host-signals' | 'fallback'
    deploymentModeReason?: string | null
    oneClickUpgradeSupported: boolean
    updateSource: 'env-manifest' | 'default-public-manifest' | 'local-fallback'
    manifestUrl?: string | null
    manifestStatus: 'available' | 'missing' | 'unreachable' | 'invalid'
    manifestError?: string | null
    minimumAutoUpgradableVersion?: string | null
    requiresManualIntervention?: boolean
    recoveryMode: 'automatic-recovery'
    manualGuidance?: string | null
  } | null>(null)

  const editableKeys = useMemo(
    () => [...BRANDING_FIELDS, ...LOCALIZATION_FIELDS, { key: CHECKOUT_COUNTRIES_KEY }, { key: POWERED_BY_JIFFOO_KEY }].map((field) => field.key),
    []
  )

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const formatDeploymentMode = (mode: string) => {
    switch (mode) {
      case 'single-host':
        return getText('merchant.systemUpdates.singleHost', 'Single-host')
      case 'docker-compose':
        return getText('merchant.systemUpdates.dockerCompose', 'Docker Compose')
      case 'k8s':
        return getText('merchant.systemUpdates.k8s', 'Kubernetes / Helm')
      default:
        return getText('merchant.systemUpdates.unsupportedMode', 'Unsupported / custom')
    }
  }

  const formatReleaseChannel = (channel: string) => {
    switch (channel) {
      case 'prerelease':
        return getText('merchant.systemUpdates.prereleaseChannel', 'Prerelease')
      default:
        return getText('merchant.systemUpdates.stableChannel', 'Stable')
    }
  }

  const describeManifestState = () => {
    if (!versionInfo) return null

    if (versionInfo.manifestStatus === 'available') {
      return getText(
        'merchant.systemUpdates.manifestHealthy',
        'The public update manifest is reachable and release detection is active.'
      )
    }

    if (versionInfo.manifestStatus === 'missing') {
      return getText(
        'merchant.systemUpdates.manifestMissing',
        'No public update manifest is configured for this installation.'
      )
    }

    if (versionInfo.manifestStatus === 'invalid') {
      return versionInfo.manifestError || getText(
        'merchant.systemUpdates.manifestInvalid',
        'The public update manifest is present but invalid.'
      )
    }

    return versionInfo.manifestError || getText(
      'merchant.systemUpdates.manifestUnavailable',
      'The public update manifest could not be reached.'
    )
  }

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(initialDraft)
  const activeUpgradeStates = new Set(['checking', 'preparing', 'downloading', 'backing_up', 'applying', 'migrating', 'verifying'])
  const isUpgradeActive = upgradeStatus ? activeUpgradeStates.has(upgradeStatus.status) : false

  const syncVersionAfterUpgrade = useCallback(async (expectedVersion?: string | null) => {
    const targetVersion = expectedVersion || versionInfo?.latestVersion || null
    if (!targetVersion) {
      return false
    }

    setFinalizingUpgrade(true)
    try {
      clearUpdateCheckCache()
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const response = await upgradeApi.getVersion()
        const data = unwrapApiResponse(response)
        setVersionInfo(data)

        if (!data.updateAvailable || data.currentVersion === targetVersion) {
          return true
        }

        await new Promise((resolve) => window.setTimeout(resolve, 3000))
      }
      return false
    } finally {
      setFinalizingUpgrade(false)
    }
  }, [versionInfo?.latestVersion])

  const updateField = (key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const updateBooleanField = (key: string, value: boolean) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const loadSettings = useCallback(async () => {
    const response = await settingsApi.getAll()
    const data = toMap(unwrapApiResponse(response))
    setSettingsMap(data)
    const nextDraft = buildDraft(data, editableKeys)
    setDraft(nextDraft)
    setInitialDraft(nextDraft)
  }, [editableKeys])

  const loadVersion = useCallback(async () => {
    const response = await upgradeApi.getVersion()
    const data = unwrapApiResponse(response)
    setVersionInfo(data)
  }, [])

  const loadUpgradeStatus = useCallback(async () => {
    const response = await upgradeApi.getStatus()
    const data = unwrapApiResponse(response)
    setUpgradeStatus(normalizeUpgradeStatusView(data))
  }, [])

  const resetUpgradeStatus = useCallback(async () => {
    const response = await upgradeApi.resetStatus()
    const data = unwrapApiResponse(response)
    setUpgradeStatus(normalizeUpgradeStatusView(data))
    return data
  }, [])

  useEffect(() => {
    async function bootstrap() {
      try {
        await Promise.all([loadSettings(), loadVersion(), loadUpgradeStatus()])
      } catch (error: unknown) {
        toast.error(resolveApiErrorMessage(error, t))
      } finally {
        setLoading(false)
      }
    }
    bootstrap()
  }, [loadSettings, loadUpgradeStatus, loadVersion, t])

  useEffect(() => {
    if (!isUpgradeActive) return

    const interval = window.setInterval(() => {
      loadUpgradeStatus().catch(() => {
        // Keep the current progress visible even if one poll fails.
      })
    }, 3000)

    return () => window.clearInterval(interval)
  }, [isUpgradeActive, loadUpgradeStatus])

  useEffect(() => {
    if (!upgradeStatus || !['completed', 'recovered'].includes(upgradeStatus.status)) {
      return
    }

    const completionKey = `${upgradeStatus.status}:${upgradeStatus.targetVersion ?? ''}:${upgradeStatus.updatedAt ?? ''}`
    if (terminalUpgradeHandledRef.current === completionKey) {
      return
    }
    terminalUpgradeHandledRef.current = completionKey

    let cancelled = false

    const finalizeUpgrade = async () => {
      try {
        const refreshed = await syncVersionAfterUpgrade(upgradeStatus.targetVersion)
        if (cancelled) return

        await loadUpgradeStatus().catch(() => undefined)

        if (upgradeStatus.status === 'completed') {
          toast.success(
            refreshed
              ? getText('merchant.systemUpdates.updateCompletedDesc', 'System has been updated successfully!')
              : getText(
                  'merchant.systemUpdates.updateVersionRefreshPending',
                  'System updated successfully. Version metadata may take a few more seconds to refresh.'
            )
          )
        } else {
          toast.info(
            getText(
              'merchant.systemUpdates.updateRecovered',
              'Update finished with automatic recovery. The system has returned to the last healthy state.'
            )
          )
        }

        await new Promise((resolve) => window.setTimeout(resolve, 1500))
        if (cancelled) return
        await resetUpgradeStatus().catch(() => undefined)
      } catch (error: unknown) {
        if (cancelled) return
        toast.error(resolveApiErrorMessage(error, t))
      }
    }

    finalizeUpgrade()

    return () => {
      cancelled = true
    }
  }, [getText, loadUpgradeStatus, resetUpgradeStatus, syncVersionAfterUpgrade, t, upgradeStatus])

  const handleSave = async () => {
    if (!hasChanges) {
      toast.info(getText('merchant.settings.noChanges', 'No changes to save'))
      return
    }

    setSaving(true)
    try {
      const updates: SystemSettingsMap = {}
      editableKeys.forEach((key) => {
        if (key === CHECKOUT_COUNTRIES_KEY) {
          updates[key] = parseCountryCodes(getString(draft[key]))
        } else if (key === POWERED_BY_JIFFOO_KEY) {
          updates[key] = draft[key] !== false
        } else {
          updates[key] = getString(draft[key]).trim()
        }
      })
      const response = await settingsApi.batchUpdate(updates)
      const data = toMap(unwrapApiResponse(response))
      setSettingsMap(data)
      const nextDraft = buildDraft(data, editableKeys)
      setDraft(nextDraft)
      setInitialDraft(nextDraft)
      toast.success(getText('common.messages.saveSuccess', 'Settings saved successfully!'))
    } catch (error: unknown) {
      toast.error(resolveApiErrorMessage(error, t))
    } finally {
      setSaving(false)
    }
  }

  const refreshVersion = async () => {
    setCheckingVersion(true)
    try {
      clearUpdateCheckCache()
      await Promise.all([loadVersion(), loadUpgradeStatus()])
    } catch (error: unknown) {
      toast.error(resolveApiErrorMessage(error, t))
    } finally {
      setCheckingVersion(false)
    }
  }

  const handleUpgrade = async () => {
    if (!versionInfo?.latestVersion) return

    setStartingUpgrade(true)
    try {
      const response = await upgradeApi.perform(versionInfo.latestVersion)
      const data = unwrapApiResponse(response)
      await loadUpgradeStatus()

      if (data.completed) {
        clearUpdateCheckCache()
        toast.success(getText('merchant.systemUpdates.updateCompletedDesc', 'System has been updated successfully!'))
        await loadVersion()
      } else {
        toast.success(
          getText('merchant.systemUpdates.updateAccepted', 'Upgrade accepted. The updater is now running in the background.')
        )
      }
    } catch (error: unknown) {
      toast.error(resolveApiErrorMessage(error, t))
    } finally {
      setStartingUpgrade(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            {getText('common.actions.loading', 'Loading...')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full bg-[#fcfdfe] min-h-screen">
      {/* Header Bar */}
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-gray-100 bg-white/80 py-4 pl-4 pr-4 backdrop-blur-md sm:pl-20 sm:pr-8 lg:px-8">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-none">
            {getText('merchant.settings.title', 'Settings')}
          </h1>
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">
            System Configuration
          </span>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="h-10 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold text-sm shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? getText('common.actions.saving', 'Saving...') : getText('common.actions.saveChanges', 'Save Changes')}
        </Button>
      </div>

      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">
        {/* Store Branding Card */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                <Settings2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {getText('merchant.settings.general.storeBranding', 'Store Branding')}
                </h3>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {getText('merchant.settings.sections.generalDesc', 'Basic store configuration and preferences')}
                </span>
              </div>
            </div>
          </div>
          <div className="p-8 grid gap-6 md:grid-cols-2">
            {BRANDING_FIELDS.map((field) => (
              <div key={field.key} className={field.key === 'branding.store_description' ? 'md:col-span-2 space-y-2' : 'space-y-2'}>
                <Label htmlFor={field.key} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {getText(field.labelKey, field.labelFallback)}
                </Label>
                {field.key === 'branding.store_description' ? (
                  <Textarea
                    id={field.key}
                    value={getString(draft[field.key])}
                    onChange={(event) => updateField(field.key, event.target.value)}
                    placeholder={field.placeholder}
                    className="rounded-xl border-gray-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                  />
                ) : (
                  <Input
                    id={field.key}
                    value={getString(draft[field.key])}
                    onChange={(event) => updateField(field.key, event.target.value)}
                    placeholder={field.placeholder}
                    className="h-11 rounded-xl border-gray-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                  />
                )}
              </div>
            ))}
            <div className="md:col-span-2 rounded-2xl border border-gray-100 bg-gray-50/40 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <Label htmlFor={POWERED_BY_JIFFOO_KEY} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Powered by Jiffoo Footer Link
                  </Label>
                  <p className="text-sm text-gray-600">
                    Applies only to paid or package storefront themes. Built-in free themes keep the Powered by Jiffoo link visible.
                  </p>
                </div>
                <Switch
                  id={POWERED_BY_JIFFOO_KEY}
                  checked={draft[POWERED_BY_JIFFOO_KEY] !== false}
                  onCheckedChange={(checked) => updateBooleanField(POWERED_BY_JIFFOO_KEY, checked)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Localization Card */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-50">
            <h3 className="text-lg font-bold text-gray-900">
              {getText('merchant.settings.sections.localization', 'Localization')}
            </h3>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {getText('merchant.settings.sections.localizationDesc', 'Language, currency, and regional settings')}
            </span>
          </div>
          <div className="p-8 grid gap-6 md:grid-cols-2">
            {LOCALIZATION_FIELDS.map((field) => {
              const isLocaleField = field.key === 'localization.locale'
              const isTimezoneField = field.key === 'localization.timezone'

              return (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {getText(field.labelKey, field.labelFallback)}
                  </Label>
                  {isLocaleField ? (
                    <Select
                      value={getString(draft[field.key]) || 'en'}
                      onValueChange={(value) => updateField(field.key, value)}
                    >
                      <SelectTrigger className="h-11 rounded-xl border-gray-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCALE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : isTimezoneField ? (
                    <Select
                      value={getString(draft[field.key]) || 'UTC'}
                      onValueChange={(value) => updateField(field.key, value)}
                    >
                      <SelectTrigger className="h-11 rounded-xl border-gray-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={field.key}
                      value={getString(draft[field.key])}
                      onChange={(event) => updateField(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      className="h-11 rounded-xl border-gray-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Checkout Address Rules Card */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-50">
            <h3 className="text-lg font-bold text-gray-900">Checkout Address Rules</h3>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Countries that require state and postal code when shipping address is provided
            </span>
          </div>
          <div className="p-8 space-y-2">
            <Label htmlFor={CHECKOUT_COUNTRIES_KEY} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Country Codes (ISO-2)
            </Label>
            <Textarea
              id={CHECKOUT_COUNTRIES_KEY}
              value={getString(draft[CHECKOUT_COUNTRIES_KEY])}
              onChange={(event) => updateField(CHECKOUT_COUNTRIES_KEY, event.target.value)}
              placeholder="US, CA, AU, CN, GB"
              className="rounded-xl border-gray-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all min-h-[96px]"
            />
            <p className="text-xs text-gray-500">
              Use comma or newline separated country codes. Example: <code>US, CA, AU, CN, GB</code>
            </p>
          </div>
        </div>

        {/* Active Themes Card */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-50">
            <h3 className="text-lg font-bold text-gray-900">
              {getText('merchant.settings.sections.themes', 'Active Themes')}
            </h3>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {getText('merchant.settings.themeManagedHint', 'Theme activation is managed on the Themes page.')}
            </span>
          </div>
          <div className="p-8 grid gap-6 md:grid-cols-2">
            {THEME_FIELDS.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {getText(field.labelKey, field.labelFallback)}
                </Label>
                <Input
                  id={field.key}
                  value={getString(settingsMap[field.key]) || '-'}
                  disabled
                  className="h-11 rounded-xl border-gray-100 bg-gray-50/50"
                />
              </div>
            ))}
          </div>
        </div>

        {/* System Updates Card */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-50">
            <h3 className="text-lg font-bold text-gray-900">
              {getText('merchant.systemUpdates.title', 'System Updates')}
            </h3>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {getText('merchant.systemUpdates.subtitle', 'Manage system updates and version control')}
            </span>
          </div>
          <div className="p-8 space-y-6">
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-gray-100 p-6 bg-gray-50/30">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  {getText('merchant.systemUpdates.currentVersion', 'Current Version')}
                </p>
                <p className="text-2xl font-black text-gray-900 tracking-tight">{versionInfo?.currentVersion || '-'}</p>
              </div>
              <div className="rounded-2xl border border-gray-100 p-6 bg-gray-50/30">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  {getText('merchant.systemUpdates.latestVersion', 'Latest Version')}
                </p>
                <p className="text-2xl font-black text-gray-900 tracking-tight">{versionInfo?.latestVersion || '-'}</p>
                <p className="mt-2 text-xs text-gray-500">
                  {formatReleaseChannel(versionInfo?.releaseChannel || 'stable')}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 p-6 bg-gray-50/30">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  {getText('merchant.systemUpdates.deploymentMode', 'Deployment Mode')}
                </p>
                <p className="text-2xl font-black text-gray-900 tracking-tight">
                  {formatDeploymentMode(versionInfo?.deploymentMode || 'unsupported')}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 p-6 bg-gray-50/30">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  {getText('merchant.systemUpdates.recoveryMode', 'Failure Recovery')}
                </p>
                <p className="text-2xl font-black text-gray-900 tracking-tight">
                  {getText('merchant.systemUpdates.autoRecovery', 'Automatic recovery')}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className={cn(
                "inline-flex items-center px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                versionInfo?.updateAvailable
                  ? 'bg-yellow-50 text-yellow-600 border-yellow-100'
                  : 'bg-green-50 text-green-600 border-green-100'
              )}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {versionInfo?.updateAvailable
                  ? getText('merchant.systemUpdates.updateAvailable', 'Update Available')
                  : getText('merchant.systemUpdates.noUpdates', 'No Updates')}
              </div>
              <div className="flex flex-wrap gap-3">
                {versionInfo?.updateAvailable && versionInfo?.oneClickUpgradeSupported && !versionInfo?.requiresManualIntervention ? (
                  <Button
                    onClick={handleUpgrade}
                    disabled={startingUpgrade || isUpgradeActive || finalizingUpgrade}
                    className="h-10 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold text-sm"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${(startingUpgrade || isUpgradeActive || finalizingUpgrade) ? 'animate-spin' : ''}`} />
                    {startingUpgrade || isUpgradeActive || finalizingUpgrade
                      ? getText('merchant.systemUpdates.updateInProgress', 'Update in progress')
                      : getText('merchant.systemUpdates.updateNow', 'Update Now')}
                  </Button>
                ) : null}
                {versionInfo?.updateAvailable && (!versionInfo?.oneClickUpgradeSupported || versionInfo?.requiresManualIntervention) ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const runbook = 'https://github.com/thefreelight/Jiffoo/blob/main/docs/operations/admin-staff-rbac-release-runbook.md'
                      window.open(runbook, '_blank', 'noopener,noreferrer')
                    }}
                    className="h-10 px-6 rounded-xl border-amber-200 bg-amber-50/60 text-amber-800 hover:bg-amber-100 font-semibold text-sm"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {getText('merchant.systemUpdates.manualUpgradeSteps', 'Manual Upgrade Steps')}
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  onClick={refreshVersion}
                  disabled={checkingVersion || startingUpgrade || finalizingUpgrade}
                  className="h-10 px-6 rounded-xl border-gray-100 font-semibold text-sm hover:bg-gray-50"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${checkingVersion ? 'animate-spin' : ''}`} />
                  {checkingVersion
                    ? getText('merchant.systemUpdates.loading', 'Loading...')
                    : getText('merchant.systemUpdates.checkForUpdates', 'Check for Updates')}
                </Button>
              </div>
            </div>

            {upgradeStatus ? (
              <div className="rounded-2xl border border-gray-100 bg-gray-50/40 p-5 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {getText('merchant.systemUpdates.updateProgress', 'Update Progress')}
                  </p>
                  <span className="text-sm font-semibold text-gray-700">{upgradeStatus.progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, upgradeStatus.progress || 0))}%` }}
                  />
                </div>
                <p className="text-sm text-gray-700">
                  {upgradeStatus.currentStep || getText('merchant.systemUpdates.historyDesc', 'Updates will appear here after completion')}
                </p>
                {upgradeStatus.error ? (
                  <p className="text-xs text-red-600">{upgradeStatus.error}</p>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-2xl border border-gray-100 bg-gray-50/40 p-5 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {getText('merchant.systemUpdates.publicFeed', 'Public Update Feed')}
              </p>
              <p className="text-sm text-gray-700 break-all">
                {versionInfo?.manifestUrl || getText('merchant.systemUpdates.manifestUrlUnavailable', 'No manifest URL configured')}
              </p>
              <p className="text-xs text-gray-500">
                {describeManifestState()}
              </p>
              {versionInfo?.changelogUrl ? (
                <a
                  href={versionInfo.changelogUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  {getText('merchant.systemUpdates.openChangelog', 'Open changelog')}
                </a>
              ) : null}
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50/40 p-5 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {getText('merchant.systemUpdates.upgradePath', 'Upgrade Path')}
              </p>
              <p className="text-sm text-gray-700 leading-6">
                {versionInfo?.oneClickUpgradeSupported
                  ? getText(
                      'merchant.systemUpdates.oneClickSupported',
                      'This installation has a ready local updater executor and can use one-click core updates.'
                    )
                  : (versionInfo?.manualGuidance ||
                      getText(
                        'merchant.systemUpdates.manualOnly',
                        'This installation currently requires operator-guided manual core upgrades.'
                      ))}
              </p>
              {versionInfo?.deploymentModeReason ? (
                <p className="text-xs text-gray-500">
                  {versionInfo.deploymentModeReason}
                </p>
              ) : null}
              {versionInfo?.minimumAutoUpgradableVersion ? (
                <p className="text-xs text-gray-500">
                  {getText('merchant.systemUpdates.minimumAutoUpgradableVersion', 'Minimum auto-upgradable version')}:{' '}
                  <span className="font-medium text-gray-700">{versionInfo.minimumAutoUpgradableVersion}</span>
                </p>
              ) : null}
              {versionInfo?.requiresManualIntervention ? (
                <p className="text-xs font-medium text-amber-700">
                  {getText(
                    'merchant.systemUpdates.requiresManualIntervention',
                    'This target release still requires manual operator intervention even if a newer version is available.'
                  )}
                </p>
              ) : null}
              <p className="text-xs text-gray-500">
                {getText(
                  'merchant.systemUpdates.autoRecoveryHint',
                  'Failed upgrades should recover automatically; user-triggered version rollback is not exposed in the core update center.'
                )}
              </p>
            </div>

            <ManagedLicensePanel />
          </div>
        </div>
      </div>
    </div>
  )
}
