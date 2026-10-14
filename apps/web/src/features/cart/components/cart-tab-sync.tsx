'use client'

import {readCartCookie, serializeCart, toCartLine} from '@/features/cart/lib/cart-cookie'
import {useCart} from '@/features/cart/shop-provider'
import {useRouter} from 'next/navigation'
import {useEffect} from 'react'

/**
 * Another tab may have changed the `cart` cookie since this page rendered. When this tab comes back
 * (or is restored from the back/forward cache) and the cookie differs, re-render the layout so
 * `ShopProvider` adopts the server's lines instead of overwriting them on the next change.
 */
export function CartTabSync() {
  const router = useRouter()
  const {lines} = useCart()
  const current = serializeCart(lines.map(toCartLine))

  useEffect(() => {
    const check = () => {
      if (readCartCookie() !== current) router.refresh()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check()
    }
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) check()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onShow)
    }
  }, [current, router])

  return null
}
