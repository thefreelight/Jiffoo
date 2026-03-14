'use client'

/**
 * Product Edit Page - Immersive Industrial Power Design (REVERTED & REFINED)
 * Full-bleed layout with stay-on-page save logic.
 */

import { ArrowLeft, Plus, X, ImageIcon, Trash2, CheckCircle, GitCompareArrows, Link2, ShieldAlert } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useT } from 'shared/src/i18n/react'
import { toast } from 'sonner'

import {
  useProduct,
  useUpdateProduct,
  useUploadProductImage,
  useCategories,
  useProductExternalSource,
  useAcknowledgeProductSourceChanges,
  useAcknowledgeVariantSourceChange,
} from '@/lib/hooks/use-api'
import { VariantsEditor } from '@/components/products/VariantsEditor'
import { SeoMetaEditor } from '@/components/seo/SeoMetaEditor'

interface ProductFormData {
  name: string
  description: string
  category: string
  requiresShipping: boolean
  images: string[]
  variants: any[]
  seoMeta: {
    metaTitle?: string | null
    metaDescription?: string | null
    canonicalUrl?: string | null
    structuredData?: string | null
  }
}

export default function EditProductPage() {
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string
  const t = useT()

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const { data: product, isLoading, error, refetch } = useProduct(productId)
  const {
    data: externalSource,
    isLoading: isExternalSourceLoading,
    refetch: refetchExternalSource,
  } = useProductExternalSource(productId)
  const { data: categories = [] } = useCategories()
  const updateProductMutation = useUpdateProduct()
  const acknowledgeProductSourceMutation = useAcknowledgeProductSourceChanges()
  const acknowledgeVariantSourceMutation = useAcknowledgeVariantSourceChange()
  const uploadImageMutation = useUploadProductImage()
  const [isUploading, setIsUploading] = useState(false)
  const [successMode, setSuccessMode] = useState(false)

  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    category: 'none',
    requiresShipping: true,
    images: [],
    variants: [],
    seoMeta: {
      metaTitle: null,
      metaDescription: null,
      canonicalUrl: null,
      structuredData: null
    }
  })

  useEffect(() => {
    if (product) {
      const rawStructuredData = (product as any).structuredData ?? null
      const structuredData = rawStructuredData
        ? typeof rawStructuredData === 'string'
          ? rawStructuredData
          : (() => {
            try {
              return JSON.stringify(rawStructuredData, null, 2)
            } catch {
              return null
            }
          })()
        : null

      setFormData({
        name: product.name ?? '',
        description: product.description ?? '',
        category: product.categoryId || 'none',
        requiresShipping: product.requiresShipping !== false,
        images: Array.isArray(product.images) ? product.images : [],
        variants: product.variants?.map((v: any) => ({
          id: v.id,
          name: v.name ?? '',
          salePrice: Number(v.salePrice || 0),
          costPrice: v.costPrice ?? null,
          baseStock: Number(v.baseStock || 0),
          skuCode: v.skuCode ?? '',
          isActive: !!v.isActive
        })) || [],
        seoMeta: {
          metaTitle: (product as any).metaTitle ?? null,
          metaDescription: (product as any).metaDescription ?? null,
          canonicalUrl: (product as any).canonicalUrl ?? null,
          structuredData
        }
      })
    }
  }, [product])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setSuccessMode(false)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const result = await uploadImageMutation.mutateAsync(file)
        return result?.url ?? ''
      })
      const uploadedUrls = await Promise.all(uploadPromises)
      setFormData(prev => ({ ...prev, images: [...prev.images, ...uploadedUrls] }))
      setSuccessMode(false)
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    if (e) e.preventDefault()
    try {
      const productData = {
        name: formData.name,
        description: formData.description,
        categoryId: formData.category === 'none' ? null : formData.category,
        requiresShipping: formData.requiresShipping,
        images: formData.images,
        variants: formData.variants,
        metaTitle: formData.seoMeta.metaTitle,
        metaDescription: formData.seoMeta.metaDescription,
        canonicalUrl: formData.seoMeta.canonicalUrl,
        structuredData: formData.seoMeta.structuredData
      }
      await updateProductMutation.mutateAsync({ id: productId, data: productData as any })

      // Key: Stay on page, provide feedback
      setSuccessMode(true)
      refetch()
      toast.success('Product updated successfully')

      // Restore button text after 3 seconds
      setTimeout(() => setSuccessMode(false), 3000)
    } catch (error) {
      console.error('Update failed:', error)
      toast.error(getText('common.errors.general', 'Something went wrong. Please try again.'))
    }
  }

  const handleAcknowledgeAllSourceChanges = async () => {
    try {
      await acknowledgeProductSourceMutation.mutateAsync(productId)
      await Promise.all([refetch(), refetchExternalSource()])
    } catch (error) {
      console.error('Acknowledge all source changes failed:', error)
    }
  }

  const handleAcknowledgeVariantSourceChange = async (variantId: string) => {
    try {
      await acknowledgeVariantSourceMutation.mutateAsync({ productId, variantId })
      await Promise.all([refetch(), refetchExternalSource()])
    } catch (error) {
      console.error('Acknowledge variant source change failed:', error)
    }
  }

  const renderChangedFields = (summary: any): string => {
    const fields = Array.isArray(summary?.changedFields) ? summary.changedFields.filter((item: unknown) => typeof item === 'string') : []
    return fields.length > 0 ? fields.join(', ') : 'Pending source review'
  }

  const hasExternalSource = !!externalSource?.linked
  const hasPendingProductChange = !!externalSource?.product?.hasPendingChange
  const pendingVariantCount = Array.isArray(externalSource?.variants)
    ? externalSource.variants.filter((variant: any) => variant.hasPendingChange).length
    : 0

  if (isLoading) return <div className="p-12 text-center text-gray-400 font-bold uppercase tracking-[0.2em] animate-pulse">Accessing Encrypted Asset...</div>
  if (error) return <div className="p-12 text-center text-red-500 font-black uppercase">{getText('common.errors.general', 'Something went wrong. Please try again.')}</div>

  return (
    <div className="w-full bg-[#fcfdfe] min-h-screen">
      {/* Header Bar */}
      <div className="border-b border-gray-100 pl-20 pr-4 sm:pr-8 lg:px-8 py-4 sticky top-0 bg-white/80 backdrop-blur-md z-50 flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="hover:bg-gray-100 rounded-xl w-8 h-8 sm:w-10 sm:h-10 shrink-0">
            <ArrowLeft className="w-4 h-4 sm:w-5 h-5 text-gray-900" />
          </Button>
          <div className="flex flex-col min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight leading-none truncate">
              {formData.name || 'Edit Product'}
            </h1>
            <span className="text-[9px] sm:text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5 sm:mt-1">Product Editor</span>
          </div>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          <Button variant="outline" onClick={() => router.push('/products')} className="hidden sm:flex text-gray-500 border-gray-200 hover:bg-gray-50 font-semibold text-sm rounded-xl h-10 px-6">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateProductMutation.isPending}
            className={`font-semibold text-xs sm:text-sm px-4 sm:px-8 h-9 sm:h-10 rounded-xl shadow-lg transition-all active:scale-95 ${successMode ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
              }`}
          >
            {updateProductMutation.isPending ? 'Saving...' : successMode ? 'Updated' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {hasExternalSource && (
          <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Link2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900 uppercase tracking-tight">External Source</h2>
                    <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">
                      {externalSource?.sourceProvider || 'External'} linked source snapshot
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-gray-900 text-white">{externalSource?.sourceProvider || 'external'}</Badge>
                  <Badge variant="outline" className={externalSource?.product?.sourceIsActive === false ? 'border-red-200 text-red-600' : 'border-green-200 text-green-600'}>
                    {externalSource?.product?.sourceIsActive === false ? 'Source inactive' : 'Source active'}
                  </Badge>
                  {hasPendingProductChange && (
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Product change pending</Badge>
                  )}
                  {pendingVariantCount > 0 && (
                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">{pendingVariantCount} variant changes pending</Badge>
                  )}
                </div>
              </div>

              <Button
                type="button"
                onClick={handleAcknowledgeAllSourceChanges}
                disabled={acknowledgeProductSourceMutation.isPending}
                className="bg-gray-900 hover:bg-black text-white rounded-xl"
              >
                {acknowledgeProductSourceMutation.isPending ? 'Confirming...' : 'Acknowledge All'}
              </Button>
            </div>

            {(hasPendingProductChange || pendingVariantCount > 0) && (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Source changes detected</AlertTitle>
                <AlertDescription>
                  Product-level and variant-level source snapshots have changed. Review them here before clearing the pending flags.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">External Product Code</p>
                <p className="text-sm font-semibold text-gray-900 break-all">{externalSource?.product?.externalProductCode || '-'}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pt-2">Last Source Update</p>
                <p className="text-sm font-medium text-gray-700">{externalSource?.product?.sourceUpdatedAt || '-'}</p>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Product Pending Summary</p>
                <p className="text-sm font-medium text-gray-700">
                  {hasPendingProductChange ? renderChangedFields(externalSource?.product?.pendingChangeSummary) : 'No pending product-level changes'}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pt-2">Last Approved</p>
                <p className="text-sm font-medium text-gray-700">{externalSource?.product?.lastApprovedAt || '-'}</p>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Source Snapshot</p>
                <p className="text-sm font-medium text-gray-700">Name: {externalSource?.product?.sourceName || '-'}</p>
                <p className="text-sm font-medium text-gray-700">Category: {externalSource?.product?.sourceCategoryCode || '-'}</p>
                <p className="text-sm font-medium text-gray-700">Sync Status: {externalSource?.product?.syncStatus || '-'}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <GitCompareArrows className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-tight">Variant Source Review</h3>
              </div>

              {isExternalSourceLoading ? (
                <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 text-sm text-gray-500">Loading source details...</div>
              ) : (
                <div className="space-y-3">
                  {externalSource?.variants?.map((variant: any) => (
                    <div
                      key={variant.coreVariantId}
                      className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
                    >
                      <div className="space-y-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">{variant.sourceVariantName || variant.externalVariantCode}</span>
                          <Badge variant="outline" className="border-gray-200 text-gray-600">{variant.sourceSkuCode || variant.coreSkuCode || 'No SKU'}</Badge>
                          {variant.hasPendingChange ? (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending</Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Confirmed</Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
                          <p>Cost: {variant.sourceCostPrice ?? '-'}</p>
                          <p>Status: {variant.sourceIsActive === false ? 'Inactive' : 'Active'}</p>
                          <p>Sync: {variant.syncStatus}</p>
                        </div>
                        <p className="text-sm text-gray-700">
                          {variant.hasPendingChange ? renderChangedFields(variant.pendingChangeSummary) : 'No pending source changes'}
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleAcknowledgeVariantSourceChange(variant.coreVariantId)}
                        disabled={!variant.hasPendingChange || acknowledgeVariantSourceMutation.isPending}
                        className="rounded-xl border-gray-200"
                      >
                        {acknowledgeVariantSourceMutation.isPending ? 'Confirming...' : 'Acknowledge Variant'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Basic Info & Media */}
          <div className="lg:col-span-1 space-y-6">
            {/* Basic Information Section */}
            <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-6">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-gray-900 uppercase tracking-tight">Basic Information</h2>
                <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">Primary details</p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Product Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="h-11 text-sm font-medium border-gray-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 rounded-xl bg-gray-50/50 px-4 transition-all"
                    placeholder="Enter product title..."
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Category</Label>
                  <Select value={formData.category} onValueChange={(v) => handleInputChange('category', v)}>
                    <SelectTrigger className="h-11 bg-gray-50/50 border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500/10 transition-all flex items-center px-4 font-medium text-gray-900 text-sm">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-gray-100 shadow-xl p-2 bg-white">
                      <SelectItem value="none" className="rounded-lg py-2 font-medium transition-colors text-sm">Unassigned</SelectItem>
                      {categories.map((c: any) => (
                        <SelectItem key={c.id} value={c.id} className="rounded-lg py-2 font-medium transition-colors cursor-pointer text-sm">{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Requires Shipping</Label>
                  <div className="h-11 rounded-xl bg-gray-50/50 border border-gray-100 px-4 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      {formData.requiresShipping ? 'Yes' : 'No'}
                    </span>
                    <Switch
                      checked={formData.requiresShipping}
                      onCheckedChange={(checked) => handleInputChange('requiresShipping', checked)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={4}
                    className="border-gray-100 rounded-xl p-4 leading-relaxed text-sm font-medium text-gray-700 bg-gray-50/50 resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                    placeholder="Write a compelling product description..."
                  />
                </div>
              </div>
            </section>

            {/* Product Media Section */}
            <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-6">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-gray-900 uppercase tracking-tight">Product Media</h2>
                <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">Gallery images</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="aspect-square border-2 border-dashed border-gray-100 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-all group overflow-hidden bg-gray-50/30">
                  {isUploading ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  ) : (
                    <div className="text-center p-3">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                        <Plus className="w-5 h-5 text-blue-600" />
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 group-hover:text-blue-600 uppercase tracking-widest block">Upload</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                </label>

                {formData.images.map((img, idx) => (
                  <div key={idx} className="group relative aspect-square bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                    <Image src={img} alt="Product" fill className="object-cover transition-transform group-hover:scale-105 duration-500" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setFormData(p => ({ ...p, images: p.images.filter((_, i) => i !== idx) }))}
                        className="bg-white/90 hover:bg-white text-red-500 rounded-xl w-10 h-10 shadow-xl hover:scale-110 transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column: Inventory & Pricing */}
          <div className="lg:col-span-2">
            <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-6 h-full">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-gray-900 uppercase tracking-tight">Inventory & Pricing</h2>
                <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">Configure variants, price points and stock levels</p>
              </div>

              <VariantsEditor
                variants={formData.variants || []}
                onChange={(v) => {
                  handleInputChange('variants', v)
                  setSuccessMode(false)
                }}
                productId={productId}
              />
            </section>
          </div>
        </div>

        {/* SEO Configuration Section */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <SeoMetaEditor
            value={formData.seoMeta}
            onChange={(seoData) => {
              handleInputChange('seoMeta', seoData)
              setSuccessMode(false)
            }}
            entityType="product"
          />
        </div>

        {/* Action Footer */}
        <div className="pt-2 flex items-center justify-between pb-6">
          <p className="text-xs text-gray-400 font-medium">Last synced: Just now</p>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Auto-save Enabled</span>
          </div>
        </div>
      </div>

    </div>
  )
}
