# Web re-render / SSR / duplication cleanup

Source: audit of `apps/web` (2026-10-02). Behaviour stays the same; tests lead where logic changes.

- [x] 1. Split `ShopProvider` into currency / cart state / cart actions contexts so adding to the cart does not re-render every `ProductCard`. Test: a card-like consumer of `useCurrency` + `useCartActions` does not re-render on `add`.
- [x] 2. Cache `Intl.NumberFormat` per `locale:currency` in `formatPrice`.
- [x] 3. `useTransientFlag(ms)` replaces the duplicated timeout in `useAddToCart` and `CopyIp`. Test first.
- [x] 4. `catalog.tsx`: module-level `FILTERS` and `fade`, one `cycle` helper for both arrow steppers; `defaultServer` derived from one `survival` const.
- [x] 5. `eyebrow` / `eyebrow-sm` utilities in `globals.css` replace the 9 repeated label class strings.
- [x] 6. Fonts: drop explicit `weight` (variable fonts, one file per subset).
- [x] 7. Footer year: revalidate daily instead of freezing at build time.
- [ ] 8. Gate: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`, then `next build` route table.

Out of scope (decided in the audit): server-side status prefetch, splitting product descriptions from the client bundle, `fairness.ts` (spec-backed).
