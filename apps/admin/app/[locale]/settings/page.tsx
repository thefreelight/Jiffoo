/**
 * Settings Page for Tenant Application
 *
 * Provides store configuration and preferences with i18n support.
 */

'use client'

import { Bell, CheckCircle, CreditCard, Globe, Settings, ShieldCheck, Truck, Users, Calculator } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useT, useLocale } from 'shared/src/i18n/react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Calculator icon alias for taxes section
const CalculatorIcon = Calculator

export default function SettingsPage() {
  const t = useT()
  const locale = useLocale()
  const [activeSection, setActiveSection] = useState('general')
  const router = useRouter()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Settings sections with i18n support
  const settingsSections = [
    {
      id: 'general',
      name: getText('merchant.settings.sections.general', 'General Settings'),
      icon: Settings,
      description: getText('merchant.settings.sections.generalDesc', 'Basic store configuration and preferences'),
    },
    {
      id: 'payments',
      name: getText('merchant.settings.sections.payments', 'Payment Methods'),
      icon: CreditCard,
      description: getText('merchant.settings.sections.paymentsDesc', 'Configure payment gateways and options'),
    },
    {
      id: 'shipping',
      name: getText('merchant.settings.sections.shipping', 'Shipping & Delivery'),
      icon: Truck,
      description: getText('merchant.settings.sections.shippingDesc', 'Shipping zones, rates, and delivery options'),
    },
    {
      id: 'taxes',
      name: getText('merchant.settings.sections.taxes', 'Taxes'),
      icon: CalculatorIcon,
      description: getText('merchant.settings.sections.taxesDesc', 'Tax rates and calculation settings'),
    },
    {
      id: 'localization',
      name: getText('merchant.settings.sections.localization', 'Localization'),
      icon: Globe,
      description: getText('merchant.settings.sections.localizationDesc', 'Language, currency, and regional settings'),
    },
    {
      id: 'security',
      name: getText('merchant.settings.sections.security', 'Security'),
      icon: ShieldCheck,
      description: getText('merchant.settings.sections.securityDesc', 'Security policies and access controls'),
    },
    {
      id: 'notifications',
      name: getText('merchant.settings.sections.notifications', 'Notifications'),
      icon: Bell,
      description: getText('merchant.settings.sections.notificationsDesc', 'Email and SMS notification settings'),
    },
    {
      id: 'users',
      name: getText('merchant.settings.sections.users', 'User Management'),
      icon: Users,
      description: getText('merchant.settings.sections.usersDesc', 'Admin users and role permissions'),
    },
  ]

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">{getText('merchant.settings.general.storeInfo', 'Store Information')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{getText('merchant.settings.general.storeName', 'Store Name')}</label>
            <input
              type="text"
              defaultValue="Jiffoo Mall"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{getText('merchant.settings.general.storeUrl', 'Store URL')}</label>
            <input
              type="text"
              defaultValue="https://jiffoo.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">{getText('merchant.settings.general.storeDescription', 'Store Description')}</label>
            <textarea
              rows={3}
              defaultValue="Your one-stop destination for quality products and exceptional service."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">{getText('merchant.settings.general.contactInfo', 'Contact Information')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{getText('merchant.settings.general.email', 'Email')}</label>
            <input
              type="email"
              defaultValue="support@jiffoo.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{getText('merchant.settings.general.phone', 'Phone')}</label>
            <input
              type="tel"
              defaultValue="+86 400-123-4567"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">{getText('merchant.settings.general.address', 'Address')}</label>
            <textarea
              rows={2}
              defaultValue="Building A, Tech Park, Zhongguancun, Beijing, China"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">{getText('merchant.settings.general.businessHours', 'Business Hours')}</h3>
        <div className="space-y-3">
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
            <div key={day} className="flex items-center space-x-4">
              <div className="w-20 text-sm text-gray-700">{getText(`tenant.settings.days.${day.toLowerCase()}`, day)}</div>
              <input
                type="time"
                defaultValue="09:00"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="text-gray-500">{getText('merchant.settings.general.to', 'to')}</span>
              <input
                type="time"
                defaultValue="18:00"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm text-gray-700">{getText('merchant.settings.general.closed', 'Closed')}</span>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderPaymentSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">{getText('merchant.settings.payments.gateways', 'Payment Gateways')}</h3>
        <div className="space-y-4">
          {[
            { name: 'Alipay', enabled: true, descKey: 'merchant.settings.payments.alipayDesc', descFallback: 'Accept payments via Alipay' },
            { name: 'WeChat Pay', enabled: true, descKey: 'merchant.settings.payments.wechatDesc', descFallback: 'Accept payments via WeChat Pay' },
            { name: 'UnionPay', enabled: false, descKey: 'merchant.settings.payments.unionpayDesc', descFallback: 'Accept payments via UnionPay cards' },
            { name: 'PayPal', enabled: false, descKey: 'merchant.settings.payments.paypalDesc', descFallback: 'Accept international payments via PayPal' },
          ].map((gateway) => (
            <div key={gateway.name} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">{gateway.name}</div>
                  <div className="text-sm text-gray-500">{getText(gateway.descKey, gateway.descFallback)}</div>
                </div>
              </div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  defaultChecked={gateway.enabled}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">{getText('merchant.settings.payments.enabled', 'Enabled')}</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">{getText('merchant.settings.payments.currencySettings', 'Currency Settings')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{getText('merchant.settings.payments.defaultCurrency', 'Default Currency')}</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="CNY">{getText('merchant.settings.payments.cny', 'Chinese Yuan (¥)')}</option>
              <option value="USD">{getText('merchant.settings.payments.usd', 'US Dollar ($)')}</option>
              <option value="EUR">{getText('merchant.settings.payments.eur', 'Euro (€)')}</option>
              <option value="GBP">{getText('merchant.settings.payments.gbp', 'British Pound (£)')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{getText('merchant.settings.payments.currencyPosition', 'Currency Position')}</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="before">{getText('merchant.settings.payments.beforeAmount', 'Before amount (¥100)')}</option>
              <option value="after">{getText('merchant.settings.payments.afterAmount', 'After amount (100¥)')}</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )

  const renderShippingSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">{getText('merchant.settings.shipping.zones', 'Shipping Zones')}</h3>
        <div className="space-y-4">
          {[
            { nameKey: 'merchant.settings.shipping.domestic', nameFallback: 'Domestic (China)', regions: 'All provinces in China', rate: 'Free shipping over ¥99' },
            { nameKey: 'merchant.settings.shipping.hkMacau', nameFallback: 'Hong Kong & Macau', regions: 'Hong Kong, Macau', rate: '¥25 flat rate' },
            { nameKey: 'merchant.settings.shipping.international', nameFallback: 'International', regions: 'Rest of world', rate: '¥150 flat rate' },
          ].map((zone, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{getText(zone.nameKey, zone.nameFallback)}</h4>
                    <p className="text-sm text-gray-600">{zone.regions}</p>
                    <p className="text-sm text-blue-600 mt-1">{zone.rate}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">{getText('common.actions.edit', 'Edit')}</Button>
                    <Button variant="outline" size="sm">{getText('common.actions.delete', 'Delete')}</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Button className="mt-4">{getText('merchant.settings.shipping.addZone', 'Add Shipping Zone')}</Button>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">{getText('merchant.settings.shipping.deliveryOptions', 'Delivery Options')}</h3>
        <div className="space-y-4">
          {[
            { nameKey: 'merchant.settings.shipping.standard', nameFallback: 'Standard Delivery', time: '3-5 business days', price: '¥15', enabled: true },
            { nameKey: 'merchant.settings.shipping.express', nameFallback: 'Express Delivery', time: '1-2 business days', price: '¥35', enabled: true },
            { nameKey: 'merchant.settings.shipping.sameDay', nameFallback: 'Same Day Delivery', time: 'Same day (selected areas)', price: '¥50', enabled: false },
          ].map((option, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                  <Truck className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">{getText(option.nameKey, option.nameFallback)}</div>
                  <div className="text-sm text-gray-500">{option.time} • {option.price}</div>
                </div>
              </div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  defaultChecked={option.enabled}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">{getText('merchant.settings.payments.enabled', 'Enabled')}</span>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderLocalizationSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">{getText('merchant.settings.localization.languageRegion', 'Language & Region')}</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">{getText('merchant.settings.localization.languageSettings', 'Language Settings')}</h4>
              <p className="text-sm text-gray-600">{getText('merchant.settings.localization.languageSettingsDesc', 'Configure language preferences for the admin interface')}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/${locale}/settings/language`)}
            >
              {getText('common.actions.configure', 'Configure')}
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">{getText('merchant.settings.localization.currencySettings', 'Currency Settings')}</h4>
              <p className="text-sm text-gray-600">{getText('merchant.settings.localization.currencySettingsDesc', 'Set default currency and formatting options')}</p>
            </div>
            <Button variant="outline" size="sm">{getText('common.actions.configure', 'Configure')}</Button>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">{getText('merchant.settings.localization.timezone', 'Timezone')}</h4>
              <p className="text-sm text-gray-600">{getText('merchant.settings.localization.timezoneDesc', 'Set the default timezone for your store')}</p>
            </div>
            <Button variant="outline" size="sm">{getText('common.actions.configure', 'Configure')}</Button>
          </div>
        </div>
      </div>
    </div>
  )

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">{getText('merchant.settings.security.authentication', 'Authentication')}</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">{getText('merchant.settings.security.twoFactor', 'Two-Factor Authentication')}</h4>
              <p className="text-sm text-gray-600">{getText('merchant.settings.security.twoFactorDesc', 'Add an extra layer of security to admin accounts')}</p>
            </div>
            <div className="flex items-center">
              <Badge className="bg-green-100 text-green-800 mr-3">
                <CheckCircle className="w-3 h-3 mr-1" />
                {getText('merchant.settings.payments.enabled', 'Enabled')}
              </Badge>
              <Button variant="outline" size="sm">{getText('common.actions.configure', 'Configure')}</Button>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">{getText('merchant.settings.security.sessionTimeout', 'Session Timeout')}</h4>
              <p className="text-sm text-gray-600">{getText('merchant.settings.security.sessionTimeoutDesc', 'Automatically log out inactive users')}</p>
            </div>
            <Select defaultValue="30">
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">{getText('merchant.settings.security.15minutes', '15 minutes')}</SelectItem>
                <SelectItem value="30">{getText('merchant.settings.security.30minutes', '30 minutes')}</SelectItem>
                <SelectItem value="60">{getText('merchant.settings.security.1hour', '1 hour')}</SelectItem>
                <SelectItem value="120">{getText('merchant.settings.security.2hours', '2 hours')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">{getText('merchant.settings.security.loginAttempts', 'Login Attempts')}</h4>
              <p className="text-sm text-gray-600">{getText('merchant.settings.security.loginAttemptsDesc', 'Maximum failed login attempts before account lockout')}</p>
            </div>
            <Select defaultValue="5">
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">{getText('merchant.settings.security.dataProtection', 'Data Protection')}</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">{getText('merchant.settings.security.sslCertificate', 'SSL Certificate')}</h4>
              <p className="text-sm text-gray-600">{getText('merchant.settings.security.sslCertificateDesc', 'Secure data transmission with HTTPS')}</p>
            </div>
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle className="w-3 h-3 mr-1" />
              {getText('merchant.settings.security.active', 'Active')}
            </Badge>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">{getText('merchant.settings.security.dataBackup', 'Data Backup')}</h4>
              <p className="text-sm text-gray-600">{getText('merchant.settings.security.dataBackupDesc', 'Automatic daily backups of store data')}</p>
            </div>
            <div className="flex items-center space-x-3">
              <Badge className="bg-blue-100 text-blue-800">{getText('merchant.settings.security.dailyAt2am', 'Daily at 2:00 AM')}</Badge>
              <Button variant="outline" size="sm">{getText('common.actions.configure', 'Configure')}</Button>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">{getText('merchant.settings.security.activityLogging', 'Activity Logging')}</h4>
              <p className="text-sm text-gray-600">{getText('merchant.settings.security.activityLoggingDesc', 'Track admin actions and system events')}</p>
            </div>
            <label className="flex items-center">
              <input
                type="checkbox"
                defaultChecked={true}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">{getText('merchant.settings.payments.enabled', 'Enabled')}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )

  const renderContent = () => {
    switch (activeSection) {
      case 'general':
        return renderGeneralSettings()
      case 'payments':
        return renderPaymentSettings()
      case 'shipping':
        return renderShippingSettings()
      case 'localization':
        return renderLocalizationSettings()
      case 'security':
        return renderSecuritySettings()
      default:
        return (
          <div className="text-center py-12">
            <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{getText('merchant.settings.sections.title', 'Settings Section')}</h3>
            <p className="text-gray-500">{getText('merchant.settings.sections.underDevelopment', 'This section is under development.')}</p>
          </div>
        )
    }
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{getText('merchant.settings.title', 'Settings')}</h1>
        <p className="text-gray-600 mt-1">{getText('merchant.settings.subtitle', 'Manage your store configuration and preferences')}</p>
      </div>

      <div className="flex gap-6">
        {/* Settings Navigation */}
        <div className="w-80 bg-white rounded-lg border border-gray-200 p-6">
          <nav className="space-y-2">
            {settingsSections.map((section) => {
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

        {/* Settings Content */}
        <div className="flex-1 bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {settingsSections.find(s => s.id === activeSection)?.name}
            </h2>
            <p className="text-gray-600 mt-1">
              {settingsSections.find(s => s.id === activeSection)?.description}
            </p>
          </div>

          {renderContent()}

          {/* Save Button */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex justify-end space-x-3">
              <Button variant="outline">{getText('common.actions.cancel', 'Cancel')}</Button>
              <Button className="bg-blue-600 hover:bg-blue-700">{getText('common.actions.saveChanges', 'Save Changes')}</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
