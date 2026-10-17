import {writeCartCookie} from '@/features/cart/lib/cart-cookie'

/** The order is paid: the cart it came from is spent. The caller refreshes the layout so the badge follows. */
export function clearCart(): void {
  writeCartCookie([])
}
