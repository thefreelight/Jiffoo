'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '../../../components/ui/button'
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
  ArrowLeftIcon,
  PrinterIcon,
  TruckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  MapPinIcon,
  CreditCardIcon,
  UserIcon,
} from '@heroicons/react/24/outline'

interface OrderItem {
  id: number
  name: string
  image: string
  sku: string
  price: number
  quantity: number
  total: number
}

interface Order {
  id: string
  customer: {
    name: string
    email: string
    phone: string
    avatar: string
  }
  shippingAddress: {
    name: string
    address: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  billingAddress: {
    name: string
    address: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  items: OrderItem[]
  subtotal: number
  shipping: number
  tax: number
  discount: number
  total: number
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded'
  paymentMethod: string
  shippingMethod: string
  trackingNumber?: string
  notes?: string
  createdAt: string
  updatedAt: string
  timeline: Array<{
    status: string
    date: string
    description: string
  }>
}

// Mock order data
const mockOrders: Record<string, Order> = {
  'ORD-2024-001': {
    id: 'ORD-2024-001',
    customer: {
      name: 'Zhang Wei',
      email: 'zhang.wei@email.com',
      phone: '+86 138 0013 8000',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face',
    },
    shippingAddress: {
      name: 'Zhang Wei',
      address: '123 Nanjing Road',
      city: 'Shanghai',
      state: 'Shanghai',
      zipCode: '200001',
      country: 'China'
    },
    billingAddress: {
      name: 'Zhang Wei',
      address: '123 Nanjing Road',
      city: 'Shanghai',
      state: 'Shanghai',
      zipCode: '200001',
      country: 'China'
    },
    items: [
      {
        id: 1,
        name: 'iPhone 15 Pro Max',
        image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=80&h=80&fit=crop',
        sku: 'IPH15PM001',
        price: 9999,
        quantity: 1,
        total: 9999
      },
      {
        id: 2,
        name: 'AirPods Pro (2nd generation)',
        image: 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=80&h=80&fit=crop',
        sku: 'APP2001',
        price: 1899,
        quantity: 1,
        total: 1899
      },
      {
        id: 3,
        name: 'iPhone 15 Pro Max Case',
        image: 'https://images.unsplash.com/photo-1601593346740-925612772716?w=80&h=80&fit=crop',
        sku: 'CASE001',
        price: 299,
        quantity: 2,
        total: 598
      }
    ],
    subtotal: 12496,
    shipping: 0,
    tax: 1249.6,
    discount: 500,
    total: 13245.6,
    status: 'delivered',
    paymentStatus: 'paid',
    paymentMethod: 'Credit Card (**** 1234)',
    shippingMethod: 'Express Delivery',
    trackingNumber: 'SF1234567890',
    notes: 'Please deliver to the front desk',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-18T16:45:00Z',
    timeline: [
      {
        status: 'Order Placed',
        date: '2024-01-15T10:30:00Z',
        description: 'Order was successfully placed'
      },
      {
        status: 'Payment Confirmed',
        date: '2024-01-15T10:35:00Z',
        description: 'Payment was processed successfully'
      },
      {
        status: 'Processing',
        date: '2024-01-15T14:20:00Z',
        description: 'Order is being prepared for shipment'
      },
      {
        status: 'Shipped',
        date: '2024-01-16T09:15:00Z',
        description: 'Order has been shipped via Express Delivery'
      },
      {
        status: 'Delivered',
        date: '2024-01-18T16:45:00Z',
        description: 'Order was successfully delivered'
      }
    ]
  }
}

export default function OrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoading(true)

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000))

        const orderId = params.id as string
        const orderData = mockOrders[orderId]

        if (orderData) {
          setOrder(orderData)
        } else {
          // Order not found
          router.push('/orders')
        }
      } catch (error) {
        console.error('Failed to fetch order:', error)
        router.push('/orders')
      } finally {
        setLoading(false)
      }
    }

    fetchOrder()
  }, [params.id, router])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800'
      case 'shipped':
        return 'bg-blue-100 text-blue-800'
      case 'processing':
        return 'bg-yellow-100 text-yellow-800'
      case 'pending':
        return 'bg-orange-100 text-orange-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'refunded':
        return 'bg-purple-100 text-purple-800'
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

  const handleStatusUpdate = async (newStatus: string) => {
    if (!order) return

    setUpdatingStatus(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))

      setOrder(prev => prev ? { ...prev, status: newStatus as any } : null)
    } catch (error) {
      console.error('Failed to update order status:', error)
    } finally {
      setUpdatingStatus(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading order...</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Order not found</h2>
        <p className="text-gray-600 mb-6">The order you're looking for doesn't exist.</p>
        <Link href="/orders">
          <Button>Back to Orders</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Link href="/orders">
            <Button variant="outline" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to Orders
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Order {order.id}</h1>
            <p className="text-gray-600">Placed on {formatDate(order.createdAt)}</p>
          </div>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" size="sm">
            <PrinterIcon className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" size="sm">
            <TruckIcon className="w-4 h-4 mr-2" />
            Track
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
              <CardDescription>{order.items.length} items</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{item.name}</h4>
                      <p className="text-sm text-gray-600">SKU: {item.sku}</p>
                      <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">¥{item.total.toLocaleString()}</p>
                      <p className="text-sm text-gray-600">¥{item.price.toLocaleString()} each</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Customer & Shipping Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Customer Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <UserIcon className="w-5 h-5 mr-2" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-3">
                  <img
                    src={order.customer.avatar}
                    alt={order.customer.name}
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <p className="font-medium text-gray-900">{order.customer.name}</p>
                    <p className="text-sm text-gray-600">{order.customer.email}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium">{order.customer.phone}</p>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPinIcon className="w-5 h-5 mr-2" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  <p className="font-medium">{order.shippingAddress.name}</p>
                  <p>{order.shippingAddress.address}</p>
                  <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}</p>
                  <p>{order.shippingAddress.country}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment & Shipping Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Payment Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCardIcon className="w-5 h-5 mr-2" />
                  Payment Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Payment Method</p>
                  <p className="font-medium">{order.paymentMethod}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Payment Status</p>
                  <Badge className={getPaymentStatusColor(order.paymentStatus)}>
                    {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TruckIcon className="w-5 h-5 mr-2" />
                  Shipping Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Shipping Method</p>
                  <p className="font-medium">{order.shippingMethod}</p>
                </div>
                {order.trackingNumber && (
                  <div>
                    <p className="text-sm text-gray-600">Tracking Number</p>
                    <p className="font-medium font-mono text-blue-600">{order.trackingNumber}</p>
                  </div>
                )}
                {order.notes && (
                  <div>
                    <p className="text-sm text-gray-600">Notes</p>
                    <p className="text-sm">{order.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Order Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ClockIcon className="w-5 h-5 mr-2" />
                Order Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.timeline.map((event, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <CheckCircleIcon className="w-4 h-4 text-blue-600" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{event.status}</p>
                      <p className="text-sm text-gray-600">{event.description}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatDate(event.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Status */}
          <Card>
            <CardHeader>
              <CardTitle>Order Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Status</span>
                <Badge className={getStatusColor(order.status)}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600">Payment</span>
                <Badge className={getPaymentStatusColor(order.paymentStatus)}>
                  {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                </Badge>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Update Status
                </label>
                <Select
                  value={order.status}
                  onValueChange={handleStatusUpdate}
                  disabled={updatingStatus}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span>¥{order.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping</span>
                <span>{order.shipping === 0 ? 'Free' : `¥${order.shipping.toLocaleString()}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tax</span>
                <span>¥{order.tax.toLocaleString()}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-¥{order.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="border-t pt-3">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>¥{order.total.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <PrinterIcon className="w-4 h-4 mr-2" />
                Print Invoice
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <TruckIcon className="w-4 h-4 mr-2" />
                Create Shipment
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <CreditCardIcon className="w-4 h-4 mr-2" />
                Process Refund
              </Button>
              <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700">
                <XCircleIcon className="w-4 h-4 mr-2" />
                Cancel Order
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
