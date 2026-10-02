import * as v from 'valibot'

/** The game server's nickname rule. The API checks it again before any RCON command is rendered. */
const NICK_PATTERN = /^[A-Za-z0-9_]{3,16}$/

/** A checkbox the player must tick: still a boolean on input, so the form can start unchecked. */
const mustBeTrue = (message: string) =>
  v.pipe(
    v.boolean(),
    v.check(ticked => ticked, message)
  )

/** Messages are `checkout.errors.*` keys; the form translates them. */
export const checkoutSchema = v.object({
  nick: v.pipe(v.string(), v.trim(), v.regex(NICK_PATTERN, 'nick')),
  email: v.pipe(v.string(), v.trim(), v.email('email')),
  promo: v.pipe(v.string(), v.trim()),
  delivery: mustBeTrue('delivery'),
  terms: mustBeTrue('terms')
})

export type CheckoutInput = v.InferInput<typeof checkoutSchema>
export type CheckoutValues = v.InferOutput<typeof checkoutSchema>
