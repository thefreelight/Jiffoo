/**
 * Purchase Order List Component
 *
 * Displays the list of purchase orders in a table format
 * Can be reused in different contexts
 */

'use client'

import { FileText, Eye, CheckCircle, XCircle, Package, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useT, useLocale } from 'shared/src/i18n/react'
import { PurchaseOrder } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

interface PurchaseOrderListProps {
  purchaseOrders: PurchaseOrder[]
  onApprove?: (purchaseOrder: PurchaseOrder) => void
  onUpdateStatus?: (purchaseOrder: PurchaseOrder) => void
  emptyMessage?: string
}

export function PurchaseOrderList({ purchaseOrders, onApprove, onUpdateStatus, emptyMessage }: PurchaseOrderListProps) {
  const t = useT()
  const locale = useLocale()

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback
  }

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'APPROVED':
      case 'ORDERED':
        return 'bg-green-100 text-green-800'
      case 'RECEIVED':
      case 'PARTIALLY_RECEIVED':
        return 'bg-blue-100 text-blue-800'
      case 'PENDING_APPROVAL':
        return 'bg-yellow-100 text-yellow-800'
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800'
      case 'REJECTED':
      case 'CANCELLED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PAID':
        return 'bg-green-100 text-green-800'
      case 'PARTIALLY_PAID':
        return 'bg-yellow-100 text-yellow-800'
      case 'UNPAID':
        return 'bg-gray-100 text-gray-800'
      case 'OVERDUE':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString(locale || 'en', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false
    const due = new Date(dueDate)
    const now = new Date()
    return due < now
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.purchaseOrders.poNumber', 'PO #')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.purchaseOrders.company', 'Company')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.purchaseOrders.customer', 'Customer')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.purchaseOrders.amount', 'Amount')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.purchaseOrders.status', 'Status')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.purchaseOrders.paymentStatus', 'Payment')}</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">{getText('merchant.b2b.purchaseOrders.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {purchaseOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="text-gray-500">
                      {emptyMessage || getText('merchant.b2b.purchaseOrders.noPurchaseOrdersFound', 'No purchase orders found.')}
                    </div>
                  </td>
                </tr>
              ) : (
                purchaseOrders.map((po: PurchaseOrder) => (
                  <tr key={po.id} className="hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full mr-4 flex items-center justify-center">
                          <Package className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{po.poNumber}</div>
                          <div className="text-sm text-gray-500">{formatDate(po.orderDate)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm">
                        <div className="text-gray-900 font-medium">{po.company?.name || getText('merchant.b2b.purchaseOrders.noCompany', 'No Company')}</div>
                        <div className="text-gray-500">{po.company?.email || ''}</div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm">
                        <div className="text-gray-900">{po.user?.username || po.user?.email || getText('merchant.b2b.purchaseOrders.noCustomer', 'No Customer')}</div>
                        {po.user?.username && <div className="text-gray-500">{po.user?.email}</div>}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-medium text-gray-900">{formatCurrency(po.totalAmount)}</div>
                      {po.items && po.items.length > 0 && (
                        <div className="text-sm text-gray-500">{po.items.length} {getText('merchant.b2b.purchaseOrders.items', 'items')}</div>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <Badge className={getStatusColor(po.status)}>
                        {po.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="py-4 px-6">
                      <div className="space-y-1">
                        <Badge className={getPaymentStatusColor(po.paymentStatus)}>
                          {po.paymentStatus.replace(/_/g, ' ')}
                        </Badge>
                        {po.paymentDueDate && (
                          <div className={`text-xs ${isOverdue(po.paymentDueDate) ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                            {isOverdue(po.paymentDueDate) ? (
                              <span className="flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {getText('merchant.b2b.purchaseOrders.overdue', 'Overdue')}
                              </span>
                            ) : (
                              <>Due {formatDate(po.paymentDueDate)}</>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2">
                        <Link href={`/${locale}/b2b/purchase-orders/${po.id}`}>
                          <Button variant="ghost" size="sm" title={getText('merchant.b2b.purchaseOrders.viewDetails', 'View Details')}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        {po.status === 'PENDING_APPROVAL' && onApprove && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title={getText('merchant.b2b.purchaseOrders.approveReject', 'Approve/Reject')}
                            onClick={() => onApprove(po)}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                        {po.status === 'APPROVED' && onUpdateStatus && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title={getText('merchant.b2b.purchaseOrders.updateStatus', 'Update Status')}
                            onClick={() => onUpdateStatus(po)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Package className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
