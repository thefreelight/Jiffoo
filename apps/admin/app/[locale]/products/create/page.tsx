'use client'

/**
 * Create Product Page
 *
 * Page for creating new products in the tenant dashboard.
 * Supports internationalization via useT hook.
 */

import { ArrowLeft, Plus, X, ImageIcon } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

import { useCreateProduct, useUploadProductImage } from '@/lib/hooks/use-api'
import { useT } from 'shared/src/i18n/react'


interface ProductFormData {
  name: string
  description: string
  shortDescription: string
  category: string
  price: number
  comparePrice: number
  cost: number
  sku: string
  barcode: string
  trackQuantity: boolean
  quantity: number
  lowStockThreshold: number
  weight: number
  dimensions: {
    length: number
    width: number
    height: number
  }
  seoTitle: string
  seoDescription: string
  tags: string[]
  images: string[]
  status: 'active' | 'draft' | 'archived'
  featured: boolean
}

const categories = [
  'Electronics',
  'Fashion',
  'Home & Garden',
  'Sports & Outdoors',
  'Books',
  'Toys & Games',
  'Health & Beauty',
  'Automotive',
  'Food & Beverages',
  'Other'
]

export default function CreateProductPage() {
  const router = useRouter()
  const [currentTag, setCurrentTag] = useState('')
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Use React Query hooks
  const createProductMutation = useCreateProduct()
  const uploadImageMutation = useUploadProductImage()
  const [isUploading, setIsUploading] = useState(false)

  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    shortDescription: '',
    category: '',
    price: 0,
    comparePrice: 0,
    cost: 0,
    sku: '',
    barcode: '',
    trackQuantity: true,
    quantity: 0,
    lowStockThreshold: 5,
    weight: 0,
    dimensions: {
      length: 0,
      width: 0,
      height: 0
    },
    seoTitle: '',
    seoDescription: '',
    tags: [],
    images: [],
    status: 'draft',
    featured: false
  })

  const handleInputChange = (field: string, value: unknown) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.')
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof ProductFormData] as Record<string, unknown>),
          [child]: value
        }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  const addTag = () => {
    if (currentTag.trim() && !formData.tags.includes(currentTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, currentTag.trim()]
      }))
      setCurrentTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  // Handle image file selection and upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          throw new Error(`${file.name} is not an image file`)
        }
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`${file.name} exceeds 5MB limit`)
        }
        const result = await uploadImageMutation.mutateAsync(file)
        return result?.url ?? ''
      })

      const uploadedUrls = await Promise.all(uploadPromises)
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...uploadedUrls]
      }))
    } catch (error) {
      console.error('Failed to upload images:', error)
    } finally {
      setIsUploading(false)
      // Reset file input
      e.target.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // Prepare API data format, matching the format expected by the backend API
      // ✅ Backend schema expects images as string[], not JSON string
      const productData = {
        name: formData.name,
        description: formData.description,
        price: formData.price,
        stock: formData.quantity,
        images: formData.images  // ✅ Pass array directly, not JSON.stringify
      }

      // Use React Query mutation
      await createProductMutation.mutateAsync(productData as Record<string, unknown>)

      // Redirect to product list after success
      router.push('/products')
    } catch (error) {
      console.error('Failed to create product:', error)
      // toast is already handled in the hook, no extra handling needed here
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {getText('merchant.products.create.back', 'Back')}
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{getText('merchant.products.create.title', 'Add New Product')}</h1>
            <p className="text-gray-600">{getText('merchant.products.create.subtitle', 'Create a new product for your store')}</p>
          </div>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => router.push('/products')}>
            {getText('merchant.products.create.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createProductMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {createProductMutation.isPending ? getText('merchant.products.create.creating', 'Creating...') : getText('merchant.products.create.createProduct', 'Create Product')}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>{getText('merchant.products.create.basicInfo', 'Basic Information')}</CardTitle>
                <CardDescription>{getText('merchant.products.create.basicInfoDesc', 'Essential product details')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">{getText('merchant.products.create.productNameLabel', 'Product Name *')}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder={getText('merchant.products.create.productNamePlaceholder', 'Enter product name')}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="shortDescription">{getText('merchant.products.create.shortDescription', 'Short Description')}</Label>
                  <Textarea
                    id="shortDescription"
                    value={formData.shortDescription}
                    onChange={(e) => handleInputChange('shortDescription', e.target.value)}
                    placeholder={getText('merchant.products.create.shortDescriptionPlaceholder', 'Brief product description')}
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="description">{getText('merchant.products.create.fullDescription', 'Full Description')}</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder={getText('merchant.products.create.fullDescriptionPlaceholder', 'Detailed product description')}
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle>{getText('merchant.products.create.pricing', 'Pricing')}</CardTitle>
                <CardDescription>{getText('merchant.products.create.pricingDesc', 'Set your product pricing')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="price">{getText('merchant.products.create.priceLabel', 'Price *')}</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price || ''}
                      onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="comparePrice">{getText('merchant.products.create.comparePrice', 'Compare Price')}</Label>
                    <Input
                      id="comparePrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.comparePrice || ''}
                      onChange={(e) => handleInputChange('comparePrice', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cost">{getText('merchant.products.create.costPerItem', 'Cost per item')}</Label>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.cost || ''}
                      onChange={(e) => handleInputChange('cost', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Inventory */}
            <Card>
              <CardHeader>
                <CardTitle>{getText('merchant.products.create.inventory', 'Inventory')}</CardTitle>
                <CardDescription>{getText('merchant.products.create.inventoryDesc', 'Track product inventory')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="trackQuantity"
                    checked={formData.trackQuantity}
                    onCheckedChange={(checked) => handleInputChange('trackQuantity', checked)}
                  />
                  <Label htmlFor="trackQuantity">{getText('merchant.products.create.trackQuantity', 'Track quantity')}</Label>
                </div>

                {formData.trackQuantity && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="quantity">{getText('merchant.products.create.quantityLabel', 'Quantity *')}</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="0"
                        value={formData.quantity || ''}
                        onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 0)}
                        placeholder="0"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="lowStockThreshold">{getText('merchant.products.create.lowStockThreshold', 'Low stock threshold')}</Label>
                      <Input
                        id="lowStockThreshold"
                        type="number"
                        min="0"
                        value={formData.lowStockThreshold || ''}
                        onChange={(e) => handleInputChange('lowStockThreshold', parseInt(e.target.value) || 0)}
                        placeholder="5"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sku">{getText('merchant.products.create.skuLabel', 'SKU')}</Label>
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => handleInputChange('sku', e.target.value)}
                      placeholder={getText('merchant.products.create.skuPlaceholder', 'Product SKU')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="barcode">{getText('merchant.products.create.barcodeLabel', 'Barcode')}</Label>
                    <Input
                      id="barcode"
                      value={formData.barcode}
                      onChange={(e) => handleInputChange('barcode', e.target.value)}
                      placeholder={getText('merchant.products.create.barcodePlaceholder', 'Product barcode')}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipping */}
            <Card>
              <CardHeader>
                <CardTitle>{getText('merchant.products.create.shipping', 'Shipping')}</CardTitle>
                <CardDescription>{getText('merchant.products.create.shippingDesc', 'Physical product information')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="weight">{getText('merchant.products.create.weight', 'Weight (kg)')}</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.weight || ''}
                    onChange={(e) => handleInputChange('weight', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>{getText('merchant.products.create.dimensions', 'Dimensions (cm)')}</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.dimensions.length || ''}
                      onChange={(e) => handleInputChange('dimensions.length', parseFloat(e.target.value) || 0)}
                      placeholder={getText('merchant.products.create.lengthPlaceholder', 'Length')}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.dimensions.width || ''}
                      onChange={(e) => handleInputChange('dimensions.width', parseFloat(e.target.value) || 0)}
                      placeholder={getText('merchant.products.create.widthPlaceholder', 'Width')}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.dimensions.height || ''}
                      onChange={(e) => handleInputChange('dimensions.height', parseFloat(e.target.value) || 0)}
                      placeholder={getText('merchant.products.create.heightPlaceholder', 'Height')}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SEO */}
            <Card>
              <CardHeader>
                <CardTitle>{getText('merchant.products.create.seo', 'Search Engine Optimization')}</CardTitle>
                <CardDescription>{getText('merchant.products.create.seoDesc', "Improve your product's search visibility")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="seoTitle">{getText('merchant.products.create.seoTitle', 'SEO Title')}</Label>
                  <Input
                    id="seoTitle"
                    value={formData.seoTitle}
                    onChange={(e) => handleInputChange('seoTitle', e.target.value)}
                    placeholder={getText('merchant.products.create.seoTitlePlaceholder', 'SEO optimized title')}
                  />
                </div>
                <div>
                  <Label htmlFor="seoDescription">{getText('merchant.products.create.seoDescription', 'SEO Description')}</Label>
                  <Textarea
                    id="seoDescription"
                    value={formData.seoDescription}
                    onChange={(e) => handleInputChange('seoDescription', e.target.value)}
                    placeholder={getText('merchant.products.create.seoDescriptionPlaceholder', 'SEO meta description')}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle>{getText('merchant.products.create.productStatus', 'Product Status')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="status">{getText('merchant.products.create.statusLabel', 'Status')}</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: 'active' | 'draft' | 'archived') => handleInputChange('status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">{getText('merchant.products.create.statusDraft', 'Draft')}</SelectItem>
                      <SelectItem value="active">{getText('merchant.products.create.statusActive', 'Active')}</SelectItem>
                      <SelectItem value="archived">{getText('merchant.products.create.statusArchived', 'Archived')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="featured"
                    checked={formData.featured}
                    onCheckedChange={(checked) => handleInputChange('featured', checked)}
                  />
                  <Label htmlFor="featured">{getText('merchant.products.create.featuredProduct', 'Featured product')}</Label>
                </div>
              </CardContent>
            </Card>

            {/* Category */}
            <Card>
              <CardHeader>
                <CardTitle>{getText('merchant.products.create.organization', 'Organization')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="category">{getText('merchant.products.create.categoryLabel', 'Category')}</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => handleInputChange('category', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={getText('merchant.products.create.selectCategory', 'Select category')} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="tags">{getText('merchant.products.create.tagsLabel', 'Tags')}</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="tags"
                      value={currentTag}
                      onChange={(e) => setCurrentTag(e.target.value)}
                      placeholder={getText('merchant.products.create.addTag', 'Add tag')}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addTag()
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addTag}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="ml-1 text-blue-600 hover:text-blue-800"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Images */}
            <Card>
              <CardHeader>
                <CardTitle>{getText('merchant.products.create.productImages', 'Product Images')}</CardTitle>
                <CardDescription>{getText('merchant.products.create.productImagesDesc', 'Add product photos')}</CardDescription>
              </CardHeader>
              <CardContent>
                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                    {isUploading ? (
                      <>
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                        <p className="text-gray-600">{getText('merchant.products.create.uploading', 'Uploading...')}</p>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-2">{getText('merchant.products.create.dragDropImages', 'Drag and drop images here')}</p>
                        <p className="text-sm text-gray-500 mb-4">{getText('merchant.products.create.orClickBrowse', 'or click to browse')}</p>
                        <span className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                          {getText('merchant.products.create.chooseFiles', 'Choose Files')}
                        </span>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                  />
                </label>
                <p className="text-xs text-gray-500 mt-2">{getText('merchant.products.create.imageHint', 'Supports JPG, PNG, GIF. Max 5MB per file.')}</p>
                {formData.images.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    {formData.images.map((image, index) => (
                      <div key={index} className="relative">
                        <Image
                          src={image}
                          alt={`Product ${index + 1}`}
                          width={96}
                          height={96}
                          className="w-full h-24 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              images: prev.images.filter((_, i) => i !== index)
                            }))
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  )
}
