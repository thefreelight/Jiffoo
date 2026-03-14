'use client'

/**
 * Create Product Page - Immersive Industrial Power Design
 * Aligned with the high-impact edit page design language.
 */

import { ArrowLeft, Plus, X, ImageIcon, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
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

import { useCreateProduct, useUploadProductImage, useCategories } from '@/lib/hooks/use-api'
import { useT } from 'shared/src/i18n/react'
import { VariantsEditor } from '@/components/products/VariantsEditor'
import { generateId } from '@/lib/utils'
import { toast } from 'sonner'

interface ProductFormData {
  name: string
  description: string
  category: string
  requiresShipping: boolean
  images: string[]
  variants: Array<{
    id?: string
    tempId?: string
    name: string
    salePrice: number
    baseStock: number
    skuCode?: string
    isActive?: boolean
  }>
}

export default function CreateProductPage() {
  const router = useRouter()
  const t = useT()

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  // Use React Query hooks
  const createProductMutation = useCreateProduct()
  const uploadImageMutation = useUploadProductImage()
  const { data: categories = [] } = useCategories()
  const [isUploading, setIsUploading] = useState(false)

  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    category: 'none',
    requiresShipping: true,
    images: [],
    variants: [{
      tempId: generateId(),
      name: 'Base Variant',
      salePrice: 0,
      baseStock: 0,
      isActive: true,
      skuCode: ''
    }]
  })

  const handleInputChange = (field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }))
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
    } catch (error) {
      console.error('Failed to upload images:', error)
      toast.error(getText('common.errors.general', 'Something went wrong. Please try again.'))
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    if (!formData.name.trim()) {
      toast.error(getText('common.validation.required', 'This field is required'))
      return
    }

    try {
      const productData = {
        name: formData.name,
        description: formData.description,
        categoryId: formData.category === 'none' ? null : formData.category,
        requiresShipping: formData.requiresShipping,
        images: formData.images,
        variants: formData.variants
      }

      await createProductMutation.mutateAsync(productData as any)
      toast.success('Product created successfully')
      router.push('/products')
    } catch (error) {
      console.error('Failed to create product:', error)
    }
  }

  return (
    <div className="w-full bg-[#fcfdfe] min-h-screen">
      {/* Header Bar */}
      <div className="border-b border-gray-100 pl-20 pr-8 lg:px-8 py-4 sticky top-0 bg-white/80 backdrop-blur-md z-50 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="hover:bg-gray-100 rounded-xl w-10 h-10">
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-none">
              {getText('products.create.title', 'Create New Product')}
            </h1>
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">Product Management</span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={() => router.push('/products')} className="text-gray-500 border-gray-200 hover:bg-gray-50 font-semibold text-sm rounded-xl h-10 px-6">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createProductMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-8 h-10 rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
          >
            {createProductMutation.isPending ? 'Sending...' : 'Save Product'}
          </Button>
        </div>
      </div>

      <div className="w-full px-10 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm space-y-8">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-gray-900">Basic Information</h2>
                <p className="text-gray-400 text-xs">Primary details for the storefront</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Product Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="h-12 text-base font-medium border-gray-100 focus:border-blue-500 focus:ring-0 rounded-2xl bg-gray-50/50 px-6 transition-all"
                    placeholder="Enter product title..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Category</Label>
                    <Select value={formData.category} onValueChange={(v) => handleInputChange('category', v)}>
                      <SelectTrigger className="h-12 bg-gray-50/50 border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 flex items-center px-6 font-medium text-gray-900 transition-all">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-gray-100 shadow-2xl p-2 bg-white">
                        <SelectItem value="none" className="rounded-xl py-2.5 font-medium transition-colors">Unassigned</SelectItem>
                        {categories.map((c: any) => (
                          <SelectItem key={c.id} value={c.id} className="rounded-xl py-2.5 font-medium transition-colors">{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Requires Shipping</Label>
                    <div className="h-12 rounded-2xl bg-gray-50/50 border border-gray-100 px-4 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        {formData.requiresShipping ? 'Yes' : 'No'}
                      </span>
                      <Switch
                        checked={formData.requiresShipping}
                        onCheckedChange={(checked) => handleInputChange('requiresShipping', checked)}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={6}
                    className="border-gray-100 rounded-2xl p-6 leading-relaxed text-sm font-medium text-gray-700 bg-gray-50/50 resize-none focus:border-blue-500 focus:ring-0 transition-all"
                    placeholder="Full product details..."
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm space-y-8">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-gray-900">Inventory & Pricing</h2>
                <p className="text-gray-400 text-xs">Configure variant specifications</p>
              </div>

              <VariantsEditor
                variants={formData.variants || []}
                onChange={(v) => handleInputChange('variants', v)}
              />
            </div>
          </div>

          {/* Media & Actions */}
          <div className="space-y-8">
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm space-y-6">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-gray-900">Product Media</h2>
                <p className="text-gray-400 text-xs">Upload gallery images</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="aspect-square border-2 border-dashed border-gray-100 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-all group overflow-hidden">
                  {isUploading ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  ) : (
                    <div className="text-center">
                      <Plus className="w-8 h-8 text-gray-300 group-hover:text-blue-500 mx-auto" />
                      <span className="text-[10px] font-bold text-gray-400 group-hover:text-blue-500 uppercase tracking-widest mt-2 block">Upload</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                </label>

                {formData.images.map((img, idx) => (
                  <div key={idx} className="group relative aspect-square bg-gray-50 rounded-3xl overflow-hidden border border-gray-100">
                    <Image src={img} alt="Asset" fill className="object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setFormData(p => ({ ...p, images: p.images.filter((_, i) => i !== idx) }))}
                        className="bg-white/90 hover:bg-white text-red-500 rounded-full w-10 h-10 shadow-lg"
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
