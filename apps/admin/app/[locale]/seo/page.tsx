/**
 * SEO Settings Page for Admin Application
 *
 * Provides global URL structure configuration and SEO management with i18n support.
 */

'use client'

import { Search, Link2, Globe, FileText, Settings } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { settingsApi, unwrapApiResponse } from '@/lib/api'
import { toast } from 'sonner'
import { useT, useLocale } from 'shared/src/i18n/react'

export default function SEOSettingsPage() {
  const t = useT()
  const locale = useLocale()
  const [activeSection, setActiveSection] = useState('url-structure')
  const [settings, setSettings] = useState<Record<string, any>>({
    productUrlPattern: '/products/{slug}',
    categoryUrlPattern: '/categories/{slug}',
    pageUrlPattern: '/{slug}',
    blogUrlPattern: '/blog/{slug}',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  // Load settings from API on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await settingsApi.getAll()
        const data = unwrapApiResponse(response)

        // Extract SEO-related settings
        const seoSettings: Record<string, any> = {
          productUrlPattern: data.productUrlPattern || '/products/{slug}',
          categoryUrlPattern: data.categoryUrlPattern || '/categories/{slug}',
          pageUrlPattern: data.pageUrlPattern || '/{slug}',
          blogUrlPattern: data.blogUrlPattern || '/blog/{slug}',
        }

        setSettings(seoSettings)
      } catch (err: any) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        toast.error('Failed to load SEO settings: ' + errorMsg)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  const handleUpdateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await settingsApi.batchUpdate(settings)
      const data = unwrapApiResponse(response)
      setSettings(data)
      toast.success(getText('common.messages.saveSuccess', 'SEO settings saved successfully!'))
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      toast.error(getText('common.messages.saveFailed', 'Failed to save SEO settings: ') + errorMsg)
    } finally {
      setSaving(false)
    }
  }

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // SEO sections with i18n support
  const seoSections = [
    {
      id: 'url-structure',
      name: getText('admin.seo.sections.urlStructure', 'URL Structure'),
      icon: Link2,
      description: getText('admin.seo.sections.urlStructureDesc', 'Configure URL patterns for different content types'),
    },
    {
      id: 'meta-defaults',
      name: getText('admin.seo.sections.metaDefaults', 'Meta Defaults'),
      icon: FileText,
      description: getText('admin.seo.sections.metaDefaultsDesc', 'Set default meta tags and descriptions'),
    },
    {
      id: 'sitemap',
      name: getText('admin.seo.sections.sitemap', 'Sitemap'),
      icon: Globe,
      description: getText('admin.seo.sections.sitemapDesc', 'Configure sitemap generation settings'),
    },
  ]

  const renderUrlStructureSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {getText('admin.seo.urlStructure.title', 'URL Pattern Configuration')}
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          {getText('admin.seo.urlStructure.description', 'Define URL patterns for different content types. Use {slug} for the content identifier.')}
        </p>

        <div className="space-y-6">
          {/* Product URL Pattern */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getText('admin.seo.urlStructure.productPattern', 'Product URL Pattern')}
            </label>
            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={settings.productUrlPattern || ''}
                  onChange={(e) => handleUpdateSetting('productUrlPattern', e.target.value)}
                  placeholder="/products/{slug}"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="text-sm text-gray-500">
                {getText('admin.seo.urlStructure.example', 'Example:')} /products/wireless-headphones
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {getText('admin.seo.urlStructure.productPatternHelp', 'Available variables: {slug}, {id}, {category}')}
            </p>
          </div>

          {/* Category URL Pattern */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getText('admin.seo.urlStructure.categoryPattern', 'Category URL Pattern')}
            </label>
            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={settings.categoryUrlPattern || ''}
                  onChange={(e) => handleUpdateSetting('categoryUrlPattern', e.target.value)}
                  placeholder="/categories/{slug}"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="text-sm text-gray-500">
                {getText('admin.seo.urlStructure.example', 'Example:')} /categories/electronics
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {getText('admin.seo.urlStructure.categoryPatternHelp', 'Available variables: {slug}, {id}')}
            </p>
          </div>

          {/* Page URL Pattern */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getText('admin.seo.urlStructure.pagePattern', 'Page URL Pattern')}
            </label>
            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={settings.pageUrlPattern || ''}
                  onChange={(e) => handleUpdateSetting('pageUrlPattern', e.target.value)}
                  placeholder="/{slug}"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="text-sm text-gray-500">
                {getText('admin.seo.urlStructure.example', 'Example:')} /about-us
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {getText('admin.seo.urlStructure.pagePatternHelp', 'Available variables: {slug}, {id}')}
            </p>
          </div>

          {/* Blog URL Pattern */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getText('admin.seo.urlStructure.blogPattern', 'Blog URL Pattern')}
            </label>
            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={settings.blogUrlPattern || ''}
                  onChange={(e) => handleUpdateSetting('blogUrlPattern', e.target.value)}
                  placeholder="/blog/{slug}"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="text-sm text-gray-500">
                {getText('admin.seo.urlStructure.example', 'Example:')} /blog/latest-news
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {getText('admin.seo.urlStructure.blogPatternHelp', 'Available variables: {slug}, {id}, {date}')}
            </p>
          </div>
        </div>
      </div>

      {/* URL Preview Section */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {getText('admin.seo.urlStructure.preview', 'URL Preview')}
        </h3>
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Product:</span>
                <code className="text-sm text-blue-600">
                  {settings.productUrlPattern?.replace('{slug}', 'example-product')}
                </code>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Category:</span>
                <code className="text-sm text-blue-600">
                  {settings.categoryUrlPattern?.replace('{slug}', 'example-category')}
                </code>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Page:</span>
                <code className="text-sm text-blue-600">
                  {settings.pageUrlPattern?.replace('{slug}', 'example-page')}
                </code>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Blog:</span>
                <code className="text-sm text-blue-600">
                  {settings.blogUrlPattern?.replace('{slug}', 'example-post')}
                </code>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const renderMetaDefaultsSettings = () => (
    <div className="text-center py-12">
      <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        {getText('admin.seo.metaDefaults.title', 'Meta Defaults')}
      </h3>
      <p className="text-gray-500">
        {getText('admin.seo.metaDefaults.comingSoon', 'This section is under development.')}
      </p>
    </div>
  )

  const renderSitemapSettings = () => (
    <div className="text-center py-12">
      <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        {getText('admin.seo.sitemap.title', 'Sitemap Settings')}
      </h3>
      <p className="text-gray-500">
        {getText('admin.seo.sitemap.comingSoon', 'This section is under development.')}
      </p>
    </div>
  )

  const renderContent = () => {
    switch (activeSection) {
      case 'url-structure':
        return renderUrlStructureSettings()
      case 'meta-defaults':
        return renderMetaDefaultsSettings()
      case 'sitemap':
        return renderSitemapSettings()
      default:
        return (
          <div className="text-center py-12">
            <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {getText('admin.seo.sections.title', 'SEO Section')}
            </h3>
            <p className="text-gray-500">
              {getText('admin.seo.sections.underDevelopment', 'This section is under development.')}
            </p>
          </div>
        )
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">
              {getText('common.messages.loading', 'Loading...')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {getText('admin.seo.title', 'SEO Settings')}
        </h1>
        <p className="text-gray-600 mt-1">
          {getText('admin.seo.subtitle', 'Configure URL structure and SEO settings for your store')}
        </p>
      </div>

      <div className="flex gap-6">
        {/* SEO Navigation */}
        <div className="w-80 bg-white rounded-lg border border-gray-200 p-6">
          <nav className="space-y-2">
            {seoSections.map((section) => {
              const Icon = section.icon
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-start p-3 rounded-lg text-left transition-colors ${
                    activeSection === section.id
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <Icon className="w-5 h-5 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <div className="font-medium">{section.name}</div>
                    <div className="text-sm text-gray-500 mt-1">{section.description}</div>
                  </div>
                </button>
              )
            })}
          </nav>
        </div>

        {/* SEO Content */}
        <div className="flex-1 bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {seoSections.find(s => s.id === activeSection)?.name}
            </h2>
            <p className="text-gray-600 mt-1">
              {seoSections.find(s => s.id === activeSection)?.description}
            </p>
          </div>

          {renderContent()}

          {/* Save Button */}
          {activeSection === 'url-structure' && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={() => router.refresh()}>
                  {getText('common.actions.cancel', 'Cancel')}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {saving ? getText('common.actions.saving', 'Saving...') : getText('common.actions.saveChanges', 'Save Changes')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
