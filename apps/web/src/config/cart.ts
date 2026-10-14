/** Per-line quantity cap; `add` ignores anything past it. */
export const MAX_QTY = 99

/** Distinct products in one cart; keeps the `cart` cookie well under 4 KB. */
export const MAX_LINES = 30

export const CART_COOKIE = 'cart'
export const CART_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // seconds
// A cookie rather than localStorage so the API receives the chosen currency with every request.
export const CURRENCY_COOKIE = 'currency'
export const CURRENCY_COOKIE_MAX_AGE = 365 * 24 * 60 * 60 // seconds

/** How long the "added" confirmation on a buy button stays. */
export const ADDED_FLASH_MS = 1400
/** How long the "copied" confirmation on the IP button stays. */
export const COPIED_FLASH_MS = 1500
