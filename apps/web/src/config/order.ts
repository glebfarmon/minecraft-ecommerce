/** localStorage key holding the public id of the order this browser sent to the payment page. */
export const PENDING_ORDER_KEY = 'checkout:pending-order'
/** How often the order page asks the API whether the payment went through. */
export const ORDER_POLL_MS = 2000
/** After this long the page stops polling and says the payment is still being processed. */
export const ORDER_POLL_LIMIT_MS = 60_000
