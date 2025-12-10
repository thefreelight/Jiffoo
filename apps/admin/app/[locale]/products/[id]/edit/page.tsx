/**
 * Product Edit Page
 *
 * Allows editing of product information including name, description,
 * price, stock quantity, and images.
 */
'use client'

import { ArrowLeft } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useT } from 'shared/src/i18n'

import { useProduct, useUpdateProduct } from '@/lib/hooks/use-api'


interface ProductFormData {
  name: string
  description: string
  price: number
  quantity: number
  images: string[]
}

export default function EditProductPage() {
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string
  const t = useT()

  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  // Use React Query hooks
  const { data: product, isLoading, error } = useProduct(productId)
  const updateProductMutation = useUpdateProduct()

  console.log('Product ID:', productId); // Debug log
  console.log('Product data:', product); // Debug log
  console.log('Is loading:', isLoading); // Debug log
  console.log('Error:', error); // Debug log

  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    price: 0,
    quantity: 0,
    images: []
  })

  // Fill form when product data is loaded
  useEffect(() => {
    if (product) {
      console.log('Loading product data into form:', product); // Debug log

      // Parse image data
      let images: string[] = []
      if (product.images) {
        if (Array.isArray(product.images)) {
          // If it's already an array of ProductImage objects, extract URLs
          images = product.images.map(img => typeof img === 'string' ? img : img.url)
        } else if (typeof product.images === 'string') {
          const imageString = product.images
          try {
            const parsed = JSON.parse(imageString)
            images = Array.isArray(parsed) ? parsed : []
          } catch {
            // If JSON parsing fails, treat as a single URL
            images = (imageString as string).startsWith('http') ? [imageString] : []
          }
        }
      }

      const newFormData = {
        name: product.name || '',
        description: product.description || '',
        price: Number(product.price) || 0,
        quantity: Number(product.stock) || 0,
        images: images
      }

      console.log('Setting form data:', newFormData); // Debug log
      setFormData(newFormData)
    }
  }, [product])

  const handleInputChange = (field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // Only submit fields that exist in database
      const productData = {
        name: formData.name,
        description: formData.description,
        price: formData.price,
        stock: formData.quantity,
        images: formData.images.length > 0 ? JSON.stringify(formData.images) : JSON.stringify([])
      }

      console.log('Submitting product data:', productData); // Debug log

      // Use React Query mutation
      await updateProductMutation.mutateAsync({ id: productId, data: productData as Record<string, unknown> })

      // Redirect to product list after success
      router.push('/products')
    } catch (error) {
      console.error('Failed to update product:', error)
      // Toast is already handled in hook, no need for additional handling here
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">{getText('tenant.products.edit.loading', 'Loading product information...')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-lg font-semibold text-red-800 mb-2">{getText('tenant.products.edit.productNotFound', 'Product Not Found')}</h2>
            <p className="text-red-600 mb-4">
              {error.message.includes('404')
                ? getText('tenant.products.edit.productNotFoundDesc', 'This product does not exist or has been deleted')
                : `${getText('tenant.products.edit.loadFailed', 'Failed to load product information')}: ${error.message}`}
            </p>
            <Button onClick={() => router.push('/products')}>
              {getText('tenant.products.edit.backToList', 'Back to Product List')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // 如果没有商品数据，显示错误
  if (!product) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md">
            <h2 className="text-lg font-semibold text-yellow-800 mb-2">{getText('tenant.products.edit.productDataEmpty', 'Product Data Empty')}</h2>
            <p className="text-yellow-600 mb-4">{getText('tenant.products.edit.unableToRetrieve', 'Unable to retrieve product information')}</p>
            <Button onClick={() => router.push('/products')}>
              {getText('tenant.products.edit.backToList', 'Back to Product List')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Debug Panel - Temporary debug panel */}
      <div className="mb-4 p-4 bg-gray-100 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">{getText('tenant.products.edit.debugInfo', 'Debug Information')}</h3>
        <div className="text-xs text-gray-600 space-y-1">
          <div>Product ID: {productId}</div>
          <div>{getText('tenant.products.edit.loadingStatus', 'Loading Status')}: {isLoading ? getText('tenant.products.edit.loadingText', 'Loading') : getText('tenant.products.edit.completedText', 'Completed')}</div>
          <div>Product Name: {formData.name || getText('tenant.products.edit.notSet', 'Not set')}</div>
          <div>Product Price: {formData.price || getText('tenant.products.edit.notSet', 'Not set')}</div>
          <div>Product Stock: {formData.quantity || getText('tenant.products.edit.notSet', 'Not set')}</div>
          <div>Product Description: {formData.description ? getText('tenant.products.edit.set', 'Set') : getText('tenant.products.edit.notSet', 'Not set')}</div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {getText('tenant.products.edit.back', 'Back')}
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{getText('tenant.products.edit.title', 'Edit Product')}</h1>
            <p className="text-gray-600">{getText('tenant.products.edit.subtitle', 'Modify product information')} - {formData.name || getText('tenant.products.edit.unnamedProduct', 'Unnamed Product')}</p>
          </div>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => router.push('/products')}>
            {getText('tenant.products.edit.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateProductMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {updateProductMutation.isPending ? getText('tenant.products.edit.saving', 'Saving...') : getText('tenant.products.edit.saveChanges', 'Save Changes')}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Main Content */}
          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>{getText('tenant.products.edit.basicInfo', 'Basic Information')}</CardTitle>
                <CardDescription>{getText('tenant.products.edit.basicInfoDesc', 'Basic product details')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">{getText('tenant.products.edit.productNameLabel', 'Product Name *')}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder={getText('tenant.products.edit.productNamePlaceholder', 'Enter product name')}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">{getText('tenant.products.edit.productDescription', 'Product Description')}</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder={getText('tenant.products.edit.productDescPlaceholder', 'Detailed product description')}
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pricing and Inventory */}
            <Card>
              <CardHeader>
                <CardTitle>{getText('tenant.products.edit.pricingInventory', 'Pricing and Inventory')}</CardTitle>
                <CardDescription>{getText('tenant.products.edit.pricingInventoryDesc', 'Set product price and stock quantity')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price">{getText('tenant.products.edit.priceLabel', 'Price *')}</Label>
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
                    <Label htmlFor="quantity">{getText('tenant.products.edit.stockQuantity', 'Stock Quantity *')}</Label>
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
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Images */}
            <Card>
              <CardHeader>
                <CardTitle>{getText('tenant.products.edit.productImages', 'Product Images')}</CardTitle>
                <CardDescription>{getText('tenant.products.edit.productImagesDesc', 'Upload product images')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{getText('tenant.products.edit.currentImages', 'Current Images')}</Label>
                  {formData.images.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {formData.images.map((image, index) => (
                        <div key={index} className="relative">
                          <Image
                            src={image}
                            alt={`Product ${index + 1}`}
                            width={96}
                            height={96}
                            className="w-full h-24 object-cover rounded border"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newImages = formData.images.filter((_, i) => i !== index)
                              handleInputChange('images', newImages)
                            }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">{getText('tenant.products.edit.noImages', 'No images')}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="imageUrl">{getText('tenant.products.edit.addImageUrl', 'Add Image URL')}</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="imageUrl"
                      placeholder={getText('tenant.products.edit.addImagePlaceholder', 'Enter image URL')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const input = e.target as HTMLInputElement
                          if (input.value.trim()) {
                            handleInputChange('images', [...formData.images, input.value.trim()])
                            input.value = ''
                          }
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const input = document.getElementById('imageUrl') as HTMLInputElement
                        if (input.value.trim()) {
                          handleInputChange('images', [...formData.images, input.value.trim()])
                          input.value = ''
                        }
                      }}
                    >
                      {getText('tenant.products.edit.add', 'Add')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>{getText('tenant.products.edit.quickActions', 'Quick Actions')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  type="submit"
                  disabled={updateProductMutation.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {updateProductMutation.isPending ? getText('tenant.products.edit.saving', 'Saving...') : getText('tenant.products.edit.saveChanges', 'Save Changes')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/products')}
                  className="w-full"
                >
                  {getText('tenant.products.edit.cancelEdit', 'Cancel Edit')}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  )
}