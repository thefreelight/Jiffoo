import type { AdminOrderDetailDTO, OrderAddressDTO } from 'shared';

export function trackingUrl(trackingNumber: string, locale: string): string {
  return 'https://t.17track.net/' + (locale === 'zh-Hans' ? 'zh-cn' : 'en') + '#nums=' + encodeURIComponent(trackingNumber);
}
export function shippingAddressText(address: OrderAddressDTO): string {
  return [
    [address.recipientName, address.phone].filter(Boolean).join(' · '),
    address.street, address.street2,
    [[address.city, address.state, address.zipCode].filter(Boolean).join(' '), address.country].filter(Boolean).join(' · '),
  ].filter(Boolean).join('\n');
}
export function orderHeaderActions(order: Pick<AdminOrderDetailDTO, 'status' | 'canRecordManualPayment' | 'canRefundOrder' | 'paymentStatus' | 'shipments'>) {
  return {
    ship: order.status === 'PROCESSING' && !order.shipments?.length,
    deliver: order.status === 'SHIPPED',
    record: ['PENDING', 'CANCELLED'].includes(order.status) && !!order.canRecordManualPayment,
    refund: !!order.canRefundOrder && order.paymentStatus === 'PAID' && ['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].includes(order.status),
    cancel: order.status === 'PENDING',
  };
}
