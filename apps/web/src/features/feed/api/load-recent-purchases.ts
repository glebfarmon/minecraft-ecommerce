import {loadContent} from '@/lib/content-fetch'

import {type RecentPurchase, RecentPurchasesSchema} from '@shop/shared/orders'

/** The latest paid purchases for the home feed; empty when the API cannot answer. */
export async function loadRecentPurchases(): Promise<RecentPurchase[]> {
  const {purchases} = await loadContent(
    '/api/orders/recent',
    RecentPurchasesSchema,
    'recent-purchases',
    {purchases: []}
  )
  return purchases
}
