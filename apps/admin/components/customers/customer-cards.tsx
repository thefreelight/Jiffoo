import Link from 'next/link'
import { CreditCard } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useT } from 'shared/src/i18n/react'
import { useCustomerCards } from '@/lib/hooks/use-api'

const STATUS_KEYS: Record<string, string> = {
  seen: 'cardStatusSeen',
  bound: 'cardStatusBound',
  unbound: 'cardStatusUnbound',
}

function moment(value: string | null): string {
  return value ? new Date(value).toLocaleString() : '—'
}

/** The cards a customer's account read in the app: the plans on each of them
 *  and the orders that bought those plans. Shown only while the card plugin
 *  is enabled and the customer has a card. */
export function CustomerCards({ userId }: { userId: string }) {
  const t = useT()
  const cards = useCustomerCards(userId)
  if (cards.isLoading || cards.isError || !cards.data?.length) return null

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }
  const word = (key: string, fallback: string) => getText(`merchant.customers.detail.${key}`, fallback)

  return (
    <Card className="bg-white rounded-3xl border-gray-100 shadow-sm border overflow-hidden">
      <div className="p-8 border-b border-gray-50 bg-gray-50/20">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">
            {word('cards', 'CARDS')}
          </h3>
        </div>
        <p className="mt-2 text-[10px] font-medium text-gray-400 tracking-tight">
          {word('cardsDesc', 'Cards this account read in the app, the plans on them and the orders that bought those plans.')}
        </p>
      </div>
      <div className="divide-y divide-gray-50">
        {cards.data.map((card) => {
          const statusKey = STATUS_KEYS[card.status]
          return (
            <div key={card.id} className="p-6 px-4 sm:px-10 space-y-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <span className="font-mono text-xs font-bold text-gray-900 tracking-tight break-all">{card.eid ?? card.cardId}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {statusKey ? word(statusKey, card.status) : card.status}
                </span>
                {card.boundAt ? (
                  <span className="text-[10px] font-medium text-gray-400 tracking-tight">
                    {word('cardBoundAt', 'Bound')} {moment(card.boundAt)}
                  </span>
                ) : null}
                <span className="text-[10px] font-medium text-gray-400 tracking-tight">
                  {word('cardLastSeen', 'Last seen')} {moment(card.lastSeenAt)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      <th className="py-2 pr-4 font-bold">{word('cardPlan', 'Plan')}</th>
                      <th className="py-2 pr-4 font-bold">ICCID</th>
                      <th className="py-2 pr-4 font-bold">{word('cardPlanState', 'State')}</th>
                      <th className="py-2 font-bold">{word('cardPlanOrders', 'Orders')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {card.profiles.length === 0 ? (
                      <tr className="border-t border-gray-50">
                        <td colSpan={4} className="py-3 text-xs text-gray-400">{word('cardNoPlans', 'No plan was read from this card')}</td>
                      </tr>
                    ) : card.profiles.map((profile) => (
                      <tr key={profile.iccid} className="border-t border-gray-50 align-top">
                        <td className="py-3 pr-4">
                          <div className="text-xs font-bold text-gray-900">{profile.name || profile.provider || '—'}</div>
                          {profile.name && profile.provider ? <div className="text-[10px] text-gray-400">{profile.provider}</div> : null}
                        </td>
                        <td className="py-3 pr-4 font-mono text-[11px] text-gray-600">{profile.iccid}</td>
                        <td className="py-3 pr-4 text-xs font-bold text-gray-900">
                          {profile.enabled ? word('cardPlanEnabled', 'Enabled') : word('cardPlanDisabled', 'Off')}
                        </td>
                        <td className="py-3">
                          {profile.orders.length === 0 ? (
                            <span className="text-xs text-gray-400">{word('cardPlanNotBought', 'Not bought here')}</span>
                          ) : profile.orders.map((order) => (
                            <div key={`${order.orderId}:${order.productId ?? ''}`} className="text-[11px] text-gray-600 leading-5">
                              <Link href={`/orders/${order.orderId}`} className="font-mono font-bold text-blue-600 hover:underline">
                                {order.orderNumber}
                              </Link>
                              {' · '}{order.productName}
                              {order.createdAt ? ` · ${new Date(order.createdAt).toLocaleDateString()}` : ''}
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
