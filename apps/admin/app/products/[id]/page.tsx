'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  ShareIcon,
  HeartIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline'

interface Product {
  id: number
  name: string
  description: string
  shortDescription: string
  category: string
  price: number
  comparePrice?: number
  cost?: number
  sku: string
  barcode?: string
  stock: number
  lowStockThreshold: number
  weight?: number
  dimensions?: {
    length: number
    width: number
    height: number
  }
  images: string[]
  status: 'active' | 'draft' | 'archived'
  featured: boolean
  tags: string[]
  sales: number
  views: number
  createdAt: string
  updatedAt: string
  seoTitle?: string
  seoDescription?: string
}

// Mock product data
const mockProducts: Record<string, Product> = {
  '1': {
    id: 1,
    name: 'iPhone 15 Pro Max',
    description: 'The iPhone 15 Pro Max features a titanium design, A17 Pro chip, and an advanced camera system with 5x telephoto zoom. Experience the most powerful iPhone ever with incredible performance and battery life.',
    shortDescription: 'The most advanced iPhone with titanium design and A17 Pro chip',
    category: 'Electronics',
    price: 9999,
    comparePrice: 10999,
    cost: 7500,
    sku: 'IPH15PM001',
    barcode: '1234567890123',
    stock: 45,
    lowStockThreshold: 10,
    weight: 0.221,
    dimensions: {
      length: 15.99,
      width: 7.69,
      height: 0.83
    },
    images: [
      'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500&h=500&fit=crop',
      'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&h=500&fit=crop',
      'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=500&h=500&fit=crop'
    ],
    status: 'active',
    featured: true,
    tags: ['smartphone', 'apple', 'premium', 'flagship'],
    sales: 234,
    views: 1567,
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-06-01T14:20:00Z',
    seoTitle: 'iPhone 15 Pro Max - Premium Smartphone | Jiffoo Mall',
    seoDescription: 'Buy the latest iPhone 15 Pro Max with titanium design and A17 Pro chip. Free shipping and warranty included.'
  }
}

export default function ProductDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState(0)

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true)
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        const productId = params.id as string
        const productData = mockProducts[productId]
        
        if (productData) {
          setProduct(productData)
        } else {
          // Product not found
          router.push('/products')
        }
      } catch (error) {
        console.error('Failed to fetch product:', error)
        router.push('/products')
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [params.id, router])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      case 'archived':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading product...</p>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Product not found</h2>
        <p className="text-gray-600 mb-6">The product you're looking for doesn't exist.</p>
        <Link href="/products">
          <Button>Back to Products</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Link href="/products">
            <Button variant="outline" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to Products
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
            <p className="text-gray-600">SKU: {product.sku}</p>
          </div>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" size="sm">
            <ShareIcon className="w-4 h-4 mr-2" />
            Share
          </Button>
          <Link href={`/products/${product.id}/edit`}>
            <Button variant="outline" size="sm">
              <PencilIcon className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
            <TrashIcon className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Images */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={product.images[selectedImage]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                {product.images.length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {product.images.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImage(index)}
                        className={`aspect-square rounded-lg overflow-hidden border-2 ${
                          selectedImage === index ? 'border-blue-500' : 'border-gray-200'
                        }`}
                      >
                        <img
                          src={image}
                          alt={`${product.name} ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Product Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Product Information</CardTitle>
                <div className="flex items-center space-x-2">
                  <Badge className={getStatusColor(product.status)}>
                    {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                  </Badge>
                  {product.featured && (
                    <Badge className="bg-yellow-100 text-yellow-800">
                      Featured
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Description</h3>
                <p className="text-gray-600">{product.description}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900">Category</h4>
                  <p className="text-gray-600">{product.category}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Tags</h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {product.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing & Inventory */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Price</span>
                  <span className="text-2xl font-bold text-gray-900">¥{product.price.toLocaleString()}</span>
                </div>
                {product.comparePrice && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Compare Price</span>
                    <span className="text-gray-500 line-through">¥{product.comparePrice.toLocaleString()}</span>
                  </div>
                )}
                {product.cost && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Cost</span>
                    <span className="text-gray-600">¥{product.cost.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-gray-600">Profit Margin</span>
                  <span className="font-medium text-green-600">
                    {product.cost ? Math.round(((product.price - product.cost) / product.price) * 100) : 0}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inventory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Stock</span>
                  <span className={`font-medium ${product.stock <= product.lowStockThreshold ? 'text-red-600' : 'text-gray-900'}`}>
                    {product.stock} units
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Low Stock Alert</span>
                  <span className="text-gray-600">{product.lowStockThreshold} units</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Barcode</span>
                  <span className="text-gray-600 font-mono text-sm">{product.barcode || 'N/A'}</span>
                </div>
                {product.stock <= product.lowStockThreshold && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800 text-sm font-medium">⚠️ Low Stock Alert</p>
                    <p className="text-red-600 text-sm">Stock is running low. Consider restocking soon.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
