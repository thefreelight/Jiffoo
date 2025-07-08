'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '../../../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useProduct, useUpdateProduct } from '../../../../lib/hooks/use-api'
import { toast } from 'sonner'

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
  
  // 使用React Query hooks
  const { data: product, isLoading, error } = useProduct(productId)
  const updateProductMutation = useUpdateProduct()

  console.log('Product ID:', productId); // 调试日志
  console.log('Product data:', product); // 调试日志
  console.log('Is loading:', isLoading); // 调试日志
  console.log('Error:', error); // 调试日志

  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    description: '',
    price: 0,
    quantity: 0,
    images: []
  })

  // 当商品数据加载完成时，填充表单
  useEffect(() => {
    if (product) {
      console.log('Loading product data into form:', product); // 调试日志
      
      // 解析图片数据
      let images: string[] = []
      if (product.images) {
        try {
          images = JSON.parse(product.images)
        } catch {
          if (product.images.startsWith('http')) {
            images = [product.images]
          }
        }
      }

      const newFormData = {
        name: product.name || '',
        description: product.description || '',
        price: Number(product.price) || 0,
        quantity: Number(product.stock || product.quantity) || 0,
        images: images
      }

      console.log('Setting form data:', newFormData); // 调试日志
      setFormData(newFormData)
    }
  }, [product])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // 只提交数据库中存在的字段
      const productData = {
        name: formData.name,
        description: formData.description,
        price: formData.price,
        stock: formData.quantity,
        images: formData.images.length > 0 ? JSON.stringify(formData.images) : JSON.stringify([])
      }

      console.log('提交的商品数据:', productData); // 调试日志

      // 使用React Query mutation
      await updateProductMutation.mutateAsync({ id: productId, data: productData })
      
      // 成功后重定向到商品列表
      router.push('/products')
    } catch (error) {
      console.error('Failed to update product:', error)
      // toast已经在hook中处理了，这里不需要额外处理
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">正在加载商品信息...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <h2 className="text-lg font-semibold text-red-800 mb-2">商品未找到</h2>
            <p className="text-red-600 mb-4">
              {error.message.includes('404') 
                ? '该商品不存在或已被删除' 
                : `加载商品信息失败: ${error.message}`}
            </p>
            <Button onClick={() => router.push('/products')}>
              返回商品列表
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
            <h2 className="text-lg font-semibold text-yellow-800 mb-2">商品数据为空</h2>
            <p className="text-yellow-600 mb-4">无法获取商品信息</p>
            <Button onClick={() => router.push('/products')}>
              返回商品列表
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Debug Panel - 临时调试面板 */}
      <div className="mb-4 p-4 bg-gray-100 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">调试信息</h3>
        <div className="text-xs text-gray-600 space-y-1">
          <div>商品ID: {productId}</div>
          <div>加载状态: {isLoading ? '加载中' : '已完成'}</div>
          <div>商品名称: {formData.name || '未设置'}</div>
          <div>商品价格: {formData.price || '未设置'}</div>
          <div>商品库存: {formData.quantity || '未设置'}</div>
          <div>商品描述: {formData.description ? '已设置' : '未设置'}</div>
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
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            返回
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">编辑商品</h1>
            <p className="text-gray-600">修改商品信息 - {formData.name || '未命名商品'}</p>
          </div>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => router.push('/products')}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateProductMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {updateProductMutation.isPending ? '保存中...' : '保存更改'}
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
                <CardTitle>基本信息</CardTitle>
                <CardDescription>商品的基本详细信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">商品名称 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="输入商品名称"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">商品描述</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="详细的商品描述"
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pricing and Inventory */}
            <Card>
              <CardHeader>
                <CardTitle>价格和库存</CardTitle>
                <CardDescription>设置商品价格和库存数量</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price">价格 *</Label>
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
                    <Label htmlFor="quantity">库存数量 *</Label>
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
                <CardTitle>商品图片</CardTitle>
                <CardDescription>上传商品图片</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>当前图片</Label>
                  {formData.images.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {formData.images.map((image, index) => (
                        <div key={index} className="relative">
                          <img
                            src={image}
                            alt={`Product ${index + 1}`}
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
                    <p className="text-gray-500 text-sm">暂无图片</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="imageUrl">添加图片URL</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="imageUrl"
                      placeholder="输入图片URL"
                      onKeyPress={(e) => {
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
                      添加
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>快速操作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  type="submit"
                  disabled={updateProductMutation.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {updateProductMutation.isPending ? '保存中...' : '保存更改'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/products')}
                  className="w-full"
                >
                  取消编辑
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  )
}