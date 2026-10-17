import type {OrderStatus} from '@shop/shared/orders'

const TONE: Partial<Record<OrderStatus, string>> = {
  PAID: 'bg-green-100 text-green-900',
  PENDING: 'bg-amber-100 text-amber-900',
  EXPIRED: 'bg-muted text-muted-foreground'
}

export function OrderStatusBadge({status}: {status: OrderStatus}) {
  return <span className={`rounded px-1.5 text-xs ${TONE[status] ?? 'border'}`}>{status}</span>
}
