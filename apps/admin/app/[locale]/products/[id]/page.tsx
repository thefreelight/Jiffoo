'use client'

/**
 * Product Detail Page
 *
 * Displays detailed information about a specific product.
 * Includes variant authorization management panel with Self/Children tabs.
 * Supports internationalization via useT hook.
 */

import { AlertTriangle, ArrowLeft, Box, Calendar, DollarSign, Pencil, Tag, Trash2, Settings } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { useProduct, useDeleteProduct } from '@/lib/hooks/use-api'
import { useT } from 'shared/src/i18n'
import { VariantAuthorizationPanel } from '@/components/products/variant-authorization-panel'


export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const { data: product, isLoading, error, refetch } = useProduct(productId)
  const deleteProductMutation = useDeleteProduct()

  const handleDelete = async () => {
    if (window.confirm(getText('tenant.products.detail.deleteConfirm', 'Are you sure you want to delete this product? This action cannot be undone.'))) {
      try {
        await deleteProductMutation.mutateAsync(productId)
        router.push('/products')
      } catch (error) {
        console.error('Failed to delete product:', error)
      }
    }
  }

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { text: getText('tenant.products.outOfStock', 'Out of Stock'), color: 'bg-red-100 text-red-800' }
    if (stock < 10) return { text: getText('tenant.products.lowStock', 'Low Stock'), color: 'bg-yellow-100 text-yellow-800' }
    return { text: getText('tenant.products.inStock', 'In Stock'), color: 'bg-green-100 text-green-800' }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{getText('tenant.products.detail.loading', 'Loading product details...')}</p>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{getText('tenant.products.detail.productNotFound', 'Product Not Found')}</h2>
          <p className="text-gray-600 mb-6">{getText('tenant.products.detail.productNotFoundDesc', "The product you're looking for doesn't exist or has been deleted.")}</p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {getText('tenant.products.detail.goBack', 'Go Back')}
            </Button>
            <Button onClick={() => refetch()}>
              {getText('tenant.products.detail.retry', 'Retry')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const stockStatus = getStockStatus(product.stock || 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {getText('tenant.products.detail.back', 'Back')}
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
            <p className="text-sm text-gray-500 mt-1">{getText('tenant.products.detail.productId', 'Product ID')}: {product.id}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link href={`/products/${productId}/edit`}>
            <Button variant="outline">
              <Pencil className="w-4 h-4 mr-2" />
              {getText('tenant.products.detail.edit', 'Edit')}
            </Button>
          </Link>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteProductMutation.isPending}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {deleteProductMutation.isPending ? getText('tenant.products.detail.deleting', 'Deleting...') : getText('tenant.products.detail.delete', 'Delete')}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Image */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="aspect-square relative bg-gray-100 rounded-lg overflow-hidden">
              {product.images && product.images.length > 0 ? (
                <Image
                  src={product.images[0].url}
                  alt={product.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Box className="w-24 h-24 text-gray-400" />
                </div>
              )}
            </div>
            {product.images && product.images.length > 1 && (
              <div className="mt-4 grid grid-cols-4 gap-2">
                {product.images.slice(1, 5).map((image, index) => (
                  <div key={index} className="aspect-square relative bg-gray-100 rounded overflow-hidden">
                    <Image
                      src={image.url}
                      alt={`${product.name} ${index + 2}`}
                      fill
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Product Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{getText('tenant.products.detail.productInfo', 'Product Information')}</h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <DollarSign className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">{getText('tenant.products.detail.price', 'Price')}</p>
                  <p className="text-2xl font-bold text-gray-900">¥{product.price?.toFixed(2) || '0.00'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Box className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">{getText('tenant.products.detail.stock', 'Stock')}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-2xl font-bold text-gray-900">{product.stock || 0}</p>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${stockStatus.color}`}>
                      {stockStatus.text}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Tag className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">{getText('tenant.products.detail.category', 'Category')}</p>
                  <p className="text-lg font-medium text-gray-900 mt-1">
                    {typeof product.category === 'string' ? product.category : product.category?.name || getText('tenant.products.uncategorized', 'Uncategorized')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">{getText('tenant.products.detail.created', 'Created')}</p>
                  <p className="text-lg font-medium text-gray-900 mt-1">
                    {new Date(product.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Description Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{getText('tenant.products.detail.description', 'Description')}</h2>
            <p className="text-gray-700 leading-relaxed">
              {product.description || getText('tenant.products.detail.noDescription', 'No description available.')}
            </p>
          </div>

          {/* Additional Info Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{getText('tenant.products.detail.additionalInfo', 'Additional Information')}</h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">{getText('tenant.products.detail.productId', 'Product ID')}</span>
                <span className="text-sm font-medium text-gray-900">{product.id}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">{getText('tenant.products.detail.createdAt', 'Created At')}</span>
                <span className="text-sm font-medium text-gray-900">
                  {new Date(product.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-gray-500">{getText('tenant.products.detail.lastUpdated', 'Last Updated')}</span>
                <span className="text-sm font-medium text-gray-900">
                  {new Date(product.updatedAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Variant Authorization Panel */}
      {product.variants && product.variants.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-gray-500" />
            <h2 className="text-xl font-semibold text-gray-900">
              {getText('tenant.products.detail.authorizationSettings', 'Authorization Settings')}
            </h2>
          </div>
          <VariantAuthorizationPanel
            productId={product.id}
            productName={product.name}
            variants={product.variants.map((v: any) => ({
              id: v.id,
              name: v.name,
              basePrice: v.basePrice || v.price || product.price,
              baseStock: v.baseStock || v.stock || 0
            }))}
            onUpdate={() => refetch()}
          />
        </div>
      )}
    </div>
  )
}

