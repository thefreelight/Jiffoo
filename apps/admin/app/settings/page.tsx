'use client'

import { useState } from 'react'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CogIcon,
  CreditCardIcon,
  TruckIcon,
  CalculatorIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  BellIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'

const settingsSections = [
  {
    id: 'general',
    name: 'General Settings',
    icon: CogIcon,
    description: 'Basic store configuration and preferences',
  },
  {
    id: 'payments',
    name: 'Payment Methods',
    icon: CreditCardIcon,
    description: 'Configure payment gateways and options',
  },
  {
    id: 'shipping',
    name: 'Shipping & Delivery',
    icon: TruckIcon,
    description: 'Shipping zones, rates, and delivery options',
  },
  {
    id: 'taxes',
    name: 'Taxes',
    icon: CalculatorIcon,
    description: 'Tax rates and calculation settings',
  },
  {
    id: 'localization',
    name: 'Localization',
    icon: GlobeAltIcon,
    description: 'Language, currency, and regional settings',
  },
  {
    id: 'security',
    name: 'Security',
    icon: ShieldCheckIcon,
    description: 'Security policies and access controls',
  },
  {
    id: 'notifications',
    name: 'Notifications',
    icon: BellIcon,
    description: 'Email and SMS notification settings',
  },
  {
    id: 'users',
    name: 'User Management',
    icon: UserGroupIcon,
    description: 'Admin users and role permissions',
  },
]

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('general')

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Store Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Store Name</label>
            <input
              type="text"
              defaultValue="Jiffoo Mall"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Store URL</label>
            <input
              type="text"
              defaultValue="https://jiffoo.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Store Description</label>
            <textarea
              rows={3}
              defaultValue="Your one-stop destination for quality products and exceptional service."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              defaultValue="support@jiffoo.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
            <input
              type="tel"
              defaultValue="+86 400-123-4567"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
            <textarea
              rows={2}
              defaultValue="Building A, Tech Park, Zhongguancun, Beijing, China"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Business Hours</h3>
        <div className="space-y-3">
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
            <div key={day} className="flex items-center space-x-4">
              <div className="w-20 text-sm text-gray-700">{day}</div>
              <input
                type="time"
                defaultValue="09:00"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="text-gray-500">to</span>
              <input
                type="time"
                defaultValue="18:00"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm text-gray-700">Closed</span>
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
        <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Gateways</h3>
        <div className="space-y-4">
          {[
            { name: 'Alipay', enabled: true, description: 'Accept payments via Alipay' },
            { name: 'WeChat Pay', enabled: true, description: 'Accept payments via WeChat Pay' },
            { name: 'UnionPay', enabled: false, description: 'Accept payments via UnionPay cards' },
            { name: 'PayPal', enabled: false, description: 'Accept international payments via PayPal' },
          ].map((gateway) => (
            <div key={gateway.name} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                  <CreditCardIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">{gateway.name}</div>
                  <div className="text-sm text-gray-500">{gateway.description}</div>
                </div>
              </div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  defaultChecked={gateway.enabled}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Enabled</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Currency Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Default Currency</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="CNY">Chinese Yuan (¥)</option>
              <option value="USD">US Dollar ($)</option>
              <option value="EUR">Euro (€)</option>
              <option value="GBP">British Pound (£)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Currency Position</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="before">Before amount (¥100)</option>
              <option value="after">After amount (100¥)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )

  const renderShippingSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Shipping Zones</h3>
        <div className="space-y-4">
          {[
            { name: 'Domestic (China)', regions: 'All provinces in China', rate: 'Free shipping over ¥99' },
            { name: 'Hong Kong & Macau', regions: 'Hong Kong, Macau', rate: '¥25 flat rate' },
            { name: 'International', regions: 'Rest of world', rate: '¥150 flat rate' },
          ].map((zone, index) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{zone.name}</h4>
                    <p className="text-sm text-gray-600">{zone.regions}</p>
                    <p className="text-sm text-blue-600 mt-1">{zone.rate}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">Edit</Button>
                    <Button variant="outline" size="sm">Delete</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Button className="mt-4">Add Shipping Zone</Button>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Delivery Options</h3>
        <div className="space-y-4">
          {[
            { name: 'Standard Delivery', time: '3-5 business days', price: '¥15', enabled: true },
            { name: 'Express Delivery', time: '1-2 business days', price: '¥35', enabled: true },
            { name: 'Same Day Delivery', time: 'Same day (selected areas)', price: '¥50', enabled: false },
          ].map((option, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                  <TruckIcon className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">{option.name}</div>
                  <div className="text-sm text-gray-500">{option.time} • {option.price}</div>
                </div>
              </div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  defaultChecked={option.enabled}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Enabled</span>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Authentication</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">Two-Factor Authentication</h4>
              <p className="text-sm text-gray-600">Add an extra layer of security to admin accounts</p>
            </div>
            <div className="flex items-center">
              <Badge className="bg-green-100 text-green-800 mr-3">
                <CheckCircleIcon className="w-3 h-3 mr-1" />
                Enabled
              </Badge>
              <Button variant="outline" size="sm">Configure</Button>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">Session Timeout</h4>
              <p className="text-sm text-gray-600">Automatically log out inactive users</p>
            </div>
            <Select defaultValue="30">
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">Login Attempts</h4>
              <p className="text-sm text-gray-600">Maximum failed login attempts before account lockout</p>
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
        <h3 className="text-lg font-medium text-gray-900 mb-4">Data Protection</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">SSL Certificate</h4>
              <p className="text-sm text-gray-600">Secure data transmission with HTTPS</p>
            </div>
            <Badge className="bg-green-100 text-green-800">
              <CheckCircleIcon className="w-3 h-3 mr-1" />
              Active
            </Badge>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">Data Backup</h4>
              <p className="text-sm text-gray-600">Automatic daily backups of store data</p>
            </div>
            <div className="flex items-center space-x-3">
              <Badge className="bg-blue-100 text-blue-800">Daily at 2:00 AM</Badge>
              <Button variant="outline" size="sm">Configure</Button>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">Activity Logging</h4>
              <p className="text-sm text-gray-600">Track admin actions and system events</p>
            </div>
            <label className="flex items-center">
              <input
                type="checkbox"
                defaultChecked={true}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Enabled</span>
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
      case 'security':
        return renderSecuritySettings()
      default:
        return (
          <div className="text-center py-12">
            <CogIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Settings Section</h3>
            <p className="text-gray-500">This section is under development.</p>
          </div>
        )
    }
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your store configuration and preferences</p>
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
              <Button variant="outline">Cancel</Button>
              <Button className="bg-blue-600 hover:bg-blue-700">Save Changes</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
