'use client'

/**
 * Variant Authorization Panel
 * 
 * A panel component for managing product variant authorization settings.
 * Includes two tabs: Self (own mall sales) and Children (delegation to agents).
 */

import { useState, useEffect } from 'react'
import { useT } from 'shared/src/i18n'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Store, Users, DollarSign, AlertCircle } from 'lucide-react'
import { agentAdminApi, type SelfVariantConfig, type ChildrenVariantConfig } from '@/lib/agent-api'
import { toast } from 'sonner'

interface ProductVariant {
  id: string
  name: string
  basePrice: number
  baseStock: number
}

interface VariantAuthorizationPanelProps {
  productId: string
  productName: string
  variants: ProductVariant[]
  onUpdate?: () => void
}

export function VariantAuthorizationPanel({
  productId,
  productName,
  variants,
  onUpdate
}: VariantAuthorizationPanelProps) {
  const t = useT()
  const getText = (key: string, fallback: string): string => t ? t(key) : fallback

  const [activeTab, setActiveTab] = useState('self')
  const [selfConfigs, setSelfConfigs] = useState<SelfVariantConfig[]>([])
  const [childrenConfigs, setChildrenConfigs] = useState<ChildrenVariantConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState<string | null>(null)

  // Load configs on mount
  useEffect(() => {
    loadConfigs()
  }, [productId])

  const loadConfigs = async () => {
    setIsLoading(true)
    try {
      const [selfRes, childrenRes] = await Promise.all([
        agentAdminApi.getSelfVariantConfigs(productId, { ownerType: 'TENANT' }),
        agentAdminApi.getChildrenVariantConfigs(productId, { ownerType: 'TENANT' })
      ])

      if (selfRes.success && selfRes.data) {
        setSelfConfigs(selfRes.data)
      }
      if (childrenRes.success && childrenRes.data) {
        setChildrenConfigs(childrenRes.data)
      }
    } catch (error) {
      console.error('Failed to load configs:', error)
      toast.error(getText('tenant.products.authorization.loadError', 'Failed to load authorization settings'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelfConfigChange = async (variantId: string, field: string, value: any) => {
    setIsSaving(variantId)
    try {
      const updateData: any = { ownerType: 'TENANT' }
      updateData[field] = value

      const res = await agentAdminApi.updateSelfVariantConfig(variantId, updateData)
      if (res.success) {
        toast.success(getText('tenant.products.authorization.saved', 'Settings saved'))
        await loadConfigs()
        onUpdate?.()
      } else {
        throw new Error(res.message || 'Update failed')
      }
    } catch (error) {
      console.error('Failed to update self config:', error)
      toast.error(getText('tenant.products.authorization.saveError', 'Failed to save settings'))
    } finally {
      setIsSaving(null)
    }
  }

  const handleChildrenConfigChange = async (
    variantId: string | null,
    field: string,
    value: any
  ) => {
    const savingKey = variantId || 'product'
    setIsSaving(savingKey)
    try {
      const updateData: any = { ownerType: 'TENANT' }
      updateData[field] = value

      let res
      if (variantId) {
        res = await agentAdminApi.updateChildrenVariantConfig(variantId, updateData)
      } else {
        res = await agentAdminApi.updateChildrenProductConfig(productId, updateData)
      }

      if (res.success) {
        toast.success(getText('tenant.products.authorization.saved', 'Settings saved'))
        await loadConfigs()
        onUpdate?.()
      } else {
        throw new Error(res.message || 'Update failed')
      }
    } catch (error) {
      console.error('Failed to update children config:', error)
      toast.error(getText('tenant.products.authorization.saveError', 'Failed to save settings'))
    } finally {
      setIsSaving(null)
    }
  }

  // Helper to get config for a variant
  const getSelfConfig = (variantId: string) => selfConfigs.find(c => c.variantId === variantId)
  const getChildrenConfig = (variantId: string) => childrenConfigs.find(c => c.variantId === variantId)
  const getProductLevelChildrenConfig = () => childrenConfigs.find(c => !c.variantId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="self" className="flex items-center gap-2">
          <Store className="w-4 h-4" />
          {getText('tenant.products.authorization.selfTab', 'My Mall Settings')}
        </TabsTrigger>
        <TabsTrigger value="children" className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          {getText('tenant.products.authorization.childrenTab', 'Agent Authorization')}
        </TabsTrigger>
      </TabsList>

      {/* Self Tab - My Mall Settings */}
      <TabsContent value="self" className="space-y-4 mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {getText('tenant.products.authorization.selfTitle', 'Mall Sales Settings')}
            </CardTitle>
            <CardDescription>
              {getText('tenant.products.authorization.selfDesc', 'Configure which variants are available for sale in your mall and their prices.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {variants.map(variant => {
              const config = getSelfConfig(variant.id)
              const canSell = config?.canSellSelf ?? true
              const selfPrice = config?.selfPrice ?? null
              const effectivePrice = config?.effectivePrice ?? variant.basePrice

              return (
                <div key={variant.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{variant.name}</span>
                      <Badge variant="outline">¥{variant.basePrice.toFixed(2)}</Badge>
                    </div>
                    {selfPrice !== null && (
                      <div className="text-sm text-green-600 mt-1">
                        {getText('tenant.products.authorization.effectivePrice', 'Effective Price')}: ¥{effectivePrice.toFixed(2)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`self-price-${variant.id}`} className="text-sm text-gray-500">
                        {getText('tenant.products.authorization.customPrice', 'Custom Price')}
                      </Label>
                      <Input
                        id={`self-price-${variant.id}`}
                        type="number"
                        step="0.01"
                        placeholder={variant.basePrice.toFixed(2)}
                        className="w-24"
                        defaultValue={selfPrice ?? ''}
                        onBlur={(e) => {
                          const val = e.target.value ? parseFloat(e.target.value) : null
                          if (val !== selfPrice) {
                            handleSelfConfigChange(variant.id, 'selfPrice', val)
                          }
                        }}
                        disabled={isSaving === variant.id}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`self-sell-${variant.id}`} className="text-sm text-gray-500">
                        {getText('tenant.products.authorization.canSell', 'Can Sell')}
                      </Label>
                      <Switch
                        id={`self-sell-${variant.id}`}
                        checked={canSell}
                        onCheckedChange={(checked) => handleSelfConfigChange(variant.id, 'canSellSelf', checked)}
                        disabled={isSaving === variant.id}
                      />
                    </div>
                    {isSaving === variant.id && <Loader2 className="w-4 h-4 animate-spin" />}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Children Tab - Agent Authorization */}
      <TabsContent value="children" className="space-y-4 mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {getText('tenant.products.authorization.childrenTitle', 'Agent Authorization Settings')}
            </CardTitle>
            <CardDescription>
              {getText('tenant.products.authorization.childrenDesc', 'Configure which variants can be delegated to agents and their pricing constraints.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Product-level delegation switch */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">
                  {getText('tenant.products.authorization.productDelegation', 'Allow Product Delegation')}
                </div>
                <div className="text-sm text-gray-500">
                  {getText('tenant.products.authorization.productDelegationDesc', 'Master switch to allow agents to sell this product')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={getProductLevelChildrenConfig()?.canDelegateProduct ?? true}
                  onCheckedChange={(checked) => handleChildrenConfigChange(null, 'canDelegateProduct', checked)}
                  disabled={isSaving === 'product'}
                />
                {isSaving === 'product' && <Loader2 className="w-4 h-4 animate-spin" />}
              </div>
            </div>

            {/* Variant-level settings */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-gray-700">
                {getText('tenant.products.authorization.variantSettings', 'Variant Settings')}
              </h4>
              {variants.map(variant => {
                const config = getChildrenConfig(variant.id)
                const canDelegate = config?.canDelegateVariant ?? true
                const priceForChildren = config?.priceForChildren ?? null
                const priceMin = config?.priceForChildrenMin ?? null
                const priceMax = config?.priceForChildrenMax ?? null

                return (
                  <div key={variant.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{variant.name}</span>
                        <Badge variant="outline">¥{variant.basePrice.toFixed(2)}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm text-gray-500">
                          {getText('tenant.products.authorization.canDelegate', 'Can Delegate')}
                        </Label>
                        <Switch
                          checked={canDelegate}
                          onCheckedChange={(checked) => handleChildrenConfigChange(variant.id, 'canDelegateVariant', checked)}
                          disabled={isSaving === variant.id}
                        />
                      </div>
                    </div>
                    {canDelegate && (
                      <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                        <div>
                          <Label className="text-xs text-gray-500">
                            {getText('tenant.products.authorization.agentPrice', 'Agent Price')}
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={getText('tenant.products.authorization.inherit', 'Inherit')}
                            className="mt-1"
                            defaultValue={priceForChildren ?? ''}
                            onBlur={(e) => {
                              const val = e.target.value ? parseFloat(e.target.value) : null
                              if (val !== priceForChildren) {
                                handleChildrenConfigChange(variant.id, 'priceForChildren', val)
                              }
                            }}
                            disabled={isSaving === variant.id}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">
                            {getText('tenant.products.authorization.minPrice', 'Min Price')}
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={getText('tenant.products.authorization.noLimit', 'No limit')}
                            className="mt-1"
                            defaultValue={priceMin ?? ''}
                            onBlur={(e) => {
                              const val = e.target.value ? parseFloat(e.target.value) : null
                              if (val !== priceMin) {
                                handleChildrenConfigChange(variant.id, 'priceForChildrenMin', val)
                              }
                            }}
                            disabled={isSaving === variant.id}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">
                            {getText('tenant.products.authorization.maxPrice', 'Max Price')}
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={getText('tenant.products.authorization.noLimit', 'No limit')}
                            className="mt-1"
                            defaultValue={priceMax ?? ''}
                            onBlur={(e) => {
                              const val = e.target.value ? parseFloat(e.target.value) : null
                              if (val !== priceMax) {
                                handleChildrenConfigChange(variant.id, 'priceForChildrenMax', val)
                              }
                            }}
                            disabled={isSaving === variant.id}
                          />
                        </div>
                      </div>
                    )}
                    {isSaving === variant.id && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {getText('tenant.products.authorization.saving', 'Saving...')}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}

