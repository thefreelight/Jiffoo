'use client'

/**
 * Order Detail Page
 *
 * Displays detailed information about a specific order.
 * Supports internationalization via useT hook.
 */

import { AlertTriangle, ArrowLeft, Calendar, CreditCard, ShoppingBag, Truck, User } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { useOrder } from '@/lib/hooks/use-api'
import { useT } from 'shared/src/i18n'


export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string
  const t = useT()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const { data: order, isLoading, error, refetch } = useOrder(orderId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{getText('tenant.orders.detail.loading', 'Loading order details...')}</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{getText('tenant.orders.detail.orderNotFound', 'Order Not Found')}</h2>
          <p className="text-gray-600 mb-6">{getText('tenant.orders.detail.orderNotFoundDesc', "The order you're looking for doesn't exist or has been deleted.")}</p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {getText('tenant.orders.detail.goBack', 'Go Back')}
            </Button>
            <Button onClick={() => refetch()}>
              {getText('tenant.orders.detail.retry', 'Retry')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      SHIPPED: 'bg-purple-100 text-purple-800',
      DELIVERED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
    }
    return statusColors[status] || 'bg-gray-100 text-gray-800'
  }

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
            {getText('tenant.orders.detail.back', 'Back')}
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{getText('tenant.orders.orderNumber', 'Order #')}{order.id}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {getText('tenant.orders.detail.placedOn', 'Placed on')} {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        <div>
          <span className={`px-4 py-2 text-sm font-medium rounded-full ${getStatusColor(order.status)}`}>
            {order.status}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              {getText('tenant.orders.detail.orderItems', 'Order Items')}
            </h2>
            <div className="space-y-4">
              {order.items && order.items.length > 0 ? (
                order.items.map((item) => (
                  <div key={item.id} className="flex gap-4 p-4 border border-gray-200 rounded-lg">
                    <div className="w-20 h-20 relative bg-gray-100 rounded overflow-hidden flex-shrink-0">
                      {item.product?.images && item.product.images.length > 0 ? (
                        <Image
                          src={item.product.images[0].url}
                          alt={item.product.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <ShoppingBag className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{item.product?.name || getText('tenant.orders.unknown', 'Unknown Product')}</h3>
                      <p className="text-sm text-gray-500 mt-1">{getText('tenant.products.detail.productId', 'Product ID')}: {item.productId}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-sm text-gray-600">{getText('tenant.orders.detail.qty', 'Qty:')} {item.quantity}</span>
                        <span className="text-sm text-gray-600">{getText('tenant.orders.detail.unitPrice', 'Unit Price:')} ¥{(item.unitPrice || item.price || 0).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-gray-900">
                        ¥{(item.quantity * (item.unitPrice || item.price || 0)).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">{getText('tenant.orders.detail.noItems', 'No items in this order')}</p>
              )}
            </div>

            {/* Order Total */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">{getText('tenant.orders.detail.totalAmount', 'Total Amount')}</span>
                <span className="text-2xl font-bold text-gray-900">¥{order.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Order Info Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              {getText('tenant.orders.detail.customer', 'Customer')}
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">{getText('tenant.orders.detail.name', 'Name')}</p>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {order.user?.username || order.user?.name || getText('tenant.orders.unknown', 'Unknown')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{getText('tenant.orders.detail.email', 'Email')}</p>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {order.user?.email || order.customerEmail || getText('common.na', 'N/A')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{getText('tenant.orders.detail.userId', 'User ID')}</p>
                <p className="text-sm font-medium text-gray-900 mt-1 break-all">
                  {order.userId}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              {getText('tenant.orders.detail.payment', 'Payment')}
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">{getText('tenant.orders.detail.status', 'Status')}</span>
                <span className={`text-sm font-medium px-2 py-1 rounded ${getStatusColor(order.status)}`}>
                  {order.status}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">{getText('tenant.orders.detail.total', 'Total')}</span>
                <span className="text-sm font-medium text-gray-900">¥{order.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Shipping Info */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5" />
              {getText('tenant.orders.detail.shipping', 'Shipping')}
            </h2>
            <div className="space-y-2">
              {order.shippingAddress ? (
                <div className="text-sm text-gray-700">
                  <p>{order.shippingAddress.street}</p>
                  <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}</p>
                  <p>{order.shippingAddress.country}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">{getText('tenant.orders.detail.noShippingAddress', 'No shipping address provided')}</p>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {getText('tenant.orders.detail.timeline', 'Timeline')}
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">{getText('tenant.orders.detail.created', 'Created')}</span>
                <span className="text-sm font-medium text-gray-900">
                  {new Date(order.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-gray-500">{getText('tenant.orders.detail.lastUpdated', 'Last Updated')}</span>
                <span className="text-sm font-medium text-gray-900">
                  {new Date(order.updatedAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

